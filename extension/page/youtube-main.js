"use strict";
(() => {
  // src/lib/youtube-pot.ts
  function extractPot(rawUrl, base = "https://www.youtube.com") {
    let url;
    try {
      url = new URL(rawUrl, base);
    } catch {
      return null;
    }
    if (!url.pathname.endsWith("/api/timedtext")) return null;
    const pot = url.searchParams.get("pot");
    const videoId = url.searchParams.get("v");
    if (!pot || !videoId) return null;
    return {
      videoId,
      pot,
      c: url.searchParams.get("c") || "WEB",
      cver: url.searchParams.get("cver") || ""
    };
  }

  // src/entries/youtube-main.ts
  var PRIME_TIMEOUT_MS = 4e3;
  (function() {
    let lastPostedVideoId = "";
    const potVideos = /* @__PURE__ */ new Set();
    let priming = false;
    function player() {
      return document.getElementById("movie_player");
    }
    function send(force) {
      try {
        const p = player();
        if (!p || typeof p.getPlayerResponse !== "function") return;
        const resp = p.getPlayerResponse();
        const videoId = resp?.videoDetails?.videoId || "";
        if (!videoId || !force && videoId === lastPostedVideoId) return;
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
      } catch (err) {
      }
    }
    function inspect(url) {
      const hit = extractPot(url, location.origin);
      if (!hit || potVideos.has(hit.videoId + ":" + hit.pot)) return;
      potVideos.add(hit.videoId + ":" + hit.pot);
      window.postMessage({ source: "avc", type: "avc-timedtext-pot", ...hit }, "*");
    }
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes("/api/timedtext")) inspect(entry.name);
        }
      });
      observer.observe({ type: "resource", buffered: true });
    } catch {
    }
    function subtitlesOn(p) {
      if (typeof p.isSubtitlesOn === "function") return p.isSubtitlesOn();
      const button = document.querySelector(".ytp-subtitles-button");
      return button ? button.getAttribute("aria-pressed") === "true" : null;
    }
    function toggle(p) {
      if (typeof p.toggleSubtitles === "function") {
        p.toggleSubtitles();
        return true;
      }
      const button = document.querySelector(".ytp-subtitles-button");
      if (!button) return false;
      button.click();
      return true;
    }
    function prime(videoId) {
      if (priming) return;
      const p = player();
      if (!p) return;
      const hasPot = () => [...potVideos].some((k) => k.startsWith(videoId + ":"));
      if (hasPot()) return;
      const wasOn = subtitlesOn(p);
      if (wasOn !== false) return;
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
    window.addEventListener("message", (e) => {
      if (e.source !== window || e.data?.source !== "avc") return;
      if (e.data.type === "avc-prime-captions" && typeof e.data.videoId === "string") prime(e.data.videoId);
    });
    window.addEventListener("yt-navigate-finish", () => {
      lastPostedVideoId = "";
      setTimeout(() => send(true), 1e3);
      setTimeout(() => send(true), 4e3);
    });
    send(false);
    setInterval(() => send(false), 3e3);
  })();
})();
