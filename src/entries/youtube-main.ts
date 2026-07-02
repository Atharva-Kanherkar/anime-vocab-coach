// Runs in the PAGE (MAIN) world on youtube.com. Its only job: read the current
// video's caption track list from the player API and post it to the content
// script. The Japanese track exists even when the viewer displays English subs
// (or none) — that's what makes "watch with English, learn from Japanese" work.

interface YtPlayerElement extends HTMLElement {
  getPlayerResponse?: () => {
    videoDetails?: { videoId?: string };
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: { baseUrl: string; languageCode: string; kind?: string }[];
      };
    };
  };
}

(function () {
  let lastPostedVideoId = "";

  function send(force: boolean): void {
    try {
      const player = document.getElementById("movie_player") as YtPlayerElement | null;
      if (!player || typeof player.getPlayerResponse !== "function") return;
      const resp = player.getPlayerResponse();
      const videoId = resp?.videoDetails?.videoId || "";
      if (!videoId || (!force && videoId === lastPostedVideoId)) return;
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
    } catch (err) { /* player not ready yet — the poll below retries */ }
  }

  window.addEventListener("yt-navigate-finish", () => {
    lastPostedVideoId = "";
    setTimeout(() => send(true), 1000);
    setTimeout(() => send(true), 4000); // player response can lag the event
  });

  setInterval(() => send(false), 3000);
})();
