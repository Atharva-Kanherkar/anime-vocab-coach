# fix/lens-subs-cloud-dashboard — Test Contract

Four user-reported problems, one branch:

1. The Subtitle Lens shows nothing until Listening Mode is started.
2. Lens subtitles are ugly, badly cut, and out of step with the line being spoken.
3. The Lens UI needs to look good.
4. "Review" / "progress dashboard" opens a local `dashboard.html` inside the
   extension instead of the cloud app. Reviews done there feel disconnected
   from the account. The cloud app needs a proper review and progress view,
   and every extension entry point should open it.

## Root causes (established before writing code)

- **(1) YouTube:** the hidden caption track fetch returns an **empty body**.
  YouTube's `captionTracks[].baseUrl` now carries `exp=xpe`, and
  `/api/timedtext` answers `200` with 0 bytes unless the request also carries
  the player's proof-of-origin token (`pot`, plus `c=WEB`). Checked by hand:
  the baseUrl of a real watch page with `&fmt=json3` returned `0 b''`. So
  every video reported `missing / empty-track`, the page showed "No Japanese
  captions… start Listening Mode", and the Lens was fed only by the DOM
  fallback (JA captions visibly on) or by Listening Mode.
- **(2) Badly cut lines:**
  - (a) Auto-generated (ASR) tracks: json3 events are rolling word windows, not
    sentences, so a cue is a fragment that cuts across sentences.
  - (b) The DOM fallback on an ASR track fires a new "line" every time a word
    is appended, so the Lens re-renders a growing fragment several times a
    second.
  - (c) Listening Mode utterances go to the Lens whole, so a long utterance is
    a wall of text.
