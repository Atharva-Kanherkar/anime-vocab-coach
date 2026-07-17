import { warn } from "../log";
import { normalize, matchesTargetScript, getAdapterDirection, hasEnglish } from "./util";
import { contextLang } from "../direction";
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

    const contextFromVideo = (video: HTMLVideoElement): string => {
      const want = contextLang(getAdapterDirection());
      for (const track of video.textTracks) {
        if (!(track.language || "").startsWith(want) || !track.activeCues) continue;
        const text = normalize(
          Array.from(track.activeCues)
            .map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, ""))
            .join(" ")
        );
        if (text) return text;
      }
      // Fallback: if studying English, any Japanese-looking showing track; vice versa.
      for (const track of video.textTracks) {
        if (track.mode !== "showing" || !track.activeCues) continue;
        const text = normalize(
          Array.from(track.activeCues)
            .map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, ""))
            .join(" ")
        );
        if (!text) continue;
        if (want === "en" && hasEnglish(text)) return text;
        if (want === "ja" && matchesTargetScript(text, "en-ja")) return text;
      }
      return "";
    };

    setInterval(() => {
      try {
        document.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
          for (const track of v.textTracks) {
            if (hooked.has(track)) continue;
            hooked.add(track);
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
                if (!matchesTargetScript(text, getAdapterDirection())) return;
                lastByTrack.set(track, text);
                onLine(text, { en: contextFromVideo(v) });
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
  },
};
