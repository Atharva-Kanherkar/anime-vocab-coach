import { log, warn } from "../log";
import { normalize, hasJapanese, matchesTargetScript, getAdapterDirection, setAdapterDirection } from "./util";
import { audioLang, contextLang, normalizeDirection } from "../direction";
import type { LineContext, SiteAdapter } from "../../types";

interface Cue {
  start: number;
  end: number;
  text: string;
}

interface CaptionTrackMsg {
  videoId: string;
  tracks: { baseUrl: string; languageCode: string; kind: string }[];
}

type OnLine = (text: string, context: LineContext) => void;

let onLineCb: OnLine | null = null;

// Hidden caption-track mode: study-language track is fetched and synced to
// playback even while the viewer displays the other language.
let targetCues: Cue[] = [];
let contextCues: Cue[] = [];
let currentVideoId = "";
let lastCueKey = "";
let attachedVideo: HTMLVideoElement | null = null;
let loadedForDirection = "";

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

async function fetchTrack(track: { baseUrl: string }): Promise<Cue[]> {
  const url = new URL(track.baseUrl, location.origin);
  url.searchParams.set("fmt", "json3");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`timedtext HTTP ${res.status}`);
  const text = await res.text();
  if (!text) return [];
  return parseJson3(JSON.parse(text));
}

function pickTrack(tracks: CaptionTrackMsg["tracks"], langPrefix: string) {
  const matches = tracks.filter((t) => (t.languageCode || "").startsWith(langPrefix));
  return matches.find((t) => t.kind !== "asr") || matches[0] || null;
}

async function handleTracks(msg: CaptionTrackMsg): Promise<void> {
  const direction = getAdapterDirection();
  const dirKey = `${msg.videoId}:${direction}`;
  if (dirKey === currentVideoId + ":" + loadedForDirection && targetCues.length) return;
  currentVideoId = msg.videoId;
  loadedForDirection = direction;
  targetCues = [];
  contextCues = [];
  lastCueKey = "";

  const study = audioLang(direction);
  const ctx = contextLang(direction);
  const studyTrack = pickTrack(msg.tracks, study);
  if (!studyTrack) {
    log(`youtube: no ${study} caption track on this video — DOM fallback only`);
    return;
  }
  try {
    targetCues = await fetchTrack(studyTrack);
  } catch {
    targetCues = [];
  }
  if (!targetCues.length) {
    log(
      `youtube: hidden ${study} caption track unavailable. ` +
        "Use Listening Mode from the toolbar, or turn on matching captions to read them from the page."
    );
    return;
  }
  log(
    `youtube: loaded ${targetCues.length} ${study} cues (${studyTrack.kind === "asr" ? "auto-generated" : "manual"})`
  );
  const ctxTrack = pickTrack(msg.tracks, ctx);
  if (ctxTrack) {
    try {
      contextCues = await fetchTrack(ctxTrack);
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
  if (!targetCues.length || !onLineCb || !attachedVideo) return;
  const t = attachedVideo.currentTime;
  const cue = cueAt(targetCues, t);
  if (!cue) return;
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
  start(onLine) {
    onLineCb = onLine;

    window.addEventListener("message", (e: MessageEvent) => {
      if (e.source !== window) return;
      if (e.data?.source !== "avc" || e.data.type !== "avc-caption-tracks") return;
      handleTracks(e.data as CaptionTrackMsg).catch((err) => warn("youtube tracks error:", err));
    });

    setInterval(() => {
      const v = getVideo();
      if (v && v !== attachedVideo) {
        if (attachedVideo) attachedVideo.removeEventListener("timeupdate", onTimeUpdate);
        attachedVideo = v;
        v.addEventListener("timeupdate", onTimeUpdate);
      }
    }, 2000);

    let lastText = "";
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      try {
        if (targetCues.length) return;
        const text = getVisibleText();
        if (!text || text === lastText) return;
        if (!matchesTargetScript(text, getAdapterDirection())) return;
        lastText = text;
        onLine(text, { en: "" });
      } catch (err) {
        warn("youtube adapter error:", err);
      }
    };

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(check, 100);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  },
};

// Re-export for tests / callers that still import hasJapanese from youtube path.
export { hasJapanese, setAdapterDirection, normalizeDirection };
