"use strict";
(() => {
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
    }
    window.addEventListener("popstate", () => {
      lastPosted = "";
      setTimeout(() => send(true), 500);
    });
    setInterval(() => send(false), 3e3);
    setTimeout(() => send(true), 1500);
  })();
})();
