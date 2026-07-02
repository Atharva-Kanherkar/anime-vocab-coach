# 06 — Pitfalls (each one WILL bite you if ignored)

## 1. kuromoji cannot run in the MV3 service worker
kuromoji's browser build loads its dictionary via `XMLHttpRequest`. MV3 service workers have **no XHR** (fetch only) and no `window`. Attempting to tokenize in `background.js` fails with `XMLHttpRequest is not defined`. **Required design:** tokenize in the content script (which has XHR). This is why the architecture keeps the service worker trivial. Do not "fix" this by patching kuromoji.

## 2. kuromoji dicPath must be the extension URL **with trailing slash**
```js
kuromoji.builder({ dicPath: chrome.runtime.getURL("kuromoji/dict/") }).build((err, tk) => ...)
```
kuromoji naively concatenates `dicPath + filename`; without the trailing slash every dict file 404s. The 12 `.dat.gz` files must be listed under `web_accessible_resources` (already in the verbatim manifest) or the XHRs are blocked. kuromoji gunzips them itself — do NOT pre-decompress the files, and keep the `.dat.gz` names exactly as shipped. Memoize the build promise; building takes seconds and must happen at most once per tab. If `build` errors, `AVC.warn` and disable the pipeline for this tab (never crash the page).

## 3. Content scripts can't use ES modules
The manifest `js` array loads classic scripts sharing one isolated world. `import`/`export` is a SyntaxError. Hence the `AVC` namespace pattern and the strict load order in the manifest. The popup/options pages could use modules, but to reuse `storage.js` unchanged they also load classic `<script>` tags in order.

## 4. Fullscreen swallows overlays parented to `document.body`
In fullscreen, Chrome only renders elements inside `document.fullscreenElement`. A card appended to `body` is invisible while the video is fullscreen — the #1 "it doesn't work" report. The VERBATIM `mountHost()` in `docs/05` §1 re-parents the host into `fullscreenElement` and back on `fullscreenchange`. Test both directions (enter/exit fullscreen with the card open).

## 5. YouTube and Netflix are SPAs
Page loads happen once; navigation is history-API based. Consequences: (a) observe `document.body` (survives navigation), never a specific player node; (b) reset per-video session state (targeted-words `Set`, `lastText`, `wasPlaying`) when `location.pathname` changes — poll it every 2 s in `main.js`; (c) never cache `getVideo()` results — re-query each time you need the element.

## 6. Subtitle mutations are noisy
The same line re-renders (position shifts, incremental auto-caption growth, karaoke-style word reveals). Defenses, all required: 100 ms trailing debounce in the adapters, whitespace-normalized string dedupe per adapter, per-session targeted-word `Set`, and the cooldown gate. Do not add cleverness beyond these four.

## 7. Storage races
Two rapid judgments (or content script + popup writing simultaneously) can interleave get→set and lose a write. Mitigation required in `storage.js`: a module-level promise chain — every write helper does `queue = queue.then(doWrite)` so writes serialize within a context. Cross-context (popup vs tab) races are theoretically possible but acceptable at this write rate; do not build anything fancier.

## 8. The site's own keyboard shortcuts
YouTube reacts to `1`/`2`/`3` (seek) and `Esc`. The card's keydown handler must run on `window` with **capture: true** and call `stopPropagation()` + `preventDefault()` while the card is open, else judging a word also seeks the video.

## 9. Crunchyroll has no subtitle text in the DOM
Crunchyroll renders subtitles into a **canvas** (libass/WASM); there is no subtitle text to scrape, and its player lives in an iframe. v1 declared it out of scope; **v2 solves it with Listening Mode** (audio transcription — `docs/08-LISTENING-MODE.md`). Do not attempt DOM scraping or OCR there.

## 10. `basic_form` can be `"*"`
kuromoji returns `"*"` for unknown-word basic forms. The token mapper in `docs/02` §2 already falls back to `surface_form`. Similarly `reading` can be `undefined` for unknown words — fall back to `""` and let dictionary lookup fail naturally (rule 4 filters it).

## 11. Dictionary JSON size vs load time
`dictionary.json` is a few MB; `fetch` + `JSON.parse` takes ~100–300 ms once per tab. Memoize the load promise. Do NOT put the dictionary into `chrome.storage` (quota + slow) and do NOT inline it into a JS file (parse cost on every page).

## 12. Don't count "met" twice
`stats.daily[today].met` increments only when a word's vocab record is **created** (first time ever seen), not on every appearance. `seenCount` on the record is what tracks repeat appearances.

## 13. Videos the user paused themselves
Only auto-resume if the extension did the pausing (`wasPlaying === true` captured immediately before `video.pause()`). If the user hits play manually while the card is open, respect it — set `wasPlaying = false` on a `play` event during card display so dismissal doesn't pause/resume again.

---

## v2 pitfalls (Listening Mode & hidden tracks — see docs/08)

## 14. Tab capture MUTES the tab unless you route audio back
`getUserMedia` with `chromeMediaSource: "tab"` silences the tab for the viewer. The offscreen document must immediately do `audioCtx.createMediaStreamSource(stream).connect(audioCtx.destination)`. Forgetting this is the #1 "listening mode broke my video" bug.

## 15. MediaRecorder timeslice chunks are not standalone files
Only the first `dataavailable` blob contains the webm container header; later ones are raw clusters OpenAI rejects. Required pattern: a **fresh MediaRecorder per chunk** (record 12 s → stop → new recorder), never `rec.start(12000)` with timeslice.

## 16. The MV3 service worker dies between chunks
Keep listening-mode state in `chrome.storage.session`, never in SW module variables. The offscreen document is the thing that persists; the SW just relays messages and must work correctly when freshly woken.

## 17. `getPlayerResponse()` only exists in the page world
YouTube's caption-track list comes from the player API object, invisible to content scripts (isolated world). Hence `page/youtube-main.js` with `"world": "MAIN"` in the manifest (Chrome 111+) posting data via `window.postMessage`. Never try to read `ytInitialPlayerResponse` from the content script — it's stale after SPA navigation anyway.

## 18. Timedtext URLs expire and are videoId-scoped
Fetch the ja/en tracks fresh per video (the MAIN-world script re-posts on `yt-navigate-finish`); never cache `baseUrl` across videos or sessions. Append `&fmt=json3` via `URL.searchParams` — naive string concat breaks on URLs that already contain `fmt`.

## 19. Only one frame should react to a transcript
`chrome.tabs.sendMessage` reaches every frame running the content script (Crunchyroll runs it with `all_frames: true`). The rule: the frame whose adapter `getVideo()` returns non-null handles the transcript; every other frame ignores it. Without this you get double cards.
