import { log, warn } from "../log";
import { coalesce, normalize, hasJapanese, matchesTargetScript, getAdapterDirection, setAdapterDirection } from "./util";
import { audioLang, contextLang, normalizeDirection } from "../direction";
import { deriveContentId } from "../cache-key";
import { reportCaptions, resetCaptions } from "../caption-status";
import { buildSentenceCues, parseJson3Words, RollingCaption } from "../cue-sentences";
import { trackUrl, type PotInfo } from "../youtube-pot";
import type { LineContext, SiteAdapter } from "../../types";

interface Cue {
  start: number;
  end: number;
  text: string;
}

interface CaptionTrackMsg {
  videoId: string;
  /** Whether the player shows captions right now; null or absent if unknown. */
  captionsOn?: boolean | null;
  tracks: { baseUrl: string; languageCode: string; kind: string }[];
}

type OnLine = (text: string, context: LineContext) => void;

/**
 * How long the on-page caption node is treated as untrustworthy after the video
 * changes. YouTube swaps the video before it repaints captions, so for a beat
 * the visible line still belongs to the clip that just ended. Reading it raised
 * a card for the previous video's word (issue #125). One skipped line at the
 * start of a video beats a wrong word.
 */
const CAPTION_SETTLE_MS = 1000;
/** How long a track load waits for the player's caption token on its own
 * before asking the page script to make the player request captions. */
const POT_WAIT_MS = 1500;
/** How long it then waits for the primed request to hand the token over. */
const POT_PRIME_WAIT_MS = 5000;

let onLineCb: OnLine | null = null;
let onClearCb: (() => void) | null = null;

// Hidden caption-track mode: study-language track is fetched and synced to
// playback even while the viewer displays the other language.
let targetCues: Cue[] = [];
let contextCues: Cue[] = [];
/** The video the loaded cues belong to. Compared against the URL's id on every
 * timeupdate: YouTube swaps the video under us on a playlist advance, and the
 * new player response can lag seconds behind, so cues outlive their video. */
let currentVideoId = "";
let lastCueKey = "";
let attachedVideo: HTMLVideoElement | null = null;
let loadedForDirection = "";
/** Caption tokens by video id (lib/youtube-pot). */
const pots = new Map<string, PotInfo>();
const potWaiters = new Set<() => void>();
/** The last track list, kept so a late token can retry an empty load. */
let lastTracks: CaptionTrackMsg | null = null;
/** Videos whose load came back empty without a token. */
const emptyWithoutPot = new Set<string>();
/** Newest track load. The page posts the track list more than once per video,
 * and a load now waits seconds for a token, so an older one must stand down. */
let loadGeneration = 0;
let loadingKey = "";

function notePot(info: PotInfo): void {
  pots.set(info.videoId, info);
  if (pots.size > 20) pots.delete(pots.keys().next().value!);
  for (const wake of [...potWaiters]) wake();
  // A load that already gave up for want of a token gets one more go.
  if (emptyWithoutPot.delete(info.videoId) && lastTracks?.videoId === info.videoId) {
    loadedForDirection = "";
    handleTracks(lastTracks).catch((err) => warn("youtube tracks retry error:", err));
  }
}

/** The token for `videoId`, waiting up to `ms` for one to arrive. */
function waitForPot(videoId: string, ms: number): Promise<PotInfo | null> {
  const have = pots.get(videoId);
  if (have || ms <= 0) return Promise.resolve(have || null);
  return new Promise((resolve) => {
    const done = (): void => {
      const got = pots.get(videoId);
      if (!got && Date.now() < deadline) return;
      clearTimeout(timer);
      potWaiters.delete(done);
      resolve(got || null);
    };
    const deadline = Date.now() + ms;
    const timer = setTimeout(done, ms);
    potWaiters.add(done);
  });
}

function urlVideoId(): string {
  return deriveContentId("youtube") || "";
}

/**
 * Forget cues that belong to a video we are no longer watching.
 *
 * Without this, advancing a playlist kept feeding the previous clip's cues
 * against the new video's clock: cards and the Subtitle Lens showed words from
 * the last video, which is issue #125. Returns true when cues were dropped.
 */
function dropCuesFromOtherVideo(): boolean {
  const id = urlVideoId();
  if (!currentVideoId || !id || id === currentVideoId) return false;
  log("youtube: video changed to", id, "- dropping", targetCues.length, "stale cues");
  targetCues = [];
  contextCues = [];
  lastCueKey = "";
  currentVideoId = "";
  loadedForDirection = "";
  loadingKey = "";
  loadGeneration += 1;
  resetCaptions();
  return true;
}

