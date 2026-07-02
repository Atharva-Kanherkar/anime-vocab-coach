# 04 — Site Adapters

## 1. Adapter contract (all adapters)

Each `src/adapters/*.js` file pushes one object into the global array:

```js
// at top of each adapter file — VERBATIM pattern
AVC.adapters = AVC.adapters || [];
AVC.adapters.push({
  name: "youtube",
  matches() { /* return bool based on location.hostname */ },
  getVideo() { /* return the active HTMLVideoElement or null */ },
  start(onLine) { /* begin observing; call onLine(text) for each new subtitle line */ }
});
```

Rules that apply to **every** adapter:
- `onLine` must receive the **full currently-displayed subtitle text** as one string (join multi-row captions with a single space), trimmed, with internal whitespace collapsed (`text.replace(/\s+/g, " ").trim()`).
- Fire `onLine` only when the text **differs** from the last text this adapter fired (adapter-local `lastText` variable). Empty string → do not fire.
- Skip lines containing no Japanese at all: `if (!/[぀-ヿ㐀-䶿一-鿿]/.test(text)) return;` (hiragana, katakana, CJK).
- Never throw out of the MutationObserver callback — wrap the handler body in try/catch and `AVC.warn` on error.
- `main.js` picks the FIRST adapter whose `matches()` returns true — so `generic` must be LAST in the manifest's js list (it matches almost anything with a video).

## 2. YouTube adapter

- `matches()`: `location.hostname.endsWith("youtube.com")`
- Caption DOM (desktop player, 2024–2026 stable): container `#movie_player .ytp-caption-window-container`; each rendered caption row is `.ytp-caption-segment`.
- `getVideo()`: `document.querySelector("#movie_player video, video.html5-main-video")`.
- `start(onLine)`:
  1. Because YouTube is an SPA and the player/caption container appears late, observe **`document.body`** with `{childList: true, subtree: true, characterData: true}`. In the callback (debounced with a 100 ms trailing timer — one pending `setTimeout`, reset on each burst):
     - `const segs = document.querySelectorAll(".ytp-caption-segment");`
     - `const text = normalize(Array.from(segs).map(s => s.textContent).join(" "));`
     - dedupe + Japanese check per §1, then `onLine(text)`.
  2. This body-level observer also survives SPA navigation (`yt-navigate-finish`) for free; do NOT try to observe the caption container directly (it is destroyed/recreated constantly).
- Known quirks: during ads the captions belong to the ad — acceptable in v1 (cooldown limits damage). Auto-generated Japanese CC sometimes re-renders the same line token by token; the 100 ms debounce + dedupe handles this — a growing line (`私` → `私は` → `私は学校`) WILL fire multiple times; that is acceptable because `main.js` dedupes targets per session and the cooldown gates cards. Do not attempt "line completion detection".

## 3. Netflix adapter

- `matches()`: `location.hostname.endsWith("netflix.com")`
- Subtitle DOM (Netflix web player, stable for years): container `.player-timedtext`, rows `.player-timedtext-text-container` (text may be nested in `<span>`s — use `textContent`).
- `getVideo()`: `document.querySelector("video")` (Netflix has exactly one).
- `start(onLine)`: same body-level observer pattern as YouTube (100 ms debounce), reading `document.querySelectorAll(".player-timedtext-text-container")`.
- SPA navigation: Netflix swaps between browse and watch pages without reloads. The body observer keeps working, but per-video session state must reset — in `main.js`, watch for `location.pathname` changes (poll every 2 s or hook the observer): when the path changes, clear the session `Set` of targeted words and `lastText`. See `docs/06-PITFALLS.md` §5.
- Subtitles must be set to **Japanese** in Netflix's own audio/subtitle menu; if the user has Japanese audio + English subs, the extension sees English and correctly does nothing (Japanese-character check in §1).

## 4. Generic adapter (native text tracks)

- `matches()`: `document.querySelector("video") !== null` (always checked LAST).
- `getVideo()`: the first `<video>` with a non-empty `textTracks` list, else the first `<video>`.
- `start(onLine)`:

```js
// Poll for videos+tracks every 2 s (players attach tracks late)
const hooked = new WeakSet();
setInterval(() => {
  document.querySelectorAll("video").forEach(v => {
    for (const track of v.textTracks) {
      if (hooked.has(track)) continue;
      hooked.add(track);
      if (track.mode === "disabled") track.mode = "hidden"; // hidden still fires cuechange
      track.addEventListener("cuechange", () => {
        const cues = track.activeCues;
        if (!cues || !cues.length) return;
        const text = normalize(Array.from(cues).map(c => c.text.replace(/<[^>]+>/g, "")).join(" "));
        // dedupe + Japanese check per §1, then onLine(text)
      });
    }
  });
}, 2000);
```

- v1 ships this adapter in the same content-script registration as YouTube/Netflix (it just loses the `matches()` race there). To use it on other sites, the user adds host patterns — document in options page copy that this requires editing `manifest.json` in v1 (adding dynamic host permissions is out of scope).

### Test page (`test/track.html`) for M7

A minimal page: one `<video>` (any small mp4, or even no source + `video.dispatchEvent` — simpler: use a real 30 s mp4) with `<track kind="subtitles" srclang="ja" src="ja.vtt" default>`. `ja.vtt` contains ~6 cues of real Japanese sentences 3 s apart, e.g. `今日は学校に行きます`, `友達と昼ご飯を食べました`, `明日は雨が降るでしょう`, `この映画は本当に面白いですね`, `日本語を勉強するのは楽しいです`, `電車で東京へ行きたいです`. Serve with `npx http-server test/ -p 8080`.
