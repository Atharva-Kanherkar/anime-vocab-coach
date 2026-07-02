AVC.adapters = AVC.adapters || [];

if (!AVC.adapters.some((a) => a.name === "generic")) AVC.adapters.push({
  name: "generic",
  matches() {
    return document.querySelector("video") !== null;
  },
  getVideo() {
    const videos = document.querySelectorAll("video");
    for (const v of videos) {
      if (v.textTracks && v.textTracks.length > 0) return v;
    }
    return videos[0] || null;
  },
  getVisibleText() {
    const video = this.getVideo();
    if (!video || !video.textTracks) return "";
    const parts = [];
    for (const track of video.textTracks) {
      if (track.mode !== "showing" || !track.activeCues) continue;
      for (const cue of track.activeCues) {
        if (cue.text) parts.push(cue.text.replace(/<[^>]+>/g, ""));
      }
    }
    return normalize(parts.join(" "));
  },
  start(onLine) {
    const hooked = new WeakSet();
    const lastByTrack = new WeakMap();

    const enContext = (video) => {
      for (const track of video.textTracks) {
        if (!(track.language || "").startsWith("en") || !track.activeCues) continue;
        const text = normalize(
          Array.from(track.activeCues).map((c) => c.text.replace(/<[^>]+>/g, "")).join(" ")
        );
        if (text) return text;
      }
      return "";
    };

    setInterval(() => {
      try {
        document.querySelectorAll("video").forEach((v) => {
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
                    .map((c) => c.text.replace(/<[^>]+>/g, ""))
                    .join(" ")
                );
                const lastText = lastByTrack.get(track) || "";
                if (!text || text === lastText) return;
                if (!hasJapanese(text)) return;
                lastByTrack.set(track, text);
                onLine(text, { en: enContext(v) });
              } catch (err) {
                AVC.warn("generic adapter cue error:", err);
              }
            });
          }
        });
      } catch (err) {
        AVC.warn("generic adapter error:", err);
      }
    }, 2000);
  }
});
