// Content-script bundle: the whole learning pipeline. Loads after
// vendor/kuromoji.js (separate script in the manifest, load order matters).
import { log, warn } from "../lib/log";
import * as storage from "../lib/storage";
import * as dict from "../lib/dictionary";
import * as tokenizer from "../lib/tokenizer";
import { tokenizeEnglish } from "../lib/english-tokenize";
import { pickTargetSmart } from "../lib/pick-target";
import * as overlay from "../lib/overlay";
import { showLensLine, hideLens, clearLensLine } from "../lib/sub-lens";
import { installKeyShield } from "../lib/key-shield";
import { SubtitleHistory } from "../lib/subtitle-history";
import { requestAnimeContext, peekAnimeContext } from "../lib/anime-context-client";
import { youtubeAdapter } from "../lib/adapters/youtube";
import { netflixAdapter } from "../lib/adapters/netflix";
import { genericAdapter } from "../lib/adapters/generic";
import { setAdapterDirection } from "../lib/adapters/util";
import { audioLang, normalizeDirection } from "../lib/direction";
import { requestExtractWords, overlayFromExtract } from "../lib/extract-words-client";
import { deriveCacheKey, sessionIdentity, type PlatformId } from "../lib/cache-key";
import { lookupTranscript } from "../lib/transcript-client";
import { CueLedger } from "../lib/cue-ledger";
import { ONBOARDING_STORAGE_KEY, isFirstCardTransition } from "../lib/onboarding";
import {
  captionNoticeText,
  captionReport,
  captionStatusDetail,
  onCaptions,
  resetCaptions,
} from "../lib/caption-status";
import type { DictEntry, LineContext, Settings, SiteAdapter, Target, Token, VocabMap } from "../types";

/** An audio line whose speech began longer ago than this is too late for the
 * Subtitle Lens: by then the scene has moved on. It still reaches the card
 * pipeline. Covers a long realtime utterance (speech, the VAD's silence wait,
 * transcription) without admitting a line from a couple of lines back. */
const AUDIO_LENS_MAX_LAG_SEC = 7;
/** The same limit measured from when the line finished, when that is known. */
const AUDIO_LENS_MAX_LAG_AFTER_END_SEC = 4;
/** A cached line may arrive this far ahead of its moment and show at once. */
const EARLY_LINE_TOLERANCE_SEC = 0.3;
/** Further ahead than this is not a line arriving early but a stale window
 * (a seek, a long pause); drop it and let the cache poll emit it on time. */
const MAX_EARLY_HOLD_SEC = 10;
/** After kuromoji or the dictionary fails to load, wait this long before the
 * next line tries again, so a persistent failure is not refetched per line. */
