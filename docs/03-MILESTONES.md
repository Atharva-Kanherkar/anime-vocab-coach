# 03 — Milestones (build in this order; each gate is mandatory)

Every milestone ends with an **Acceptance** block. Perform it literally. If it fails, fix before proceeding. Commit after each milestone: `M<n>: <title>`.

A good test video for all milestones: any YouTube video with Japanese subtitles — e.g. search YouTube for `日本語字幕 アニメ` or use an NHK Easy Japanese news video, then enable Japanese captions via the CC button (auto-generated Japanese is fine).

---

## M0 — Scaffold loads

1. Create the `extension/` tree from `docs/01-ARCHITECTURE.md` §2 with `manifest.json` copied VERBATIM from §3, `background.js` per §5, `src/log.js` VERBATIM from §4. Every other listed `src/*.js` file: create it containing only a comment header and (for adapters) an empty registration — they must exist because the manifest references them; a missing file makes Chrome reject the whole extension.
2. `main.js` for now: `AVC.log("main loaded on", location.hostname);`
3. `npm init -y && npm install kuromoji@0.1.2` at repo root. Copy `node_modules/kuromoji/build/kuromoji.js` → `extension/vendor/kuromoji.js` and all 12 files from `node_modules/kuromoji/dict/` → `extension/kuromoji/dict/`.
4. `extension/data/dictionary.json` is **already committed in this repo** (pre-generated). Verify it exists and is > 3 MB. Do not overwrite or delete it.
5. `.gitignore` (`node_modules/`, `JMdict_e*`) is already committed.

