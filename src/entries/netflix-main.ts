// Runs in the PAGE (MAIN) world on netflix.com. Reads the current video ID from
// Netflix's player state so the content script can build a stable cache key.

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
  }

  window.addEventListener("popstate", () => { lastPosted = ""; setTimeout(() => send(true), 500); });
  setInterval(() => send(false), 3000);
  setTimeout(() => send(true), 1500);
})();