const JA_RETRY_MS = 30_000;

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
  // Normally installed at document_start by key-shield.js; this covers a tab
  // Listening Mode injected into after the fact.
  installKeyShield();

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
  /** Rate-limits the "hourly card cap" notice to once per rolling window. */
  let hourlyCapNotified = false;
  /** One subtitle line processed at a time; see onLine. */
  let lineInFlight = false;
  let queuedLine: { text: string; context?: LineContext } | null = null;
  /** Newest line the Lens was asked to show. A render still tokenizing when a
   * newer line arrives must not paint over it. */
  let lensSeq = 0;
  /** The line a Subtitle Lens judgment was made on. The automatic card for that
   * same line stands down: a deliberate Lens action wins. */
  let lensJudgedLine = "";
  /** Last tokenization, shared by the Lens and the card pipeline, which both
   * need the same line tokenized within milliseconds of each other. */
  let tokenMemo: { text: string; tokens: Token[] } | null = null;
  let initPromise: Promise<void> | null = null;
  let jaReady = false;
  let jaPromise: Promise<boolean> | null = null;
  let jaFailedAt = 0;
  /** What the page showed as the context-language subtitle, by video time, so
   * a line heard from the audio is paired with the subtitle that was on screen
   * while it was spoken — not whichever one is up when the transcript lands. */
  const contextSubs = new SubtitleHistory();
  let contextSampleTimer: ReturnType<typeof setInterval> | null = null;
  let cachePollTimer: ReturnType<typeof setInterval> | null = null;
  /** Cues already fed to onLine, so overlapping polls can never re-card a
   * line. The old single-slot "last cue" only blocked immediate repeats: a
   * poll returning [A,B,C] left the slot at C, and the next poll re-emitted A. */
  const emittedCueKeys = new CueLedger();
  /** One lookup at a time; without this, 800ms ticks stack overlapping runs
   * behind a slow network. Scoped to a generation so a hung obsolete lookup
   * cannot block polling forever after Listening restarts. */
  let cachePollInFlight: number | null = null;
  /** Invalidates async polls across stop/restart and episode-key transitions,
   * including K -> other -> K cycles that a key-only check cannot detect. */
  let cachePollGeneration = 0;
  let playbackRelayTimer: ReturnType<typeof setInterval> | null = null;
  /** One "no captions on this video" notice per video, not per caption report. */
  let captionNoticeShown = false;
  /** The video the page is on right now, read live rather than from the 2s
   * session watcher. A line is processed across several awaits (word
   * extraction, target pick, stats) and the video can change under it; that
   * line belongs to the video it was spoken on, so a card or a Lens render for
   * it must not land on the next one. Same bleed as issue #125, one gate
   * further in than the dropped `queuedLine` — and the watcher's poll is too
   * slow to catch it, since a line can finish well inside those 2 seconds. */
  function currentSessionId(): string {
    const a = adapter;
    return a ? sessionIdentity(platformForAdapter(a), studyLang()) : location.pathname;
  }

  // Adapters can start matching late (e.g. Crunchyroll's player iframe creates
  // its <video> well after document_idle), so keep looking until one matches.
  function pickAdapter(): SiteAdapter | null {
    if (adapter) return adapter;
    adapter = adapters.find((a) => a.matches()) || null;
    if (adapter && !started) {
      started = true;
      log("adapter chosen:", adapter.name);
      adapter.start(onLine, clearLensLine);
      // Load kuromoji and the dictionary now, not on the first subtitle line:
      // lazily, the first lines of every episode waited seconds for a cold
      // dictionary load before anything could appear.
      void ensureInit();
    }
    return adapter;
  }

  function ensureInit(): Promise<void> {
    if (initialized || pipelineDisabled) return Promise.resolve();
    // One load, however many callers: the Lens and the card pipeline both ask
    // on the first line, and two concurrent inits would load everything twice.
    if (!initPromise) initPromise = runInit().finally(() => { initPromise = null; });
    return initPromise;
  }

  async function runInit(): Promise<void> {
    try {
      settings = await storage.getSettings();
      setAdapterDirection(normalizeDirection(settings.learningDirection));
      wordStates = await storage.getVocab();
      initialized = true;
      startWatchInterval();
    } catch (err) {
      pipelineDisabled = true;
      warn("pipeline init failed:", err);
      return;
    }
    // Japanese path needs kuromoji + JMdict; English path tokenizes locally.
    if (normalizeDirection(settings.learningDirection) === "en-ja") await ensureJa();
  }

  /**
   * kuromoji and the dictionary, loaded on demand and retried after a failure.
   *
   * These used to load only at init, and only if the learner was studying
   * Japanese at that moment: switching direction mid-tab left the Lens and the
   * cards dead until a reload, and one failed kuromoji load disabled the whole
   * pipeline for the tab although both loaders were written to be retried.
   */
  function ensureJa(): Promise<boolean> {
    if (jaReady) return Promise.resolve(true);
    if (jaPromise) return jaPromise;
    if (Date.now() - jaFailedAt < JA_RETRY_MS) return Promise.resolve(false);
    jaPromise = (async () => {
      try {
        await tokenizer.init();
        const data = await dict.load();
        const entries = Object.keys(data).length;
        if (!entries) throw new Error("dictionary is empty");
        log("dictionary loaded:", entries, "entries");
        jaReady = true;
      } catch (err) {
        jaFailedAt = Date.now();
        warn("japanese resources failed to load, will retry:", err);
      } finally {
        jaPromise = null;
      }
      return jaReady;
    })();
    return jaPromise;
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
      // Timestamp/text pairs repeat from zero across episodes. Clear before
      // publishing the new key so an opening cue cannot hit the old ledger.
      cachePollGeneration += 1;
      emittedCueKeys.clear();
      cacheKey = next;
      chrome.runtime.sendMessage({ type: "avc-update-cache-key", key: cacheKey }).catch(() => {});
    }
  }

  async function pollCacheHit(): Promise<void> {
    if (!listeningActive || !cacheKey) return;
    const a = pickAdapter();
    const video = a?.getVideo();
    if (!video || video.paused) return;
    const requestedKey = cacheKey;
    const generation = cachePollGeneration;
    if (cachePollInFlight === generation) return;
    const stale = (): boolean =>
      !listeningActive || cachePollGeneration !== generation || cacheKey !== requestedKey;
    cachePollInFlight = generation;
    try {
      settings = await storage.getSettings();
      if (stale()) return;
      const syncToken = await storage.getSyncToken();
      if (!syncToken || stale()) return;

      const t = video.currentTime;
      // Narrow window: the default 8s window returned the NEXT eight seconds
      // of dialogue, so cards popped for lines the learner hadn't heard yet.
      const result = await lookupTranscript(syncToken, requestedKey, t, 2);
      // A key change or stop/restart clears the cue ledger while this request is
      // in flight. Never let the old response refill it or emit stale dialogue.
      if (stale()) return;
      if (!result.hit || !result.segments.length) return;
      for (const seg of result.segments) {
        if (stale()) return;
        if (seg.start > t) continue; // still in the future \u2014 don't spoil it
        const key = `${seg.start}:${seg.text}`;
        if (!emittedCueKeys.remember(key)) continue;
        const lang = studyLang();
        if (lang === "ja" && !/[\u3040-\u30FF\u4E00-\u9FFF]/.test(seg.text)) continue;
        if (lang === "en" && !/[A-Za-z]{2,}/.test(seg.text)) continue;
        const en = a ? contextForAudio(a, seg.start) : "";
        onLine(seg.text, { en, fromAudio: true }, { lens: audioLineIsCurrent(video, seg.start, seg.end) });
      }
    } catch (err) {
      warn("cache poll failed:", err);
    } finally {
      // A stale request must never unlock a newer generation's active poll.
      if (cachePollInFlight === generation) cachePollInFlight = null;
    }
  }

  function startCachePolling(): void {
    if (cachePollTimer) return;
    cachePollGeneration += 1;
    refreshCacheKey();
    cachePollTimer = setInterval(() => {
      pollCacheHit().catch((err) => warn("cache poll error:", err));
    }, 800);
  }

  function stopCachePolling(): void {
    cachePollGeneration += 1;
    if (cachePollTimer) clearInterval(cachePollTimer);
    cachePollTimer = null;
    emittedCueKeys.clear();
  }

  /** Sample the on-screen context subtitle while Listening Mode is on. */
  function startContextSampling(): void {
    if (contextSampleTimer) return;
    contextSubs.clear();
    contextSampleTimer = setInterval(() => {
      const a = adapter;
      const video = a?.getVideo();
      if (!a || !video) return;
      contextSubs.record(video.currentTime, a.getVisibleText());
    }, 200);
  }

  function stopContextSampling(): void {
    if (contextSampleTimer) clearInterval(contextSampleTimer);
    contextSampleTimer = null;
    contextSubs.clear();
  }

  /** The context subtitle for a line heard from the audio at `start` (video
   * seconds), or what is on screen now when the start is unknown. */
  function contextForAudio(a: SiteAdapter, start: number | undefined): string {
    if (typeof start === "number") {
      const at = contextSubs.textAt(start);
      if (at !== null) return at;
    }
    return a.getVisibleText();
  }

  /**
   * Whether a line heard from the audio is still current enough to mirror.
   *
   * A transcript lands seconds after the words were spoken — a realtime
   * utterance once the speaker stops, a cached chunk once the whole chunk is
   * back. The Lens is a subtitle: showing a line from a scene that has already
   * passed is worse than showing none, so late ones go to the card pipeline
   * only.
   */
  function audioLineIsCurrent(
    video: HTMLVideoElement | null,
    start: number | undefined,
    end?: number
  ): boolean {
    if (!video) return true;
    // Time since the line finished is the honest measure: a long line that
    // ended a moment ago is current, however long ago it began.
    if (typeof end === "number") return video.currentTime - end < AUDIO_LENS_MAX_LAG_AFTER_END_SEC;
    if (typeof start === "number") return video.currentTime - start < AUDIO_LENS_MAX_LAG_SEC;
    return true;
  }

  function startPlaybackRelay(): void {
    if (playbackRelayTimer) return;
    startContextSampling();
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
    stopContextSampling();
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

  function lensOn(s: Settings): boolean {
    return normalizeDirection(s.learningDirection) === "en-ja" && s.subLens !== false;
  }

  function siteEnabled(s: Settings): boolean {
    const siteKey = adapter ? adapter.name : "generic";
    return !(s.sites && s.sites[siteKey] === false);
  }

  async function tokenizeJa(text: string): Promise<Token[]> {
    if (tokenMemo && tokenMemo.text === text) return tokenMemo.tokens;
    const tokens = await tokenizer.tokenize(text);
    tokenMemo = { text, tokens };
    return tokens;
  }

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

  async function handleCard(
    target: Target,
    sentence: string,
    tokens: Token[],
    context?: LineContext,
    shouldCancel?: () => boolean
  ): Promise<void> {
    const video = adapter ? adapter.getVideo() : null;

    settings = await storage.getSettings();
    if (shouldCancel?.()) return;
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

    if (shouldCancel?.()) return;
    targetedThisSession.add(target.token.base);
    // Mount the card synchronously before recording it as shown. This closes
    // the last cancellation window where a Lens click could prevent the card
    // from appearing after its shown-count and cooldown timestamp were saved.
    const judgmentPromise = overlay.showAgentPanel(target, sentence, video, cardOptions);
    await storage.recordCardShown(target.token.base);
    const judgment = await judgmentPromise;

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

  /**
   * Mirror a subtitle line in the Subtitle Lens, now.
   *
   * This used to happen inside the card pipeline below, which holds a line for
   * a word-picking round-trip and then for the card's whole lifetime — up to
   * 45 seconds. Every line spoken meanwhile queued behind it, so the Lens sat
   * on a line from scenes ago and caught up only when the card closed. The Lens
   * needs nothing but a local tokenization, so it runs on its own, newest line
   * wins, and the cards keep their one-at-a-time pacing.
   */
  async function renderLens(line: string, context?: LineContext): Promise<void> {
    const seq = ++lensSeq;
    const sessionId = currentSessionId();
    const stale = (): boolean => seq !== lensSeq || currentSessionId() !== sessionId;
    const current = settings || (await storage.getSettings());
    if (stale()) return;
    if (!siteEnabled(current) || !lensOn(current)) {
      hideLens();
      return;
    }
    await ensureInit();
    if (!initialized || stale()) return;
    if (!(await ensureJa()) || stale()) return;
    const tokens = await tokenizeJa(line);
    if (stale() || !tokens.length) return;
    showLensLine(line, context?.en || "", tokens, wordStates, {
      peekPause: current.subLensPeek !== false,
      getVideo: () => (adapter ? adapter.getVideo() : null),
      getTitle: currentTitle,
      onJudgeStart: () => {
        lensJudgedLine = line;
        // A deliberate Lens action wins over an automatic card, including one
        // that opened while the user was hovering.
        overlay.dismissAgent();
      },
      onJudged: () => { void refreshState(); },
    });
  }

  /**
   * Subtitle lines arrive faster than a line takes to process, and processing
   * now makes background round-trips (word extraction, word picking) before it
   * decides anything. Left unserialized, several lines could each clear the
   * `overlay.isOpen()` check while the others were awaiting, each spend quota,
   * and then each replace the previous card — `presentWord()` dismisses whatever
   * is up. So: one line in flight at a time, and while one is running only the
   * newest arrival is held. Older queued lines are dropped on purpose; their
   * moment on screen has passed, and showing a card for them would be wrong
   * even if it were free.
   *
   * Returns immediately: nothing a caller does next should wait on a card.
   */
  function onLine(text: string, context?: LineContext, opts: { lens?: boolean } = {}): void {
    if (pipelineDisabled) return;
    const line = text.replace(/\s+/g, " ").trim();
    if (!line) return;
    if (opts.lens !== false) {
      renderLens(line, context).catch((err) => warn("sub-lens render failed:", err));
    }
    queuedLine = { text: line, context };
    if (!lineInFlight) void drainLines();
  }

  async function drainLines(): Promise<void> {
    lineInFlight = true;
    try {
      while (queuedLine) {
        const next = queuedLine;
        queuedLine = null;
        try {
          await processLine(next.text, next.context);
        } catch (err) {
          warn("line processing failed:", err);
        }
      }
    } finally {
      lineInFlight = false;
    }
  }

  async function processLine(text: string, context?: LineContext): Promise<void> {
    // Read once: every `staleSession()` below asks whether the video has changed
    // since this line was spoken, not since the last await.
    const lineSessionId = currentSessionId();
    const staleSession = (): boolean => {
      if (currentSessionId() === lineSessionId) return false;
      log("dropped line from the previous video:", text.slice(0, 40));
      return true;
    };

    settings = await storage.getSettings();
    if (staleSession()) return;
    if (!siteEnabled(settings)) return;

    const direction = normalizeDirection(settings.learningDirection);
    setAdapterDirection(direction);
    const lensEnabled = lensOn(settings);
    // With both the Lens and automatic cards off there is nothing to feed, not
    // even exposure counts — the learner asked for a quiet screen.
    if (settings.pauseMode === "off" && !lensEnabled) return;

    await ensureInit();
    if (!initialized) return;

    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized === lastLine) return;
    lastLine = normalized;

    let tokens: Token[];
    let dictOverlay: Record<string, DictEntry> | null = null;
    // includes(): a transcript is mirrored whole but carded sentence by sentence.
    const lensJudged = (): boolean => !!lensJudgedLine && lensJudgedLine.includes(normalized);

    if (direction === "ja-en") {
      tokens = tokenizeEnglish(normalized);
      const extracted = await requestExtractWords({
        line: normalized,
        direction,
        learnerLevel: settings.targetLevel,
        title: currentTitle(),
      });
      if (!extracted.ok && extracted.error === "auto_quota_exhausted") {
        void overlay.reportLimitReached("auto");
      }
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
      if (!(await ensureJa())) return;
      // The Lens (renderLens) mirrored this line already, off the same memo.
      tokens = await tokenizeJa(normalized);
    }

    if (staleSession()) return;

    await storage.recordSeen(tokens, wordStates, targetedThisSession, direction, dictOverlay);
    wordStates = await storage.getVocab();
    if (lensJudged() || staleSession()) return;
    if (settings.pauseMode === "off") return;
    if (overlay.isClosedByUser()) return; // they closed the copilot; cards live in it

    if (overlay.isOpen()) {
      log("skipped line (word card still open):", normalized.slice(0, 40));
      return;
    }
    // A new card resets the copilot chat to its word. Never mid-conversation.
    if (overlay.isChatEngaged()) {
      log("skipped line (learner is chatting with the copilot):", normalized.slice(0, 40));
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
    if (lensJudged() || staleSession()) return;
    if (!target) { log("no target word in:", normalized); return; }

    // pickTargetSmart just awaited a network round-trip; a card may have opened
    // in the meantime (a review can be triggered from the panel), or the
    // learner may have started typing to the copilot. Re-check rather than
    // trusting the read from before the await.
    if (overlay.isOpen() || overlay.isChatEngaged()) {
      log("skipped line (card opened or chat started while picking):", normalized.slice(0, 40));
      return;
    }

    const stats = await storage.getStats();
    if (lensJudged() || staleSession()) return;
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
        // This is a pacing *setting*, not a plan limit — but from the couch it
        // looks identical to the extension having died, so say so once per
        // hourly window and point at the knob that changes it.
        if (!hourlyCapNotified) {
          hourlyCapNotified = true;
          overlay.showToast(
            `Paused new words — you've hit your ${settings.maxCardsPerHour}/hour card limit. ` +
              `Reviews still appear. Raise it in Settings → Max cards per hour.`,
            "info"
          );
          // Re-arm once the oldest timestamp ages out of the rolling hour.
          const oldest = cardTimestamps[0] ?? now;
          setTimeout(() => { hourlyCapNotified = false; }, Math.max(60e3, oldest + 3600e3 - now));
        }
        return;
      }
    }
    log("showing card for:", target.token.base);

    // Awaited, so the in-flight gate covers the card's whole lifetime — not just
    // up to the moment it mounts. Previously this was fire-and-forget, leaving a
    // window where the next line was already picking a word before the card had
    // rendered and `overlay.isOpen()` could see it.
    await handleCard(target, normalized, tokens, context, lensJudged).catch((err) => {
      warn("handleCard failed:", err);
      overlay.dismissAgent();
    });
  }

  // Listening mode: the offscreen document transcribes this tab's audio and the
  // background forwards Japanese text here. Only the frame that owns the video
  // handles it (matters on sites whose player lives in an iframe).
  chrome.runtime.onMessage.addListener((msg: { type: string; text?: string; start?: number; end?: number; active?: boolean; kind?: string }, _sender, sendResponse) => {
    if (msg.type === "avc-toast") {
      overlay.showToast(msg.text || "", msg.kind === "error" ? "error" : "info");
      return;
    }
    if (msg.type === "avc-limit-reached") {
      void overlay.reportLimitReached((msg.kind as overlay.LimitKind) || "ai");
      return;
    }
    if (msg.type === "avc-get-cache-key") {
      refreshCacheKey();
      sendResponse({ key: cacheKey || null });
      return true;
    }
    if (msg.type === "avc-agent-show") {
      overlay.openAgent();
      sendResponse({ ok: true, visible: true });
      return true;
    }
    if (msg.type === "avc-agent-hide") {
      overlay.closeAgentByUser();
      sendResponse({ ok: true, visible: false });
      return true;
    }
    if (msg.type === "avc-agent-status") {
      sendResponse({ ok: true, visible: overlay.isAgentActive() });
      return true;
    }
    if (msg.type === "avc-caption-status") {
      const report = captionReport();
      sendResponse({ ok: true, report, detail: captionStatusDetail(report) });
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
    handleTranscript(msg.text || "", typeof msg.start === "number" ? msg.start : undefined,
      typeof msg.end === "number" ? msg.end : undefined);
  });

  /**
   * A line heard from the tab's audio (Listening Mode).
   *
   * `start`/`end` are video seconds when known. A warm cache answers for the
   * whole chunk ahead, so a line can arrive before it is spoken; it waits for
   * its moment rather than spoiling it. A line that arrives long after it was
   * spoken goes to the cards but not the Lens (see audioLineIsCurrent).
   */
  function handleTranscript(text: string, start: number | undefined, end: number | undefined): void {
    const a = pickAdapter();
    if (!a) { warn("transcript arrived but no adapter matched this frame"); return; }
    const video = a.getVideo();
    if (!video) { log("transcript ignored (no video in this frame)"); return; }
    const rawTranscript = text.trim();
    if (pipelineDisabled || !rawTranscript) return;

    const ahead = typeof start === "number" ? start - video.currentTime : 0;
    if (ahead > EARLY_LINE_TOLERANCE_SEC) {
      if (ahead > MAX_EARLY_HOLD_SEC) return; // a seek or a stale window; the cache poll covers it
      const sessionId = currentSessionId();
      const generation = cachePollGeneration;
      setTimeout(() => {
        if (currentSessionId() !== sessionId || cachePollGeneration !== generation) return;
        handleTranscript(text, start, end);
      }, (ahead * 1000) / (video.playbackRate || 1));
      return;
    }

    log("transcript received:", rawTranscript);
    if (typeof start === "number" && !emittedCueKeys.remember(`${start}:${rawTranscript}`)) return;
    const context: LineContext = { en: contextForAudio(a, start), fromAudio: true };
    // The Lens shows the utterance whole, the way a subtitle would, and only
    // while it is still the scene on screen.
    if (audioLineIsCurrent(video, start, end)) {
      renderLens(rawTranscript.replace(/\s+/g, " "), context).catch((err) => warn("sub-lens render failed:", err));
    }
    const direction = normalizeDirection(settings?.learningDirection);
    const segments = rawTranscript
      .split(direction === "ja-en" ? /(?<=[.!?])\s+/ : /(?<=[。！？])/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const seg of segments) onLine(seg, context, { lens: false });
  }

  /**
   * Say something when the video has no usable study-language captions.
   *
   * Cards just stopped appearing on those clips while Listening Mode could
   * still read as active, so the extension looked dead (issue #128). One notice
   * per video, and none at all when Listening Mode is already covering for the
   * missing captions or when nothing was going to read them anyway.
   */
  async function maybeExplainMissingCaptions(): Promise<void> {
    if (captionNoticeShown) return;
    const report = captionReport();
    if (report.state !== "missing") return;
    let current: Settings;
    try {
      current = await storage.getSettings();
    } catch {
      return;
    }
    const direction = normalizeDirection(current.learningDirection);
    const text = captionNoticeText(report, {
      listening: listeningActive,
      cardsOn: current.pauseMode !== "off",
      lensOn: direction === "en-ja" && current.subLens !== false,
    });
    if (!text) return;
    captionNoticeShown = true;
    overlay.showToast(text, "info");
  }

  onCaptions(() => {
    void maybeExplainMissingCaptions();
  });

  // Settings apply the moment they change — from the popup, the copilot's own
  // controls, or the options page — instead of at the next subtitle line.
  // Turning the Lens off has to take it off the screen now.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.settings) return;
    storage.getSettings().then((next) => {
      settings = next;
      setAdapterDirection(normalizeDirection(next.learningDirection));
      if (!lensOn(next) || !siteEnabled(next)) hideLens();
      overlay.applyPanelSettings(next);
    }).catch(() => {});
  });

  /**
   * The 🎉 first-card moment (#77), shown where the learner actually is: on the
   * episode, a beat after they saved the word.
   *
   * Driven off the storage change rather than the judgment call sites, so it
   * covers both ways to mine — the copilot card and a Subtitle Lens click —
   * without either of them knowing about onboarding. The stamp is write-once,
   * so this fires exactly once per install.
   */
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const change = changes[ONBOARDING_STORAGE_KEY];
    if (!change) return;
    if (!isFirstCardTransition(change.oldValue, change.newValue)) return;
    overlay.showToast("\u{1F389} First card saved. It comes back for review on its own.", "info", {
      label: "Open review dashboard",
      onClick: () => {
        chrome.runtime
          .sendMessage({ type: "avc-open-url", url: chrome.runtime.getURL("dashboard/dashboard.html") })
          .catch(() => {});
      },
    });
  });

  /**
   * Put the tab's session back together after a reload.
   *
   * Listening Mode lives in the background and the offscreen document, so it
   * survives a refresh that wipes this script and the Copilot panel with it.
   * That left Listening "Live" next to a closed Copilot and no word panel
   * (issue #126). Ask what this tab was doing and restore both sides.
   */
  async function restoreTabSession(): Promise<void> {
    let state: { listening?: boolean; copilot?: boolean } | undefined;
    try {
      state = await chrome.runtime.sendMessage({ type: "avc-session-state" });
    } catch {
      return; // background asleep or extension reloading; nothing to restore
    }
    if (!state) return;
    if (state.copilot) overlay.openAgent();
    if (state.listening && !listeningActive) {
      log("restoring listening session after reload");
      listeningActive = true;
      startCachePolling();
      startPlaybackRelay();
      void maybeExplainMissingCaptions();
    }
  }

  // Keep the background's per-tab record of the panel honest, however the
  // panel was opened or closed, so the next reload restores what was there.
  overlay.onAgentVisibility((open) => {
    chrome.runtime.sendMessage({ type: "avc-copilot-state", open }).catch(() => {});
  });

  pickAdapter();
  const pickTimer = setInterval(() => {
    if (pickAdapter()) clearInterval(pickTimer);
  }, 2000);

  setInterval(() => {
    pickAdapter();
    const sid = currentSessionId();
    if (sid !== lastSessionId) {
      lastSessionId = sid;
      targetedThisSession.clear();
      lastLine = "";
      hideLens();
      // A card and a queued line belong to the video they came from. Advancing
      // a playlist used to leave both standing, so the new video opened with
      // the previous clip's word on screen (issue #125).
      overlay.dismissAgent();
      queuedLine = null;
      lensJudgedLine = "";
      contextSubs.clear();
      emittedCueKeys.clear();
      lastContextTitle = "";
      resetCaptions();
      captionNoticeShown = false;
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

  void restoreTabSession();
})();
