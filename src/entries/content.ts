// Content-script bundle: the whole learning pipeline. Loads after
// vendor/kuromoji.js (separate script in the manifest, load order matters).
import { log, warn } from "../lib/log";
import * as storage from "../lib/storage";
import * as dict from "../lib/dictionary";
import * as tokenizer from "../lib/tokenizer";
import * as scoring from "../lib/scoring";
import * as overlay from "../lib/agent-panel";
import { youtubeAdapter } from "../lib/adapters/youtube";
import { netflixAdapter } from "../lib/adapters/netflix";
import { genericAdapter } from "../lib/adapters/generic";
import { deriveCacheKey, sessionIdentity, type PlatformId } from "../lib/cache-key";
import { lookupTranscript } from "../lib/transcript-client";
import type { LineContext, Settings, SiteAdapter, Target, Token, VocabMap } from "../types";

declare global {
  interface Window {
    __avcMainLoaded?: boolean;
    __avcNetflixVideoId?: string;
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
  let lastSessionId = "";
  const targetedThisSession = new Set<string>();
  let watchInterval: ReturnType<typeof setInterval> | null = null;
  let cacheKey = "";
  let listeningActive = false;
  let cachePollTimer: ReturnType<typeof setInterval> | null = null;
  let lastCacheCueKey = "";
  let playbackRelayTimer: ReturnType<typeof setInterval> | null = null;

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

  function platformForAdapter(a: SiteAdapter): PlatformId {
    if (a.name === "youtube") return "youtube";
    if (a.name === "netflix") return "netflix";
    if (location.hostname.endsWith("crunchyroll.com")) return "crunchyroll";
    return "generic";
  }

  function refreshCacheKey(): void {
    const a = pickAdapter();
    if (!a) return;
    const video = a.getVideo();
    const result = deriveCacheKey(platformForAdapter(a), video);
    // Shared cache only covers Japanese audio (the vocab source). For a dub or
    // any non-ja track, leave cacheKey unset so we don't upload audio that would
    // be transcribed and then discarded — the per-user path handles those.
    cacheKey = result && result.audioLang === "ja" ? result.key : "";
  }

  async function pollCacheHit(): Promise<void> {
    if (!listeningActive || !cacheKey) return;
    const a = pickAdapter();
    const video = a?.getVideo();
    if (!video || video.paused) return;
    settings = await storage.getSettings();
    const syncToken = await storage.getSyncToken();
    if (!syncToken) return;

    const t = video.currentTime;
    try {
      const result = await lookupTranscript(syncToken, cacheKey, t);
      if (!result.hit || !result.segments.length) return;
      for (const seg of result.segments) {
        const key = `${seg.start}:${seg.text}`;
        if (key === lastCacheCueKey) continue;
        lastCacheCueKey = key;
        if (!/[぀-ヿ一-鿿]/.test(seg.text)) continue;
        const en = a?.getVisibleText() || "";
        await onLine(seg.text, { en, fromAudio: true });
      }
    } catch (err) {
      warn("cache poll failed:", err);
    }
  }

  function startCachePolling(): void {
    if (cachePollTimer) return;
    refreshCacheKey();
    cachePollTimer = setInterval(() => {
      pollCacheHit().catch((err) => warn("cache poll error:", err));
    }, 800);
  }

  function stopCachePolling(): void {
    if (cachePollTimer) clearInterval(cachePollTimer);
    cachePollTimer = null;
    lastCacheCueKey = "";
  }

  function startPlaybackRelay(): void {
    if (playbackRelayTimer) return;
    playbackRelayTimer = setInterval(() => {
      if (!listeningActive) return;
      const video = adapter?.getVideo();
      if (!video) return;
      chrome.runtime.sendMessage({
        type: "avc-playback-time",
        time: video.currentTime,
        paused: video.paused
      }).catch(() => {});
    }, 500);
  }

  function stopPlaybackRelay(): void {
    if (playbackRelayTimer) clearInterval(playbackRelayTimer);
    playbackRelayTimer = null;
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

    settings = await storage.getSettings();
    const rawMode = settings!.pauseMode as string;
    const mode: Settings["pauseMode"] = rawMode === "notify" ? "copilot" : settings!.pauseMode;

    const meta = {
      reading: target.entry.reading,
      gloss: target.entry.glosses[0] || "",
      level: target.entry.level,
      freqRank: target.entry.freqRank
    };

    const cardOptions: overlay.AgentPanelOptions = {
      interaction: mode === "pause" ? "focus" : "ambient",
      autoResumeSec: settings!.autoResumeSec,
      displayScript: settings!.displayScript || "romaji",
      autoSpeak: settings!.autoSpeak !== false,
      contextEn: context?.en || "",
      fromAudio: !!context?.fromAudio,
      tokens,
      targetIndex: tokens.indexOf(target.token),
      title: currentTitle()
    };

    const judgment = await overlay.showAgentPanel(target, sentence, video, cardOptions);

    if (judgment && judgment !== "dismiss") {
      const source = {
        title: currentTitle(),
        line: sentence,
        en: context?.en || null
      };
      await storage.judgeWord(target.token.base, judgment, meta, source);
      await refreshState();
    }
  }

  // Best-effort anime/video title from the page, with the site's own suffix
  // stripped. Good enough to attribute a learned word to what you were watching.
  function currentTitle(): string | null {
    const raw = (document.title || "").trim();
    if (!raw) return null;
    const cleaned = raw
      .replace(/\s*[-|·—]\s*(YouTube|Netflix|Crunchyroll).*$/i, "")
      .replace(/^\(\d+\)\s*/, "") // YouTube unread-count prefix like "(3) "
      .replace(/^Watch\s+/i, "") // Crunchyroll "Watch <title>"
      .trim();
    const candidate = cleaned || raw;
    // A bare site name (e.g. Netflix sets document.title to just "Netflix"
    // during playback) is useless context — better to store no title than that.
    if (/^(youtube|netflix|crunchyroll)$/i.test(candidate)) return null;
    return candidate;
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
  chrome.runtime.onMessage.addListener((msg: { type: string; text?: string; active?: boolean }, _sender, sendResponse) => {
    if (msg.type === "avc-get-cache-key") {
      refreshCacheKey();
      sendResponse({ key: cacheKey || null });
      return true;
    }
    if (msg.type === "avc-agent-show") {
      overlay.ensureAgentMounted();
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === "avc-listening-state") {
      listeningActive = !!msg.active;
      if (listeningActive) {
        startCachePolling();
        startPlaybackRelay();
      } else {
        stopCachePolling();
        stopPlaybackRelay();
      }
      return;
    }
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
    const a = pickAdapter();
    const sid = a ? sessionIdentity(platformForAdapter(a)) : location.pathname;
    if (sid !== lastSessionId) {
      lastSessionId = sid;
      targetedThisSession.clear();
      lastLine = "";
      lastCacheCueKey = "";
      refreshCacheKey();
      log("session reset for new video:", sid);
    }
  }, 2000);

  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window) return;
    if (e.data?.source !== "avc") return;
    if (e.data.type === "avc-netflix-video-id" && e.data.videoId) {
      window.__avcNetflixVideoId = e.data.videoId;
      refreshCacheKey();
    }
  });

  refreshCacheKey();
  const initial = pickAdapter();
  lastSessionId = initial ? sessionIdentity(platformForAdapter(initial)) : location.pathname;

  void storage.getAgentPinned().then((pinned) => {
    if (pinned) overlay.ensureAgentMounted();
  });
})();
