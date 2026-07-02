AVC.adapters = AVC.adapters || [];

function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

function hasJapanese(text) {
  return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
}

AVC.adapters.push({
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
  start(onLine) {
    const hooked = new WeakSet();
    const lastByTrack = new WeakMap();

    setInterval(() => {
      try {
        document.querySelectorAll("video").forEach((v) => {
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
                    .map((c) => c.text.replace(/<[^>]+>/g, ""))
                    .join(" ")
                );
                const lastText = lastByTrack.get(track) || "";
                if (!text || text === lastText) return;
                if (!hasJapanese(text)) return;
                lastByTrack.set(track, text);
                onLine(text);
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
