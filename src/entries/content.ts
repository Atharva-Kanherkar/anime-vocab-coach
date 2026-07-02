// Content-script bundle: the whole learning pipeline. Loads after
// vendor/kuromoji.js (separate script in the manifest, load order matters).
import { log, warn } from "../lib/log";
import * as storage from "../lib/storage";
import * as dict from "../lib/dictionary";
import * as tokenizer from "../lib/tokenizer";
import * as scoring from "../lib/scoring";
import * as overlay from "../lib/overlay";
import { youtubeAdapter } from "../lib/adapters/youtube";
import { netflixAdapter } from "../lib/adapters/netflix";
import { genericAdapter } from "../lib/adapters/generic";
import type { LineContext, Settings, SiteAdapter, Target, Token, VocabMap } from "../types";

declare global {
  interface Window {
    __avcMainLoaded?: boolean;
  }
}

(function main() {
  // Guard: this script can arrive twice — once via the manifest content_scripts
  // on page load, and again via chrome.scripting when Listening Mode injects it
  // into a tab that was open before the extension loaded. Wire the pipeline once.
  if (window.__avcMainLoaded) { log("main already loaded, skipping re-init"); return; }
  window.__avcMainLoaded = true;

  // Order matters: generic matches almost anything with a <video>, so it goes last.
  const adapters: SiteAdapter[] = [youtubeAdapter, netflixAdapter, genericAdapter];

  let adapter: SiteAdapter | null = null;
  let started = false;
  let initialized = false;
  let pipelineDisabled = false;
  let settings: Settings | null = null;
  let wordStates: VocabMap = {};
  let lastLine = "";
  let lastPath = location.pathname;
  const targetedThisSession = new Set<string>();
  let watchInterval: ReturnType<typeof setInterval> | null = null;

  // Adapters can start matching late (e.g. Crunchyroll's player iframe creates
  // its <video> well after document_idle), so keep looking until one matches.
  function pickAdapter(): SiteAdapter | null {
    if (adapter) return adapter;
    adapter = adapters.find((a) => a.matches()) || null;
    if (adapter && !started) {
      started = true;
      log("adapter chosen:", adapter.name);
      adapter.start(onLine);
    }
    return adapter;
  }

  async function ensureInit(): Promise<void> {
    if (initialized || pipelineDisabled) return;
    try {
      await tokenizer.init();
      const data = await dict.load();
      log("dictionary loaded:", Object.keys(data).length, "entries");
      settings = await storage.getSettings();
      wordStates = await storage.getVocab();
      initialized = true;
      startWatchInterval();
    } catch (err) {
      pipelineDisabled = true;
      warn("pipeline init failed:", err);
    }
  }

  function startWatchInterval(): void {
    if (watchInterval) return;
    watchInterval = setInterval(async () => {
      const video = adapter && adapter.getVideo();
      if (!video || video.paused || video.ended) return;
      await storage.recordWatchTick();
    }, 60000);
  }

  async function refreshState(): Promise<void> {
    settings = await storage.getSettings();
    wordStates = await storage.getVocab();
  }

  async function handleCard(target: Target, sentence: string, tokens: Token[], context?: LineContext): Promise<void> {
    const video = adapter ? adapter.getVideo() : null;
    targetedThisSession.add(target.token.base);
    await storage.recordCardShown(target.token.base);

    const meta = {
      reading: target.entry.reading,
      gloss: target.entry.glosses[0] || "",
      level: target.entry.level,
      freqRank: target.entry.freqRank
    };

    const cardOptions: overlay.CardOptions = {
      autoResumeSec: settings!.autoResumeSec,
      displayScript: settings!.displayScript || "romaji",
      autoSpeak: settings!.autoSpeak !== false,
      contextEn: context?.en || "",
      fromAudio: !!context?.fromAudio,
      tokens,
      targetIndex: tokens.indexOf(target.token)
    };

    let judgment: Awaited<ReturnType<typeof overlay.showCard>>;
    if (settings!.pauseMode === "notify") {
      judgment = await new Promise((resolve) => {
        overlay.showToast(target, sentence, video, async () => {
          if (video && !video.paused) video.pause();
          const j = await overlay.showCard(target, sentence, video, cardOptions);
          resolve(j);
        });
      });
    } else {
      judgment = await overlay.showCard(target, sentence, video, cardOptions);
    }

    if (judgment && judgment !== "dismiss") {
      await storage.judgeWord(target.token.base, judgment, meta);
      await refreshState();
    }
  }

  async function onLine(text: string, context?: LineContext): Promise<void> {
    if (pipelineDisabled) return;

    settings = await storage.getSettings();

    if (settings.pauseMode === "off") return;

    const siteKey = adapter ? adapter.name : "generic";
    if (settings.sites && settings.sites[siteKey] === false) return;

    await ensureInit();
    if (!initialized) return;

    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized === lastLine) return;
    lastLine = normalized;

    const tokens = await tokenizer.tokenize(normalized);
    await storage.recordSeen(tokens, wordStates, targetedThisSession);
    wordStates = await storage.getVocab();

    if (overlay.isOpen()) return;

    const target = scoring.pickTarget(tokens, wordStates, settings, targetedThisSession);
    if (!target) { log("no target word in:", normalized); return; }

    const stats = await storage.getStats();
    const now = Date.now();
    const cardTimestamps = stats.cardTimestamps || [];

    if (!target.isReview) {
      const lastCard = cardTimestamps.length ? cardTimestamps[cardTimestamps.length - 1] : 0;
      if (now - lastCard < settings.cooldownSec * 1000) {
        log(`target "${target.token.base}" held back by cooldown (${settings.cooldownSec}s)`);
        return;
      }
      if (cardTimestamps.length >= settings.maxCardsPerHour) {
        log("hourly card cap reached");
        return;
      }
    }
    log("showing card for:", target.token.base);

    await handleCard(target, normalized, tokens, context);
  }

  // Listening mode: the offscreen document transcribes this tab's audio and the
  // background forwards Japanese text here. Only the frame that owns the video
  // handles it (matters on sites whose player lives in an iframe).
  chrome.runtime.onMessage.addListener((msg: { type: string; text?: string }) => {
    if (msg.type !== "avc-transcript") return;
    const a = pickAdapter();
    if (!a) { warn("transcript arrived but no adapter matched this frame"); return; }
    if (!a.getVideo()) { log("transcript ignored (no video in this frame)"); return; }
    log("transcript received:", msg.text);
    const en = a.getVisibleText();
    const segments = (msg.text || "")
      .split(/(?<=[。！？])/)
      .map((s) => s.trim())
      .filter(Boolean);
    (async () => {
      for (const seg of segments) {
        await onLine(seg, { en, fromAudio: true });
      }
    })().catch((err) => warn("transcript handling failed:", err));
  });

  pickAdapter();
  const pickTimer = setInterval(() => {
    if (pickAdapter()) clearInterval(pickTimer);
  }, 2000);

  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      targetedThisSession.clear();
      lastLine = "";
      log("session reset for new video");
    }
  }, 2000);
})();
