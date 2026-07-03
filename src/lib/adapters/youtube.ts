import { log, warn } from "../log";
import { normalize, hasJapanese } from "./util";
import { uploadSubtitlePrefill } from "../prefill-cache";
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

// --- Hidden caption-track mode (primary): the Japanese track is fetched and
// synced to playback even while the viewer displays English subs.
let jaCues: Cue[] = [];
let enCues: Cue[] = [];
let currentVideoId = "";
let lastCueKey = "";
let attachedVideo: HTMLVideoElement | null = null;

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
  // YouTube now returns an empty 200 body unless the request carries a
  // Proof-of-Origin token, which content scripts can't produce. Treat empty
  // as "no captions available" rather than an error.
  if (!text) return [];
  return parseJson3(JSON.parse(text));
}

function pickTrack(tracks: CaptionTrackMsg["tracks"], langPrefix: string) {
  const matches = tracks.filter((t) => (t.languageCode || "").startsWith(langPrefix));
  return matches.find((t) => t.kind !== "asr") || matches[0] || null;
}

async function handleTracks(msg: CaptionTrackMsg): Promise<void> {
  if (msg.videoId === currentVideoId) return;
  currentVideoId = msg.videoId;
  jaCues = [];
  enCues = [];
  lastCueKey = "";

  const jaTrack = pickTrack(msg.tracks, "ja");
  if (!jaTrack) {
    log("youtube: no Japanese caption track on this video — DOM fallback only");
    return;
  }
  try {
    jaCues = await fetchTrack(jaTrack);
  } catch (err) {
    jaCues = [];
  }
  if (!jaCues.length) {
    log("youtube: hidden caption track unavailable (YouTube blocks silent fetches). " +
      "Use Listening Mode from the toolbar, or turn on Japanese captions to read them from the page.");
    return;
  }
  log(`youtube: loaded ${jaCues.length} Japanese cues (${jaTrack.kind === "asr" ? "auto-generated" : "manual"})`);
  uploadSubtitlePrefill("youtube", jaCues.map((c) => ({ start: c.start, end: c.end, text: c.text })))
    .catch((err) => warn("youtube prefill error:", err));
  const enTrack = pickTrack(msg.tracks, "en");
  if (enTrack) {
    try {
      enCues = await fetchTrack(enTrack);
      log(`youtube: loaded ${enCues.length} English cues for context`);
    } catch (err) {
      enCues = [];
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
  if (!jaCues.length || !onLineCb || !attachedVideo) return;
  const t = attachedVideo.currentTime;
  const cue = cueAt(jaCues, t);
  if (!cue) return;
  const key = `${cue.start}:${cue.text}`;
  if (key === lastCueKey) return;
  lastCueKey = key;
  if (!hasJapanese(cue.text)) return;
  const enCue = cueAt(enCues, (cue.start + cue.end) / 2);
  onLineCb(cue.text, { en: enCue ? enCue.text : "" });
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
  // Whatever subtitle is on screen right now, any language — used as
  // human-readable context alongside audio transcripts.
  getVisibleText,
  start(onLine) {
    onLineCb = onLine;

    window.addEventListener("message", (e: MessageEvent) => {
      if (e.source !== window) return;
      if (e.data?.source !== "avc" || e.data.type !== "avc-caption-tracks") return;
      handleTracks(e.data as CaptionTrackMsg).catch((err) => warn("youtube tracks error:", err));
    });

    // (Re)attach the cue-sync listener; the video element is replaced on SPA nav.
    setInterval(() => {
      const v = getVideo();
      if (v && v !== attachedVideo) {
        if (attachedVideo) attachedVideo.removeEventListener("timeupdate", onTimeUpdate);
        attachedVideo = v;
        v.addEventListener("timeupdate", onTimeUpdate);
      }
    }, 2000);

    // --- DOM-scraping fallback: only when no ja track could be loaded
    // (e.g. the viewer displays Japanese subs on a video without track data).
    let lastText = "";
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      try {
        if (jaCues.length) return; // track mode active — avoid double-firing
        const text = getVisibleText();
        if (!text || text === lastText) return;
        if (!hasJapanese(text)) return;
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
  }
};
