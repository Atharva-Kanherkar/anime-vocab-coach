// Runs in the PAGE (MAIN) world on youtube.com. It reads the current video's
// caption track list from the player API and posts it to the content script.
// The Japanese track exists even when the viewer displays English subs (or
// none), and that's what makes "watch with English, learn from Japanese" work.
//
// It also hands over the proof-of-origin token the player attaches to its own
// caption requests. Without it YouTube serves every track as an empty body
// (see lib/youtube-pot).
import { extractPot } from "../lib/youtube-pot";

interface YtPlayerElement extends HTMLElement {
  getPlayerResponse?: () => {
    videoDetails?: { videoId?: string };
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: { baseUrl: string; languageCode: string; kind?: string }[];
      };
    };
  };
  isSubtitlesOn?: () => boolean;
  toggleSubtitles?: () => void;
}

/** How long to leave captions switched on while waiting for the player's
 * caption request, when we switched them on ourselves. */
const PRIME_TIMEOUT_MS = 4000;

(function () {
  let lastPostedVideoId = "";
  const potVideos = new Set<string>();
  let priming = false;

  function player(): YtPlayerElement | null {
    return document.getElementById("movie_player") as YtPlayerElement | null;
  }

  function send(force: boolean): void {
    try {
      const p = player();
      if (!p || typeof p.getPlayerResponse !== "function") return;
      const resp = p.getPlayerResponse();
      const videoId = resp?.videoDetails?.videoId || "";
      if (!videoId || (!force && videoId === lastPostedVideoId)) return;
      const tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      lastPostedVideoId = videoId;
      window.postMessage({
        source: "avc",
        type: "avc-caption-tracks",
        videoId,
        // Off means the player will not request captions, so no token is
        // coming on its own and the content script can prime at once.
        captionsOn: subtitlesOn(p),
        tracks: tracks.map((t) => ({
          baseUrl: t.baseUrl,
          languageCode: t.languageCode,
          kind: t.kind || ""
        }))
      }, "*");
    } catch (err) { /* player not ready yet — the poll below retries */ }
  }

  /** Pass on the token from a caption request the player made. */
  function inspect(url: string): void {
    const hit = extractPot(url, location.origin);
    if (!hit || potVideos.has(hit.videoId + ":" + hit.pot)) return;
    potVideos.add(hit.videoId + ":" + hit.pot);
    window.postMessage({ source: "avc", type: "avc-timedtext-pot", ...hit }, "*");
  }

  // Resource timing sees every request the page makes, however the player
  // issued it, without wrapping fetch or XMLHttpRequest under YouTube's feet.
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes("/api/timedtext")) inspect(entry.name);
      }
    });
    observer.observe({ type: "resource", buffered: true });
  } catch { /* no resource timing: priming below can't help either */ }

  function subtitlesOn(p: YtPlayerElement): boolean | null {
    if (typeof p.isSubtitlesOn === "function") return p.isSubtitlesOn();
    const button = document.querySelector(".ytp-subtitles-button");
    return button ? button.getAttribute("aria-pressed") === "true" : null;
  }

  function toggle(p: YtPlayerElement): boolean {
    if (typeof p.toggleSubtitles === "function") { p.toggleSubtitles(); return true; }
    const button = document.querySelector<HTMLElement>(".ytp-subtitles-button");
    if (!button) return false;
    button.click();
    return true;
  }

  /**
   * Get the player to request captions once, so it mints the token.
   *
   * The player only asks for captions while they are switched on. When they
   * are off we switch them on, wait for the request, and switch them back off,
   * so the learner's caption setting ends up where it started.
   */
  function prime(videoId: string): void {
    if (priming) return;
    const p = player();
    if (!p) return;
    const hasPot = (): boolean => [...potVideos].some((k) => k.startsWith(videoId + ":"));
    if (hasPot()) return;
    const wasOn = subtitlesOn(p);
    if (wasOn !== false) return; // on already (the request is coming) or unknown
    if (!toggle(p)) return;
    priming = true;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (!hasPot() && Date.now() - startedAt < PRIME_TIMEOUT_MS) return;
      clearInterval(timer);
      priming = false;
      if (subtitlesOn(p) === true) toggle(p);
    }, 100);
  }

  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window || e.data?.source !== "avc") return;
    if (e.data.type === "avc-prime-captions" && typeof e.data.videoId === "string") prime(e.data.videoId);
  });

  window.addEventListener("yt-navigate-finish", () => {
    lastPostedVideoId = "";
    setTimeout(() => send(true), 1000);
    setTimeout(() => send(true), 4000); // player response can lag the event
  });

  send(false);
  setInterval(() => send(false), 3000);
})();
