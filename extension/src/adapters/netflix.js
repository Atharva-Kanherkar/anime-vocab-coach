AVC.adapters = AVC.adapters || [];

if (!AVC.adapters.some((a) => a.name === "netflix")) AVC.adapters.push({
  name: "netflix",
  matches() {
    return location.hostname.endsWith("netflix.com");
  },
  getVideo() {
    return document.querySelector("video");
  },
  // Netflix only downloads the subtitle track the viewer selected, so with
  // English subs on screen this returns English — used as context for
  // listening-mode transcripts. (Japanese cards on Netflix come from
  // listening mode, not from the DOM.)
  getVisibleText() {
    const rows = document.querySelectorAll(".player-timedtext-text-container");
    return normalize(Array.from(rows).map((r) => r.textContent).join(" "));
  },
  start(onLine) {
    let lastText = "";
    let debounceTimer = null;

    const check = () => {
      try {
        const text = this.getVisibleText();
        if (!text || text === lastText) return;
        if (!hasJapanese(text)) return;
        lastText = text;
        onLine(text, { en: "" });
      } catch (err) {
        AVC.warn("netflix adapter error:", err);
      }
    };

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => check(), 100);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
});
