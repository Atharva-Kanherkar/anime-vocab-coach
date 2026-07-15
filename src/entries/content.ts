// Content-script bundle: the whole learning pipeline. Loads after
// vendor/kuromoji.js (separate script in the manifest, load order matters).
import { log, warn } from "../lib/log";
import * as storage from "../lib/storage";
import * as dict from "../lib/dictionary";
import * as tokenizer from "../lib/tokenizer";
import { tokenizeEnglish } from "../lib/english-tokenize";
import { pickTargetSmart } from "../lib/pick-target";
import * as overlay from "../lib/overlay";
import { requestAnimeContext, peekAnimeContext } from "../lib/anime-context-client";
import { youtubeAdapter } from "../lib/adapters/youtube";
import { netflixAdapter } from "../lib/adapters/netflix";
import { genericAdapter } from "../lib/adapters/generic";
import { setAdapterDirection } from "../lib/adapters/util";
import { audioLang, normalizeDirection } from "../lib/direction";
import { fetchExtractWords, overlayFromExtract } from "../lib/extract-words-client";
import { deriveCacheKey, sessionIdentity, type PlatformId } from "../lib/cache-key";
import { lookupTranscript } from "../lib/transcript-client";
import type { DictEntry, LineContext, Settings, SiteAdapter, Target, Token, VocabMap } from "../types";

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
      settings = await storage.getSettings();
      setAdapterDirection(normalizeDirection(settings.learningDirection));
      // Japanese path needs kuromoji + JMdict; English path tokenizes locally.
      if (normalizeDirection(settings.learningDirection) === "en-ja") {
        await tokenizer.init();
        const data = await dict.load();
        log("dictionary loaded:", Object.keys(data).length, "entries");
      }
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

  function studyLang(): "ja" | "en" {
    return audioLang(normalizeDirection(settings?.learningDirection));
  }

  function refreshCacheKey(): void {
    const a = pickAdapter();
    if (!a) return;
    const video = a.getVideo();
    const preferred = studyLang();
    const result = deriveCacheKey(platformForAdapter(a), video, preferred);
    // Shared cache for the language we're studying (JA or EN).
    const next = result && result.audioLang === preferred ? result.key : "";
    if (next !== cacheKey) {
      cacheKey = next;
      chrome.runtime.sendMessage({ type: "avc-update-cache-key", key: cacheKey }).catch(() => {});
    }
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
        const lang = studyLang();
        if (lang === "ja" && !/[\u3040-\u30FF\u4E00-\u9FFF]/.test(seg.text)) continue;
        if (lang === "en" && !/[A-Za-z]{2,}/.test(seg.text)) continue;
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

  let lastContextTitle = "";

  function countProgress(vocab: VocabMap): number {
    let n = 0;
    for (const rec of Object.values(vocab)) {
      if (rec.state === "known" || rec.state === "learning") n++;
    }
    return n;
  }

  function prefetchAnimeContext(title: string | null): void {
    if (!title || title === lastContextTitle) return;
    lastContextTitle = title;
    void requestAnimeContext(title);
  }

  async function refreshState(): Promise<void> {
    settings = await storage.getSettings();
    setAdapterDirection(normalizeDirection(settings.learningDirection));
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

    const title = currentTitle();
    prefetchAnimeContext(title);

    const direction = normalizeDirection(settings!.learningDirection);
    const cardOptions: overlay.AgentPanelOptions = {
      interaction: mode === "pause" ? "focus" : "ambient",
      autoResumeSec: settings!.autoResumeSec,
      displayScript: settings!.displayScript || "romaji",
      autoSpeak: settings!.autoSpeak !== false,
      contextEn: context?.en || "",
      fromAudio: !!context?.fromAudio,
      tokens,
      targetIndex: tokens.indexOf(target.token),
      title,
      animeContext: peekAnimeContext(title),
      learnerLevel: settings!.targetLevel,
      wordsKnown: countProgress(wordStates),
      learningDirection: direction,
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

    const direction = normalizeDirection(settings.learningDirection);
    setAdapterDirection(direction);

    let tokens: Token[];
    let dictOverlay: Record<string, DictEntry> | null = null;

    if (direction === "ja-en") {
      tokens = tokenizeEnglish(normalized);
      const extracted = await fetchExtractWords({
        line: normalized,
        direction,
        learnerLevel: settings.targetLevel,
        title: currentTitle(),
      });
      if (extracted.ok && extracted.words?.length) {
        dictOverlay = overlayFromExtract(extracted.words);
        for (const w of extracted.words) {
          const base = w.word.trim().toLowerCase();
          if (!base || tokens.some((t) => t.base === base)) continue;
          tokens.push({
            surface: w.word,
            base,
            reading: w.reading || "",
            pos: "CONTENT",
            pos1: "english",
          });
        }
      }
    } else {
      tokens = await tokenizer.tokenize(normalized);
    }

    await storage.recordSeen(tokens, wordStates, targetedThisSession, direction, dictOverlay);
    wordStates = await storage.getVocab();

    if (overlay.isOpen()) {
      log("skipped line (word card still open):", normalized.slice(0, 40));
      return;
    }

    const target = await pickTargetSmart(
      tokens,
      wordStates,
      settings,
      targetedThisSession,
      normalized,
      currentTitle(),
      dictOverlay
    );
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

    void handleCard(target, normalized, tokens, context).catch((err) => {
      warn("handleCard failed:", err);
      overlay.dismissAgent();
    });
  }

  // Listening mode: the offscreen document transcribes this tab's audio and the
  // background forwards Japanese text here. Only the frame that owns the video
  // handles it (matters on sites whose player lives in an iframe).
  chrome.runtime.onMessage.addListener((msg: { type: string; text?: string; active?: boolean; kind?: string }, _sender, sendResponse) => {
    if (msg.type === "avc-toast") {
      overlay.showToast(msg.text || "", msg.kind === "error" ? "error" : "info");
      return;
    }
    if (msg.type === "avc-get-cache-key") {
      refreshCacheKey();
      sendResponse({ key: cacheKey || null });
      return true;
    }
    if (msg.type === "avc-agent-show") {
      overlay.ensureAgentMounted();
      sendResponse({ ok: true, visible: true });
      return true;
    }
    if (msg.type === "avc-agent-hide") {
      overlay.hideAgent();
      sendResponse({ ok: true, visible: false });
      return true;
    }
    if (msg.type === "avc-agent-status") {
      sendResponse({ ok: true, visible: overlay.isAgentActive() });
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
    const direction = normalizeDirection(settings?.learningDirection);
    const segments = (msg.text || "")
      .split(direction === "ja-en" ? /(?<=[.!?])\s+/ : /(?<=[。！？])/)
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
    const sid = a ? sessionIdentity(platformForAdapter(a), studyLang()) : location.pathname;
    if (sid !== lastSessionId) {
      lastSessionId = sid;
      targetedThisSession.clear();
      lastLine = "";
      lastCacheCueKey = "";
      lastContextTitle = "";
      refreshCacheKey();
      log("session reset for new video:", sid);
      prefetchAnimeContext(currentTitle());
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
  lastSessionId = initial ? sessionIdentity(platformForAdapter(initial), studyLang()) : location.pathname;

  // Legacy: stop auto-opening the sidebar on every page after an old popup session pinned it.
  void storage.setAgentPinned(false);
})();
