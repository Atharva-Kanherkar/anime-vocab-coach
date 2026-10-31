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

/** Netflix's player API, the one its own UI drives (and asbplayer reads). */
declare const netflix: any; // eslint-disable-line @typescript-eslint/no-explicit-any

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

  /** Tries per video: asking the player can switch its subtitle language for
   * a moment, which must not keep happening if the URLs never show up. */
  const attempts = new Map<string, number>();

  /** The newest payload per video: English found after Japanese replaces it. */
  const latest = new Map<string, TimedTextPayload>();

  function post(movieId: string): void {
    const payload = latest.get(movieId);
    if (payload) window.postMessage(payload, location.origin);
  }

  function loadTracks(movieId: string): Promise<TimedTextPayload | null> {
    const tracks = known.get(movieId);
    let pending = loaded.get(movieId);
    if (!pending && (attempts.get(movieId) ?? 0) >= 3) return Promise.resolve(null);
    if (!pending) {
      attempts.set(movieId, (attempts.get(movieId) ?? 0) + 1);
      pending = (async () => {
        // A language listed without a URL is one the player fetches only once
        // it is selected (Netflix no longer puts every URL in the manifest).
        const listed = (lang: string) => !!tracks?.some((t) => (t.language === lang || t.language.startsWith(lang + "-")) && !t.forced && !t.none);
        let jaDl = tracks ? pickTrack(tracks, "ja") : null;
        const enDl = tracks ? pickTrack(tracks, "en") : null;
        const askPlayer = !tracks || (!jaDl && listed("ja")) || (!enDl && listed("en"));
        let viaPlayer: Promise<Awaited<ReturnType<typeof playerTrackUrls>>> | null = null;
        if (askPlayer) viaPlayer = playerTrackUrls(movieId);
        if (!jaDl && viaPlayer) jaDl = (await viaPlayer).ja;
        const [ja, en] = await Promise.all([download(jaDl), download(enDl)]);
        if (!ja) {
          loaded.delete(movieId); // try again when asked; the player may not be ready yet
          return null;
        }
        const payload: TimedTextPayload = { source: "avc", type: "avc-netflix-timedtext", movieId, ja, en };
        latest.set(movieId, payload);
        // Japanese is shown now; English, if the player has it, follows.
        if (!en && viaPlayer) {
          void viaPlayer.then(async (found) => {
            const late = await download(found.en);
            if (!late) return;
            latest.set(movieId, { ...payload, en: late });
            post(movieId);
          });
        }
        return payload;
      })();
      loaded.set(movieId, pending);
      // A handful of videos is plenty: the one playing and the next episode.
      if (loaded.size > 6) loaded.delete(loaded.keys().next().value as string);
    }
    void pending.then((payload) => { if (payload) post(movieId); });
    return pending;
  }

  // ---- the player API ----------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function player(): any {
    try {
      const vp = netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
      const ids: string[] = vp?.getAllPlayerSessionIds?.() || [];
      return ids.length ? vp.getVideoPlayerBySessionId(ids[ids.length - 1]) : null;
    } catch {
      return null;
    }
  }

  /** Subtitle URLs the player has fetched, by track id: objects of type
   * "timedtext" anywhere in the session's state, matched by shape rather
   * than by Netflix's minified property paths (asbplayer does the same). */
  function stateUrls(): Map<string, string> {
    const urls = new Map<string, string>();
    try {
      const vp = netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
      const ids: string[] = vp?.getAllPlayerSessionIds?.() || [];
      const root = netflix?.appContext?.state?.playerApp?.getState?.()?.videoPlayer?.cadmiumPlayerRepository?.playersById?.[ids[ids.length - 1]];
      if (!root) return urls;
      const seen = new WeakSet<object>();
      const stack: { node: unknown; depth: number }[] = [{ node: root, depth: 0 }];
      while (stack.length) {
        const { node, depth } = stack.pop()!;
        if (!node || typeof node !== "object" || depth > 20 || seen.has(node)) continue;
        seen.add(node);
        if (node instanceof ArrayBuffer || ArrayBuffer.isView(node)) continue;
        const n = node as Record<string, unknown>;
        try {
          const list = n.urls as { url?: unknown }[] | undefined;
          if (n.type === "timedtext" && typeof n.trackId === "string" && Array.isArray(list) && typeof list[0]?.url === "string" && !urls.has(n.trackId)) {
            urls.set(n.trackId, list[0].url as string);
          }
        } catch { /* a getter that throws */ }
        for (const key of Array.isArray(node) ? node.keys() : Object.keys(n)) {
          let value: unknown;
          try { value = (n as Record<string | number, unknown>)[key]; } catch { continue; }
          if (value && typeof value === "object") stack.push({ node: value, depth: depth + 1 });
        }
      }
    } catch { /* state shape changed: no URLs */ }
    return urls;
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** The Japanese and English subtitle URLs, from the player. A language the
   * player has not fetched yet is selected for a moment so it does, then the
   * learner's own choice is put back. */
  async function playerTrackUrls(movieId: string): Promise<{ ja: { format: string; url: string } | null; en: { format: string; url: string } | null }> {
    const out = { ja: null as { format: string; url: string } | null, en: null as { format: string; url: string } | null };
    let p = player();
    for (let i = 0; i < 30 && (!p || String(p.getMovieId?.()) !== movieId || !p.getTimedTextTrackList?.()?.length); i++) {
      await wait(500);
      p = player();
    }
    if (!p || String(p.getMovieId?.()) !== movieId) return out;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = p.getTimedTextTrackList?.() || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pick = (lang: string) => list
      .filter((t) => typeof t?.bcp47 === "string" && (t.bcp47 === lang || t.bcp47.startsWith(lang + "-")) && !t.isNoneTrack && !t.isForcedNarrative && !t.isImageBased)
      .sort((a, b) => Number(a.rawTrackType === "CLOSEDCAPTIONS") - Number(b.rawTrackType === "CLOSEDCAPTIONS"))[0];
    const previous = p.getTimedTextTrack?.();
    let switched = false;
    try {
      for (const lang of ["ja", "en"] as const) {
        const track = pick(lang);
        if (!track) continue;
        let url = stateUrls().get(track.trackId);
        if (!url) {
          await p.setTimedTextTrack(track);
          switched = true;
          for (let i = 0; i < 20 && !url; i++) { await wait(250); url = stateUrls().get(track.trackId); }
        }
        if (url && /^https:\/\//.test(url)) out[lang] = { format: "player", url };
      }
    } catch { /* the player refused: whatever was found stands */ }
    finally {
      if (switched && previous) { try { await p.setTimedTextTrack(previous); } catch { /* leave it */ } }
    }
    return out;
  }

  /** The player's own clock, posted a few times a second. It counts content
   * only; the <video> element's clock can also count ad breaks. */
  setInterval(() => {
    const p = player();
    const video = document.querySelector("video");
    if (!p || !video || video.paused || typeof p.getCurrentTime !== "function") return;
    const ms = Number(p.getCurrentTime());
    if (!Number.isFinite(ms)) return;
    window.postMessage({ source: "avc", type: "avc-netflix-clock", movieId: String(p.getMovieId?.() ?? ""), playerSec: ms / 1000, videoSec: video.currentTime }, location.origin);
  }, 250);

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
