import { warn } from "../log";
import { normalize, hasJapanese } from "./util";
import type { SiteAdapter } from "../../types";

function getVideo(): HTMLVideoElement | null {
  const videos = document.querySelectorAll<HTMLVideoElement>("video");
  for (const v of videos) {
    if (v.textTracks && v.textTracks.length > 0) return v;
  }
  return videos[0] || null;
}

export const genericAdapter: SiteAdapter = {
  name: "generic",
  matches() {
    return document.querySelector("video") !== null;
  },
  getVideo,
  getVisibleText() {
    const video = getVideo();
    if (!video || !video.textTracks) return "";
    const parts: string[] = [];
    for (const track of video.textTracks) {
      if (track.mode !== "showing" || !track.activeCues) continue;
      for (const cue of track.activeCues) {
        const text = (cue as VTTCue).text;
        if (text) parts.push(text.replace(/<[^>]+>/g, ""));
      }
    }
    return normalize(parts.join(" "));
  },
  start(onLine) {
    const hooked = new WeakSet<TextTrack>();
    const lastByTrack = new WeakMap<TextTrack, string>();

    const enContext = (video: HTMLVideoElement): string => {
      for (const track of video.textTracks) {
        if (!(track.language || "").startsWith("en") || !track.activeCues) continue;
        const text = normalize(
          Array.from(track.activeCues).map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, "")).join(" ")
        );
        if (text) return text;
      }
      return "";
    };

    setInterval(() => {
      try {
        document.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
          for (const track of v.textTracks) {
            if (hooked.has(track)) continue;
            hooked.add(track);
            // A hidden track still fires cuechange — so a Japanese track can
            // feed the pipeline while the viewer displays English (or nothing).
            if (track.mode === "disabled") track.mode = "hidden";

            track.addEventListener("cuechange", () => {
              try {
                const cues = track.activeCues;
                if (!cues || !cues.length) return;
                const text = normalize(
                  Array.from(cues)
                    .map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, ""))
                    .join(" ")
                );
                const lastText = lastByTrack.get(track) || "";
                if (!text || text === lastText) return;
                if (!hasJapanese(text)) return;
                lastByTrack.set(track, text);
                onLine(text, { en: enContext(v) });
              } catch (err) {
                warn("generic adapter cue error:", err);
              }
            });
          }
        });
      } catch (err) {
        warn("generic adapter error:", err);
      }
    }, 2000);
  }
};
