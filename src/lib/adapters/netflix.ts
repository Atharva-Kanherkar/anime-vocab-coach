import { warn } from "../log";
import { coalesce, normalize, matchesTargetScript, getAdapterDirection } from "./util";
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
  getVisibleText,
  start(onLine, onClear) {
    let lastText = "";

    const check = () => {
      try {
        const text = getVisibleText();
        if (text === lastText) return;
        if (!text || !matchesTargetScript(text, getAdapterDirection())) {
          // The study-language line is gone (blank, or the other language).
          if (lastText) onClear?.();
          lastText = "";
          return;
        }
        lastText = text;
        onLine(text, { en: "" });
      } catch (err) {
        warn("netflix adapter error:", err);
      }
    };

    const observer = new MutationObserver(coalesce(check, 50));

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  },
};