- **(4)** Every entry point calls `chrome.runtime.getURL("dashboard/dashboard.html")`.
  The cloud app `/app` has no review screen at all ("Reviews run in the
  extension popup"). Sync is push-only (extension → cloud), so nothing done on
  the web could reach the extension.

## Functional Behavior

### F1. YouTube hidden track loads without Listening Mode
- `youtube-main.ts` (MAIN world) watches the page's own `fetch` and
  `XMLHttpRequest` for `/api/timedtext` URLs carrying `pot=`, and posts
  `{source:"avc", type:"avc-timedtext-pot", videoId, pot, c}` to the content
  script. The URL is never logged in full.
- If the content script has tracks but no `pot` for the video after ~1.5s, it
  posts `avc-prime-captions`. MAIN switches captions on (`toggleSubtitles` or
  the CC button), waits for the timedtext request to be captured (max 4s), then
  switches them back off **only if they were off before**. The learner's
  caption state ends up as it started.
- Track fetch: `baseUrl + fmt=json3 + pot + c`. If the fetch without a pot comes
  back empty and a pot arrives later, the fetch is retried once with the pot.
  Only after that retry is still empty does it report `empty-track`.
- With a working track: `reportCaptions({state:"ok"})` and **no** "No Japanese
  captions" toast. The Lens shows the cue at its timestamp with Listening Mode
  off.
- A video change drops the pot for the previous video (the token is bound to
  the video id).

### F2. Cues are sentences, not fragments
- New pure module `src/lib/cue-sentences.ts`:
  - `parseJson3Words(data)`: flatten `events[].segs[]` into timed words
    (`tStartMs + tOffsetMs`). Skip `aAppend` newline events and whitespace-only
    segs.
  - `buildSentenceCues(words, lang)`: group words into cues. A cue ends on
    - sentence punctuation (`。！？!?.`),
    - a silence gap ≥ 0.8s between words, or
    - a length cap (JA 28 chars / EN 90 chars), breaking at the last word
      boundary.
    Each cue's `end` = the last word's end (next word start, or +0.6s,
    capped). Cues never overlap.
  - Manual (non-ASR) tracks keep their authored cues. Only their text is
    normalized, and adjacent events are not merged.
- ASR json3 goes through `buildSentenceCues`. So `cueAt(t)` returns the
  sentence being spoken at `t`, and it changes once per sentence, not once per
  word.
- DOM fallback (no track): a rolling caption (the new text starts with, or
  contains, the previous text) is **settled** before emitting. It emits when
  the text stops growing for 700ms, or when it is replaced by unrelated text.
  Only the new tail is emitted, never the same prefix twice.

### F3. Listening Mode lines are paced into subtitle-sized pieces
- New pure `splitForLens(text, lang, maxChars)` in `src/lib/lens-lines.ts`:
  - splits at sentence punctuation first;
  - then splits any piece longer than `maxChars` (JA 28, EN 90) at the last
    `、`/`,`/space before the cap, or else hard at the cap;
  - never returns empty pieces;
  - joined pieces reproduce the input with whitespace normalized.
- `handleTranscript` shows piece 0 in the Lens now. Each next piece follows
  after `clamp(len × 90ms JA | len × 45ms EN, 1.2s, 4s)`. The chain is
  cancelled by a newer line, a session change, or `hideLens`.
- Cards and exposure counting are unchanged: every sentence still goes to
  `onLine(..., {lens:false})`.

### F4. Lens UI
- Two-line max per language row (`-webkit-line-clamp: 2`), `text-wrap: balance`,
  a centred glass pill, a stronger JP type scale, and a subtle bottom
  underline per word state. A small romaji/kana reading appears in the tooltip
  as today.
- On a line change the old line cross-fades (≤160ms) and does not jump.
- No layout thrash: position updates only when the video rect changes.
- Pointer invariants unchanged: the container stays `pointer-events:none`,
  only tokens and the tip opt in.
- Existing tip actions (Learn/Know/Skip, Q/K/X) unchanged.

### F5. Every "review / dashboard" entry point opens the cloud app
- New `CLOUD_REVIEW_URL = WEB_URL + "/app#review"` and
  `CLOUD_PROGRESS_URL = WEB_URL + "/app#progress"` in `src/config.ts`.
- popup "Review" and "Dashboard" buttons, the first-card toast
  ("Open review dashboard"), welcome and onboarding links open these URLs.
  None of them opens `dashboard/dashboard.html`.
- Unlinked / free users land on `/app`. Sign-in is free there, and the existing
  bridge links the extension and pushes the snapshot on arrival. Free-tier
  limits are unchanged (nothing new is gated).
- `extension/dashboard/` stays in the package (and still works if opened
  directly) but nothing links to it.

### F6. Two-way review sync (web ⇄ extension)
Server contract (web):
- `POST /api/sync/review` `{ base: string, result: "pass"|"fail", day: "YYYY-MM-DD" }`,
  authenticated like `/api/sync/snapshot` (cookie or Bearer sync token).
  - 404 `word_not_found` when the word is not in the snapshot. 409 `not_due`
    when the word is not `learning` or has no review.
  - Applies the same SRS as the extension (`SRS_INTERVALS` = `[0, 4h, 24h, 3d, 7d, 21d]`):
    - pass: `stage+1`, `dueAt = now + SRS[stage]`; past stage 5 the word
      becomes `known` with `review: null`.
    - fail: `stage = 1`, `lapses += 1`, `dueAt = now + 4h`.
  - Sets the word's `lastSeenAt = now`, so the merge keeps it over a stale push.
  - `daily[day].reviews += 1` and `judged += 1`.
  - Appends `{ seq, base, result, at }` to `envelope.webReviews` (`seq` from
    `envelope.webReviewSeq + 1`), bumps `revision`, returns
    `{ envelope, word }`.
- `PUT /api/sync/snapshot` accepts optional `appliedWebReviewSeq: number` and
  drops `webReviews` with `seq <= appliedWebReviewSeq`. `webReviews` is capped
  at 1000 (oldest dropped). A push without the field keeps the op log.
- `GET /api/sync/snapshot` returns `webReviews` and `webReviewSeq` in the
  envelope.

Extension:
- `pushSnapshotOnce`: GET the envelope → `storage.applyWebReviews(ops)` applies
  every op with `seq > local webReviewSeq`, in seq order, in **one** storage
  write (vocab + stats + webReviewSeq) → export → PUT with
  `appliedWebReviewSeq`. On 409 the whole cycle (GET, apply, export, PUT) runs
  again, max 2 times. A 409 must not re-PUT a stale export.
- Local review judgments (`review-pass` / `review-fail`) now also set
  `lastSeenAt = now`, so the server merge (newer `lastSeenAt` wins) keeps the
  newest review from either side.
- Applying an op to a word that is not learning locally (known/ignored/missing)
  changes nothing in vocab, but still advances `webReviewSeq`.
- The cloud app pings the bridge (`avc-sync-now`) after each review, so the
  extension on the same browser pulls within seconds.

### F7. Cloud app Review + Progress
- New nav section **Review** (`#review`):
  - The due queue, most overdue first (same rule as the extension:
    `learning` + `review.dueAt <= now`).
  - Card front: the word, large, in the JP round face. The source title shows
    as an eyebrow.
  - "Show answer" (Space) reveals reading + romaji, gloss, and the source line
    (JA + EN).
  - "Again" (1 / F) → fail, "Got it" (2 / J / Enter) → pass. Each posts
    `/api/sync/review`, updates the snapshot locally from the response, pings
    the extension, and advances.
  - Progress bar (n / total). An "All caught up" state shows the next due time.
    An empty state (no words) links to getting started.
  - An error on a POST keeps the card and shows an inline retry. No silent loss.
- **Progress** section, redesigned neatly and computed from the snapshot:
  - Stat tiles: words collected, known, learning, due now, streak, minutes
    watched.
  - 30-day activity bars (reviews + judged per day).
  - Review pipeline by stage (1–5), and state split (known / learning / new).
  - Top shows (words by `source.title`, top 6).
  - The existing gamification (leaderboard, streak) stays reachable in this
    section.
- "Today" dashboard copy stops saying reviews only run in the popup. It gets a
  primary "Review N words" button to `#review`.
- Works in light and dark themes and at 375px width.

## Unit Tests
Extension (root `vitest`):
- `test/cue-sentences.test.ts`
  - `parseJson3Words_offsetsAndSkipsAppends`: word times = tStart+tOffset;
    `aAppend` and `"\n"` segs dropped.
  - `buildSentenceCues_splitsOnPunctuation`: "こんにちは。元気？" becomes 2 cues.
  - `buildSentenceCues_splitsOnSilenceGap`: a gap ≥ 0.8s splits.
  - `buildSentenceCues_capsLength`: a 60-char unpunctuated JA run gives cues
    ≤ 28 chars each, and the concatenation equals the input.
  - `buildSentenceCues_noOverlap`: `cue[i].end <= cue[i+1].start`.
  - `rollingCaption_emitsOnlySettledTail` (DOM settle helper).
- `test/lens-lines.test.ts`
  - splits on 。！？; long pieces split at 、 before the cap; hard split when no
    break exists; no empties; round-trip equality; EN at spaces.
  - `lensPieceDelay` clamps to [1200, 4000].
- `test/youtube-pot.test.ts`
  - `extractPot(url)` → `{videoId, pot, c}` from a timedtext URL. Null without
    `pot`.
  - `withPot(baseUrl, pot)` sets `fmt=json3`, `pot`, `c` and keeps the
    signature params.
- `test/web-review-apply.test.ts` (storage.applyWebReviews with a fake
  `chrome.storage`):
  - applies pass/fail in seq order; skips `seq <= stored`; advances
    `webReviewSeq`; one `set` call; non-learning word is a no-op but the seq
    advances; `lastSeenAt` bumped.
- `test/cloud-sync.test.ts` (extend or add): a 409 re-runs GET+apply+export;
  the PUT body carries `appliedWebReviewSeq`.
- `test/entry-urls.test.ts`: no source under `src/` references
  `dashboard/dashboard.html` outside `entries/dashboard.ts`; the popup,
  content, welcome and onboarding-ui use `CLOUD_REVIEW_URL` /
  `CLOUD_PROGRESS_URL`.

Web (`web/ vitest`):
- `web/src/lib/web-review.test.ts`
  - `applyWebReview` pass advances stage + dueAt; stage 5 pass → known.
  - fail resets to stage 1, lapses+1, +4h.
  - not-due / not-learning → `not_due`; missing → `word_not_found`.
  - bumps `lastSeenAt`, daily reviews/judged, appends op with next seq,
    revision+1.
  - `pruneWebReviews(envelope, appliedSeq)` drops `<=` and caps at 1000.
  - `mergeCloudSnapshots` after a web review: a stale extension push (older
    `lastSeenAt`) does not revert the review.
- `web/src/lib/progress-stats.test.ts`: tiles, 30-day series (zero-filled),
  stage buckets, top shows.

## Integration / Functional Tests
- Extension typecheck + all root unit tests green (`npm run typecheck`,
  `npm run test:unit`).
- Web: `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` green in `web/`.
- The PUT route with `appliedWebReviewSeq` prunes the log; without the field it
  keeps it (route-level test or a lib-level test of the same function).

## Smoke Tests
- `npm run build` (extension) produces bundles. `node e2e/verify-package.mjs`
  passes.
- `cd web && npm run build` succeeds.

## E2E Tests
- New `e2e/youtube-lens-pot.mjs` (headed/headless Chromium + the real
  extension, youtube.com fulfilled by Playwright):
  - A fake `movie_player` exposes `getPlayerResponse()` with a JA track.
    `/api/timedtext` without `pot` → 200 empty. With `pot` → json3 ASR
    word events for 2 sentences.
  - Captions start **off**. `toggleSubtitles()` makes the page request timedtext
    with `pot=TEST`.
  - Assert: Listening Mode is never started; the Lens shows sentence 1 while
    `currentTime` is inside it and sentence 2 after; no "No Japanese captions"
    toast; captions are back off after priming.
- Existing `e2e/youtube-session.mjs` and `e2e/copilot-keys-lens.mjs` still pass.
- Cloud Review UI checked in a browser against `next dev` with
  `DEV_NO_CLERK` and a seeded snapshot. Screenshots of Review (front,
  revealed, caught up) and Progress in light + dark, at desktop and 375px.

## Manual / cURL Tests
- `curl -s "<baseUrl>&fmt=json3" | wc -c` → 0 (the proven root cause).
- With `next dev` + DEV auth:
  - `curl -X POST localhost:3000/api/sync/review -d '{"base":"食べる","result":"pass","day":"2026-09-25"}'`
    → 200 with a stage-advanced word.
  - Repeating it before due → 409 `not_due`.
  - An unknown base → 404.
- Real YouTube (manual, by the reviewer): open a JA video with captions off and
  Listening off. The Lens shows sentence-sized lines in time with speech.
- Popup → "Review" opens `https://animevocab.com/app#review`.
