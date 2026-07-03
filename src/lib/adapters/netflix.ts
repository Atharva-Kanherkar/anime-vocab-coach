import { log, warn } from "../log";
import { normalize, hasJapanese } from "./util";
import { uploadSubtitlePrefill } from "../prefill-cache";
import type { SiteAdapter, TranscriptSegment } from "../../types";

interface NetflixCue {
  start: number;
  end: number;
  text: string;
}

let jaCues: NetflixCue[] = [];
let lastCueKey = "";
let attachedVideo: HTMLVideoElement | null = null;
let onLineCb: ((text: string, ctx: { en: string }) => void) | null = null;

function getVisibleText(): string {
  const rows = document.querySelectorAll(".player-timedtext-text-container");
  return normalize(Array.from(rows).map((r) => r.textContent || "").join(" "));
}

/** Build cues from visible timed-text when Japanese subs are on screen. */
function scrapeVisibleJapaneseCues(): NetflixCue[] {
  const containers = document.querySelectorAll(".player-timedtext-text-container");
  const cues: NetflixCue[] = [];
  const video = document.querySelector<HTMLVideoElement>("video");
  const t = video?.currentTime ?? 0;
  for (const el of containers) {
    const text = normalize(el.textContent || "");
    if (!text || !hasJapanese(text)) continue;
    cues.push({ start: t, end: t + 4, text });
  }
  return cues;
}

function cueAt(cues: NetflixCue[], t: number): NetflixCue | null {
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
  onLineCb(cue.text, { en: getVisibleText() });
}

async function tryLoadJpTracks(): Promise<void> {
  // Netflix exposes timed-text only for the viewer-selected track in DOM.
  // When Japanese subs are available and selected (or forced via player), scrape them.
  const scraped = scrapeVisibleJapaneseCues();
  if (scraped.length) {
    jaCues = scraped;
    uploadSubtitlePrefill("netflix", scraped as TranscriptSegment[])
      .catch((err) => warn("netflix prefill error:", err));
    log(`netflix: scraped ${scraped.length} Japanese cues from timed text`);
  }
}

export const netflixAdapter: SiteAdapter = {
  name: "netflix",
  matches() {
    return location.hostname.endsWith("netflix.com");
  },
  getVideo() {
    return document.querySelector<HTMLVideoElement>("video");
  },
  getVisibleText,
  start(onLine) {
    onLineCb = onLine;
    jaCues = [];
    lastCueKey = "";

    window.addEventListener("message", (e: MessageEvent) => {
      if (e.source !== window) return;
      if (e.data?.source !== "avc" || e.data.type !== "avc-netflix-video-id") return;
      jaCues = [];
      lastCueKey = "";
    });

    setInterval(() => {
      const v = getVideo();
      if (v && v !== attachedVideo) {
        if (attachedVideo) attachedVideo.removeEventListener("timeupdate", onTimeUpdate);
        attachedVideo = v;
        v.addEventListener("timeupdate", onTimeUpdate);
      }
    }, 2000);

    setInterval(() => {
      tryLoadJpTracks().catch((err) => warn("netflix track load error:", err));
    }, 8000);

    let lastText = "";
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      try {
        if (jaCues.length) return;
        const text = getVisibleText();
        if (!text || text === lastText) return;
        if (!hasJapanese(text)) return;
        lastText = text;
        onLine(text, { en: "" });
      } catch (err) {
        warn("netflix adapter error:", err);
      }
    };

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(check, 100);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
};

function getVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("video");
}
