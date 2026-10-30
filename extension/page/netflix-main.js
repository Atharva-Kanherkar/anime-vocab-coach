"use strict";
(() => {
  // src/lib/netflix-tracks.ts
  var TEXT_FORMATS = ["webvtt-lssdh-ios8", "imsc1.1", "dfxp-ls-sdh", "simplesdh"];
  var obj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  function downloadsOf(tt) {
    const out = [];
    const dls = tt.ttDownloadables;
    if (!obj(dls)) return out;
    for (const [format, dl] of Object.entries(dls)) {
      if (!obj(dl)) continue;
      let url;
      if (Array.isArray(dl.urls)) url = dl.urls.find((u) => obj(u) && typeof u.url === "string")?.url;
      if (!url && obj(dl.downloadUrls)) url = Object.values(dl.downloadUrls).find((u) => typeof u === "string");
      if (typeof url === "string" && /^https:\/\//.test(url)) out.push({ format, url });
    }
    return out;
  }
  function findTimedTextTracks(value) {
    const queue = [{ v: value, depth: 0 }];
    while (queue.length) {
      const { v, depth, movieId } = queue.shift();
      if (!obj(v)) continue;
      const id = v.movieId ?? movieId;
      if (Array.isArray(v.timedtexttracks)) {
        if (typeof id !== "string" && typeof id !== "number") return null;
        const tracks = [];
        for (const tt of v.timedtexttracks) {
          if (!obj(tt)) continue;
          const language = typeof tt.language === "string" ? tt.language : typeof tt.bcp47 === "string" ? tt.bcp47 : "";
          tracks.push({
            language,
            kind: typeof tt.rawTrackType === "string" ? tt.rawTrackType : typeof tt.trackType === "string" ? tt.trackType.toLowerCase() : "",
            forced: tt.isForcedNarrative === true,
            none: tt.isNoneTrack === true,
            downloads: downloadsOf(tt)
          });
        }
        return { movieId: String(id), tracks };
      }
      if (depth < 3) {
        for (const child of Object.values(v)) if (obj(child)) queue.push({ v: child, depth: depth + 1, movieId: id });
      }
    }
    return null;
  }
  function pickTrack(tracks, lang) {
    const ranked = tracks.filter((t) => (t.language === lang || t.language.startsWith(lang + "-")) && !t.forced && !t.none).sort((a, b) => Number(a.kind === "closedcaptions") - Number(b.kind === "closedcaptions"));
    for (const track of ranked) {
      for (const format of TEXT_FORMATS) {
        const dl = track.downloads.find((d) => d.format === format);
        if (dl) return dl;
      }
    }
    return null;
  }

  // src/entries/netflix-main.ts
  (function() {
    let lastPosted = "";
    function readVideoId() {
      try {
        const path = location.pathname.match(/\/watch\/(\d+)/);
        if (path) return path[1];
        const meta = document.querySelector('meta[property="og:url"]');
        const content = meta?.getAttribute("content") || "";
        const metaMatch = content.match(/\/watch\/(\d+)/);
        if (metaMatch) return metaMatch[1];
      } catch {
      }
      return "";
    }
    function send(force) {
      const videoId = readVideoId();
      if (!videoId || !force && videoId === lastPosted) return;
      lastPosted = videoId;
      window.postMessage({
        source: "avc",
        type: "avc-netflix-video-id",
        videoId
      }, "*");
      void loadTracks(videoId);
    }
    window.addEventListener("popstate", () => {
      lastPosted = "";
      setTimeout(() => send(true), 500);
    });
    setInterval(() => send(false), 3e3);
    setTimeout(() => send(true), 1500);
    const known = /* @__PURE__ */ new Map();
    const loaded = /* @__PURE__ */ new Map();
    async function download(dl) {
      if (!dl) return null;
      try {
        const res = await fetch(dl.url, { credentials: "omit" });
        if (!res.ok) return null;
        const text = await res.text();
        return text.length < 3e6 ? { format: dl.format, text } : null;
      } catch {
        return null;
      }
    }
    function loadTracks(movieId) {
      const tracks = known.get(movieId);
      if (!tracks) return Promise.resolve(null);
      let pending = loaded.get(movieId);
      if (!pending) {
        pending = (async () => {
          const [ja, en] = await Promise.all([download(pickTrack(tracks, "ja")), download(pickTrack(tracks, "en"))]);
          if (!ja) return null;
          return { source: "avc", type: "avc-netflix-timedtext", movieId, ja, en };
        })();
        loaded.set(movieId, pending);
        if (loaded.size > 6) loaded.delete(loaded.keys().next().value);
      }
      void pending.then((payload) => {
        if (payload) window.postMessage(payload, location.origin);
      });
      return pending;
    }
    function inspect(value) {
      const found = findTimedTextTracks(value);
      if (!found || !found.tracks.length) return;
      known.set(found.movieId, found.tracks);
      if (known.size > 20) known.delete(known.keys().next().value);
      if (found.movieId === readVideoId()) void loadTracks(found.movieId);
    }
    const parse = JSON.parse;
    const hookedParse = function(text, reviver) {
      const out = parse.call(JSON, text, reviver);
      try {
        if (typeof text === "string" && text.length > 200 && text.includes("timedtexttracks")) inspect(out);
      } catch {
      }
      return out;
    };
    Object.defineProperty(hookedParse, "toString", { value: () => parse.toString() });
    JSON.parse = hookedParse;
    const json = Response.prototype.json;
    Response.prototype.json = async function() {
      const out = await json.call(this);
      try {
        inspect(out);
      } catch {
      }
      return out;
    };
    window.addEventListener("message", (e) => {
      if (e.source !== window || e.data?.source !== "avc-content" || e.data?.type !== "avc-netflix-timedtext-request") return;
      const id = typeof e.data.movieId === "string" ? e.data.movieId : readVideoId();
      if (id) void loadTracks(id);
    });
  })();
})();