interface Json3Event {
  tStartMs: number;
  dDurMs?: number;
  segs?: { utf8?: string }[];
}

function parseJson3(data: { events?: Json3Event[] }): Cue[] {
  const cues: Cue[] = [];
  for (const ev of data.events || []) {
    if (!ev.segs) continue;
    const text = normalize(ev.segs.map((s) => s.utf8 || "").join(""));
    if (!text) continue;
    const start = ev.tStartMs / 1000;
    cues.push({ start, end: start + (ev.dDurMs || 3000) / 1000, text });
  }
  cues.sort((a, b) => a.start - b.start);
  return cues;
}

async function fetchTrack(
  track: { baseUrl: string; kind: string },
  pot: PotInfo | null,
  lang: "ja" | "en"
): Promise<Cue[]> {
  const res = await fetch(trackUrl(track.baseUrl, pot, location.origin));
  if (!res.ok) throw new Error(`timedtext HTTP ${res.status}`);
  const text = await res.text();
  if (!text) return [];
  const data = JSON.parse(text);
  // Auto-generated tracks are rolling word windows, not lines: regroup the
  // words into sentences so a cue is what is being said (lib/cue-sentences).
  return track.kind === "asr" ? buildSentenceCues(parseJson3Words(data), lang) : parseJson3(data);
}

/** The player's caption token for this video: wait for the one it makes on
 * its own, then ask the page script to make it request captions. */
async function potFor(videoId: string, captionsOn: boolean | null | undefined): Promise<PotInfo | null> {
  // Captions off: the player will not ask for them, so waiting is dead time.
  const early = await waitForPot(videoId, captionsOn === false ? 0 : POT_WAIT_MS);
  if (early) return early;
  window.postMessage({ source: "avc", type: "avc-prime-captions", videoId }, "*");
  return waitForPot(videoId, POT_PRIME_WAIT_MS);
}

function pickTrack(tracks: CaptionTrackMsg["tracks"], langPrefix: string) {
  const matches = tracks.filter((t) => (t.languageCode || "").startsWith(langPrefix));
  return matches.find((t) => t.kind !== "asr") || matches[0] || null;
}

async function handleTracks(msg: CaptionTrackMsg): Promise<void> {
  const direction = getAdapterDirection();
  lastTracks = msg;
  const dirKey = `${msg.videoId}:${direction}`;
  if (dirKey === currentVideoId + ":" + loadedForDirection && (targetCues.length || loadingKey === dirKey)) return;
  const generation = ++loadGeneration;
  const superseded = (): boolean => generation !== loadGeneration;
  currentVideoId = msg.videoId;
  loadedForDirection = direction;
  targetCues = [];
  contextCues = [];
  lastCueKey = "";

  const study = audioLang(direction);
  const ctx = contextLang(direction);
  const studyTrack = pickTrack(msg.tracks, study);
  if (!studyTrack) {
    log(`youtube: no ${study} caption track on this video, DOM fallback only`);
    reportCaptions({ state: "missing", lang: study, reason: "no-track" });
    return;
  }
  loadingKey = dirKey;
  let pot: PotInfo | null = null;
  let cues: Cue[] = [];
  try {
    pot = await potFor(msg.videoId, msg.captionsOn);
    // The video may have changed while we waited for the token.
    if (superseded()) return;
    cues = await fetchTrack(studyTrack, pot, study);
  } catch {
    cues = [];
  } finally {
    if (!superseded()) loadingKey = "";
  }
  if (superseded()) return;
  targetCues = cues;
  if (!targetCues.length) {
    if (!pot) emptyWithoutPot.add(msg.videoId);
    log(
      `youtube: hidden ${study} caption track unavailable. ` +
        "Use Listening Mode from the toolbar, or turn on matching captions to read them from the page."
    );
    reportCaptions({ state: "missing", lang: study, reason: "empty-track" });
    return;
  }
  log(
    `youtube: loaded ${targetCues.length} ${study} cues (${studyTrack.kind === "asr" ? "auto-generated" : "manual"})`
  );
  reportCaptions({ state: "ok", lang: study, autoGenerated: studyTrack.kind === "asr" });
  const ctxTrack = pickTrack(msg.tracks, ctx);
  if (ctxTrack) {
    try {
      contextCues = await fetchTrack(ctxTrack, pot, ctx);
      log(`youtube: loaded ${contextCues.length} ${ctx} cues for context`);
    } catch {
      contextCues = [];
    }
  }
}

