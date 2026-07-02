import { warn } from "../log";
import { normalize, hasJapanese } from "./util";
import type { SiteAdapter } from "../../types";

function getVisibleText(): string {
  const rows = document.querySelectorAll(".player-timedtext-text-container");
  return normalize(Array.from(rows).map((r) => r.textContent || "").join(" "));
}

export const netflixAdapter: SiteAdapter = {
  name: "netflix",
  matches() {
    return location.hostname.endsWith("netflix.com");
  },
  getVideo() {
    return document.querySelector<HTMLVideoElement>("video");
  },
  // Netflix only downloads the subtitle track the viewer selected, so with
  // English subs on screen this returns English — used as context for
  // listening-mode transcripts. (Japanese cards on Netflix come from
  // listening mode, not from the DOM.)
  getVisibleText,
  start(onLine) {
    let lastText = "";
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const check = () => {
      try {
        const text = getVisibleText();
        if (!text || text === lastText) return;
        if (!hasJapanese(text)) return;
        lastText = text;
        onLine(text, { en: "" });
      } catch (err) {
        warn("netflix adapter error:", err);
      }
    };

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => check(), 100);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
};
