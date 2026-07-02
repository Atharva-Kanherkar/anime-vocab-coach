AVC.adapters = AVC.adapters || [];

function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

function hasJapanese(text) {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
}

AVC.adapters.push({
  name: "netflix",
  matches() {
    return location.hostname.endsWith("netflix.com");
  },
  getVideo() {
    return document.querySelector("video");
  },
  start(onLine) {
    let lastText = "";
    let debounceTimer = null;

    const check = () => {
      try {
        const rows = document.querySelectorAll(".player-timedtext-text-container");
        const text = normalize(Array.from(rows).map((r) => r.textContent).join(" "));
        if (!text || text === lastText) return;
        if (!hasJapanese(text)) return;
        lastText = text;
        onLine(text);
      } catch (err) {
        AVC.warn("netflix adapter error:", err);
      }
    };

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(check, 100);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
});
