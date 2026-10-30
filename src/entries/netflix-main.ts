// Runs in the PAGE (MAIN) world on netflix.com, from document_start.
//
// 1. Reads the current video ID so the content script can build a stable
//    cache key.
// 2. Watches the player's manifest for its subtitle tracks and downloads the
//    Japanese track and, when the region has one, the English track. The
//    content script turns them into dual subtitles on the video's own clock,
//    so a line appears when the player would show it, not when the DOM changes.
//
// The hooks only look at what the player parsed; they never change it. The
// download is the same request the player makes when the learner picks the
// language, from the learner's own session.
import { findTimedTextTracks, pickTrack, type NetflixTrack } from "../lib/netflix-tracks";

(function () {
  let lastPosted = "";

  function readVideoId(): string {
    try {
      const path = location.pathname.match(/\/watch\/(\d+)/);
      if (path) return path[1];

      // Netflix player embeds movieId in the page's React fiber state occasionally.
      const meta = document.querySelector('meta[property="og:url"]');
      const content = meta?.getAttribute("content") || "";
      const metaMatch = content.match(/\/watch\/(\d+)/);
      if (metaMatch) return metaMatch[1];
    } catch { /* player not ready */ }
    return "";
  }

  function send(force: boolean): void {
    const videoId = readVideoId();
    if (!videoId || (!force && videoId === lastPosted)) return;
    lastPosted = videoId;
    window.postMessage({
      source: "avc",
      type: "avc-netflix-video-id",
      videoId
    }, "*");
    void loadTracks(videoId);
  }

  window.addEventListener("popstate", () => { lastPosted = ""; setTimeout(() => send(true), 500); });
  setInterval(() => send(false), 3000);
  setTimeout(() => send(true), 1500);

  // ---- subtitle tracks -------------------------------------------------

  /** Tracks per video, from every manifest seen (the next episode's included). */
  const known = new Map<string, NetflixTrack[]>();
  /** Downloaded track text per video, so a late content script can ask again. */
  const loaded = new Map<string, Promise<TimedTextPayload | null>>();

  interface TimedTextPayload {
    source: "avc";
    type: "avc-netflix-timedtext";
    movieId: string;
    ja: { format: string; text: string } | null;
    en: { format: string; text: string } | null;
  }

  async function download(dl: { format: string; url: string } | null): Promise<{ format: string; text: string } | null> {
    if (!dl) return null;
    try {
      const res = await fetch(dl.url, { credentials: "omit" });
      if (!res.ok) return null;
      const text = await res.text();
      return text.length < 3_000_000 ? { format: dl.format, text } : null;
    } catch {
      return null;
    }
  }

  function loadTracks(movieId: string): Promise<TimedTextPayload | null> {
    const tracks = known.get(movieId);
    if (!tracks) return Promise.resolve(null);
    let pending = loaded.get(movieId);
    if (!pending) {
      pending = (async () => {
        const [ja, en] = await Promise.all([download(pickTrack(tracks, "ja")), download(pickTrack(tracks, "en"))]);
        if (!ja) return null;
        return { source: "avc" as const, type: "avc-netflix-timedtext" as const, movieId, ja, en };
      })();
      loaded.set(movieId, pending);
      // A handful of videos is plenty: the one playing and the next episode.
      if (loaded.size > 6) loaded.delete(loaded.keys().next().value as string);
    }
    void pending.then((payload) => { if (payload) window.postMessage(payload, location.origin); });
    return pending;
  }

  function inspect(value: unknown): void {
    const found = findTimedTextTracks(value);
    if (!found || !found.tracks.length) return;
    known.set(found.movieId, found.tracks);
    if (known.size > 20) known.delete(known.keys().next().value as string);
    // Only fetch what is being watched; manifests for trailers and the next
    // episode are kept until their video opens.
    if (found.movieId === readVideoId()) void loadTracks(found.movieId);
  }

  const parse = JSON.parse;
  const hookedParse = function (this: unknown, text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown) {
    const out = parse.call(JSON, text, reviver);
    try {
      if (typeof text === "string" && text.length > 200 && text.includes("timedtexttracks")) inspect(out);
    } catch { /* never break the page */ }
    return out;
  };
  Object.defineProperty(hookedParse, "toString", { value: () => parse.toString() });
  JSON.parse = hookedParse as typeof JSON.parse;

  const json = Response.prototype.json;
  Response.prototype.json = async function (this: Response) {
    const out = await json.call(this);
    try { inspect(out); } catch { /* never break the page */ }
    return out;
  };

  // The content script loads after the player may already have its tracks.
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window || e.data?.source !== "avc-content" || e.data?.type !== "avc-netflix-timedtext-request") return;
    const id = typeof e.data.movieId === "string" ? e.data.movieId : readVideoId();
    if (id) void loadTracks(id);
  });
})();