**Acceptance:** `chrome://extensions` → Load unpacked → `extension/` loads with **zero errors**. Open youtube.com, DevTools console shows `[AVC] main loaded on www.youtube.com`. The service worker console (inspect from chrome://extensions) shows no errors and storage contains seeded `settings` (check via `chrome.storage.local.get(console.log)` in the SW console).

---

## M1 — YouTube subtitle capture

Implement `src/adapters/youtube.js` exactly per `docs/04-SITE-ADAPTERS.md` §2, and in `main.js`: pick the first adapter where `matches()` is true, call `start(onLine)` with `onLine = text => AVC.log("LINE:", text)`.

**Acceptance:** Play the test video with Japanese CC on. Console prints one `[AVC] LINE: <japanese text>` per subtitle change, with **no duplicates for the same rendered line** and no lines when captions are off. Navigating YouTube (SPA) to another video keeps working without a page reload.

---

## M2 — Tokenizer

Implement `src/tokenizer.js` per `docs/01` §4 and `docs/06-PITFALLS.md` §2 (dicPath via `chrome.runtime.getURL("kuromoji/dict/")`, memoized init promise, init lazily on first line). Map tokens per `docs/02` §2. Wire into `main.js`: `onLine` now logs `tokens.map(t => t.base + "/" + t.pos).join(" ")`.

**Acceptance:** For a subtitle like `私は学校に行きました`, console shows tokens including `行く/動詞` (base form restored) and `学校/名詞`. First tokenization may take 2–10 s after the first line (dict load) — subsequent lines are instant. No XHR/CORS errors in console.

---

## M3 — Dictionary build + lookup

1. `extension/data/dictionary.json` is already committed (verified output: 30,135 words / 51,362 keys / 4.4 MB, sanity-checked for 食べる・学校・行く・面白い). Only run `node scripts/build-dictionary.mjs` if you need to REgenerate it (downloads JMdict ~9 MB gz automatically).
2. Implement `src/dictionary.js`: `load()` fetches the JSON once (memoized promise), `lookup(base)` returns the entry or null.
3. `main.js`: for each line, log survivors of the eligibility filter (`docs/02` §5 step 1, rules 1–4 only for now) as `base (reading) — gloss [level/freq]`.

**Acceptance:** Playing the test video, common content words appear with correct readings/glosses (e.g. `学校 (がっこう) — school [5/…]`), while particles (は/に/を), names, and numbers do NOT appear.

---

## M4 — Pause + word card

1. Implement `src/scoring.js` — the FULL algorithm of `docs/02` §5 (wordStates still an empty `{}` passed from main.js for now).
2. Implement `src/overlay.js` per `docs/05-UI-SPEC.md` §2–3 (shadow DOM, fullscreen-aware mounting per `docs/06-PITFALLS.md` §4, Esc/outside-click dismissal, promise-returning `showCard`).
3. Wire the pause-engine gates in `main.js` per `docs/02` §7 (use in-memory settings; judgments just log for now).

**Acceptance:** Within a minute of playing, the video pauses and the card appears: word, hiragana reading, glosses, level chip, sentence with the word highlighted. All three buttons + Esc dismiss it and the video resumes. Trigger again in fullscreen — the card must appear over the fullscreen video too. No card appears more often than the 20 s cooldown.

---

## M5 — Storage: judgments, states, stats

Implement `src/storage.js` completely per `docs/02` §3–4 and wire real settings + wordStates + judgments through main.js and overlay.js. Session-local targeted-`Set` in main.js. Badge message to background per `docs/01` §5.

**Acceptance:** Judge a word "I know it" → replay the same part of the video (seek back) → that word never triggers again. In the SW console, `chrome.storage.local.get(console.log)` shows the `vocab` record with correct fields and `stats.daily[today].judged >= 1`. Toolbar badge shows the count. Reload the tab — states persist.

---

## M6 — Popup dashboard

Build `popup/` per `docs/05-UI-SPEC.md` §4.

**Acceptance:** Click toolbar icon: today's counts, totals, streak, and the last-judged words render correctly (compare against raw storage). Toggling a word's state from the popup persists (verify in storage) and is respected by the content script after a tab reload.

---

## M7 — Netflix + generic adapters

Implement `src/adapters/netflix.js` and `src/adapters/generic.js` per `docs/04-SITE-ADAPTERS.md` §3–4, including Netflix SPA-navigation handling (`docs/06-PITFALLS.md` §5).

**Acceptance (Netflix — requires an account):** Play any title with Japanese subtitles selected; cards trigger and pause/resume works, including fullscreen. Browsing between titles without reload keeps working. **Acceptance (generic):** Create a local `test/track.html` (spec in `docs/04` §4) with a `<video>` + Japanese WebVTT track, open it via a `file://`... — content scripts don't run on file:// by default; instead serve it with `npx http-server` and temporarily add `http://localhost:8080/*` to `host_permissions` + content script `matches` while testing, then revert. Cue changes produce cards.

---

## M8 — Options page + in-context SRS

1. Build `options/` per `docs/05-UI-SPEC.md` §5 (settings form, word table with search/filter/state-edit, JSON export, reset).
2. Implement review flow: `pickTarget` step 2, quiz-form card (`docs/05` §2.3), judgments `review-pass`/`review-fail` per `docs/02` §3.

**Acceptance:** Mark a word "Learn it", then in the SW console manually set its `srs.dueAt` to `Date.now() - 1000`. Seek the video back so the word reappears → quiz card appears (answer hidden), bypassing cooldown. "Got it" advances `srs.stage` by exactly 1; "Forgot" resets to 1 and increments `lapses`. Options page edits round-trip to storage. Export downloads valid JSON of the full `vocab` map.

---

## M9 — Polish + QA

1. Run the entire `docs/07-QA-CHECKLIST.md`; fix everything it catches.
2. Reduce logging: keep `AVC.warn` for real failures; `AVC.log` only behind `settings` check? No — simply delete high-frequency per-line logs; keep lifecycle logs (adapter chosen, tokenizer ready, dictionary loaded: N entries).
3. Write `extension/README-INSTALL.md`: 5-step install-unpacked guide for end users.

**Acceptance:** Full QA checklist passes; a fresh Chrome profile can install and reach a first word card within 2 minutes on YouTube following only README-INSTALL.md.
