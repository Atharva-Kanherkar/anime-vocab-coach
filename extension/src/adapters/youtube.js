AVC.adapters = AVC.adapters || [];

function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

function hasJapanese(text) {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
}

AVC.adapters.push({
  name: "youtube",
  matches() {
    return location.hostname.endsWith("youtube.com");
  },
  getVideo() {
    return document.querySelector("#movie_player video, video.html5-main-video");
  },
  start(onLine) {
    let lastText = "";
    let debounceTimer = null;

    const check = () => {
      try {
        const segs = document.querySelectorAll(".ytp-caption-segment");
        const text = normalize(Array.from(segs).map((s) => s.textContent).join(" "));
        if (!text || text === lastText) return;
        if (!hasJapanese(text)) return;
        lastText = text;
        onLine(text);
      } catch (err) {
        AVC.warn("youtube adapter error:", err);
      }
    };

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(check, 100);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
});
