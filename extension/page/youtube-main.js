"use strict";
(() => {
  // src/entries/youtube-main.ts
  (function() {
    let lastPostedVideoId = "";
    function send(force) {
      try {
        const player = document.getElementById("movie_player");
        if (!player || typeof player.getPlayerResponse !== "function") return;
        const resp = player.getPlayerResponse();
        const videoId = resp?.videoDetails?.videoId || "";
        if (!videoId || !force && videoId === lastPostedVideoId) return;
        const tracks = resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        lastPostedVideoId = videoId;
        window.postMessage({
          source: "avc",
          type: "avc-caption-tracks",
          videoId,
          tracks: tracks.map((t) => ({
            baseUrl: t.baseUrl,
            languageCode: t.languageCode,
            kind: t.kind || ""
          }))
        }, "*");
      } catch (err) {
      }
    }
    window.addEventListener("yt-navigate-finish", () => {
      lastPostedVideoId = "";
      setTimeout(() => send(true), 1e3);
      setTimeout(() => send(true), 4e3);
    });
    setInterval(() => send(false), 3e3);
  })();
})();