function cueAt(cues: Cue[], t: number): Cue | null {
  for (const cue of cues) {
    if (t >= cue.start && t <= cue.end) return cue;
    if (cue.start > t) break;
  }
  return null;
}

function onTimeUpdate(): void {
  if (dropCuesFromOtherVideo()) return;
  if (!targetCues.length || !onLineCb || !attachedVideo) return;
  const t = attachedVideo.currentTime;
  const cue = cueAt(targetCues, t);
  if (!cue) {
    // Between cues: the line we mirrored has ended.
    if (lastCueKey) {
      lastCueKey = "";
      onClearCb?.();
    }
    return;
  }
  const key = `${cue.start}:${cue.text}`;
  if (key === lastCueKey) return;
  lastCueKey = key;
  if (!matchesTargetScript(cue.text, getAdapterDirection())) return;
  const ctxCue = cueAt(contextCues, (cue.start + cue.end) / 2);
  onLineCb(cue.text, { en: ctxCue ? ctxCue.text : "" });
}

function getVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("#movie_player video, video.html5-main-video");
}

function getVisibleText(): string {
  const segs = document.querySelectorAll(".ytp-caption-segment");
  return normalize(Array.from(segs).map((s) => s.textContent || "").join(" "));
}

export const youtubeAdapter: SiteAdapter = {
  name: "youtube",
  matches() {
    return location.hostname.endsWith("youtube.com");
  },
  getVideo,
  getVisibleText,
  start(onLine, onClear) {
    onLineCb = onLine;
    onClearCb = onClear || null;

    window.addEventListener("message", (e: MessageEvent) => {
      if (e.source !== window || e.data?.source !== "avc") return;
      if (e.data.type === "avc-timedtext-pot" && typeof e.data.pot === "string" && typeof e.data.videoId === "string") {
        notePot({ videoId: e.data.videoId, pot: e.data.pot, c: String(e.data.c || "WEB"), cver: String(e.data.cver || "") });
        return;
      }
      if (e.data.type !== "avc-caption-tracks") return;
      handleTracks(e.data as CaptionTrackMsg).catch((err) => warn("youtube tracks error:", err));
    });

    setInterval(() => {
      dropCuesFromOtherVideo();
      const v = getVideo();
      if (v && v !== attachedVideo) {
        if (attachedVideo) attachedVideo.removeEventListener("timeupdate", onTimeUpdate);
        attachedVideo = v;
        v.addEventListener("timeupdate", onTimeUpdate);
      }
    }, 2000);

    let lastText = "";
    let lastTextVideoId = "";
    let settleUntil = 0;
    // Auto-generated captions drawn on the page roll in word by word; those are
    // held until they settle (lib/cue-sentences). A caption that replaces the
    // last one outright still goes out at once.
    const roller = new RollingCaption();
    let rollTimer: ReturnType<typeof setInterval> | null = null;

    const flushRolling = (): void => {
      const line = roller.take(Date.now());
      if (line) onLine(line, { en: "" });
    };

    const check = () => {
      try {
        dropCuesFromOtherVideo();
        if (targetCues.length) return;
        const videoId = urlVideoId();
        if (videoId !== lastTextVideoId) {
          lastTextVideoId = videoId;
          // Bank the line that is on screen at the moment of the change as
          // already-seen: it is the previous video's, and clearing lastText
          // instead would let exactly that line card against the new video.
          lastText = getVisibleText();
          roller.reset();
          roller.markEmitted(lastText);
          settleUntil = Date.now() + CAPTION_SETTLE_MS;
          return;
        }
        if (Date.now() < settleUntil) return;
        const text = getVisibleText();
        if (text === lastText) return;
        if (!text || !matchesTargetScript(text, getAdapterDirection())) {
          // Not flushed: a line mirrored as the caption leaves would outstay it.
          roller.reset();
          if (lastText) onClear?.();
          lastText = "";
          return;
        }
        lastText = text;
        if (roller.continues(text)) {
          roller.update(text, Date.now());
          if (!rollTimer) {
            rollTimer = setInterval(() => {
              flushRolling();
              if (!targetCues.length && lastText) return;
              if (rollTimer) clearInterval(rollTimer);
              rollTimer = null;
            }, 200);
          }
          return;
        }
        roller.markEmitted(text);
        onLine(text, { en: "" });
      } catch (err) {
        warn("youtube adapter error:", err);
      }
    };

    const observer = new MutationObserver(coalesce(check, 50));

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  },
};

// Re-export for tests / callers that still import hasJapanese from youtube path.
export { hasJapanese, setAdapterDirection, normalizeDirection };
