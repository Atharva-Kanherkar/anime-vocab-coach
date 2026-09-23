# Issue 159 Telemetry Blind Spot — Test Contract

## Root Cause (investigated before this contract)

- The Chrome Web Store serves **v0.5.5** (checked live, 2026-09-23). `manifest.json`
  moved to 0.5.5 on 2026-07-18 (#79) and to 0.5.6 on 2026-09-08 (#123); 0.5.6 was
  never published.
- Every learning-loop beacon (`card_known`, `word_saved`, `review_done`, …) landed
  on 2026-09-18 (#111/#112), the funnel milestones on 2026-09-18 (#75/#77), and the
  content-script → service-worker relay that stops CORS dropping them on 2026-09-19.
  None of it is in 0.5.5. The published build can only emit `review_prompt_*`
  (popup/dashboard, 10 mined + ≥1 review), which explains 0 `extension_funnel` rows.
- The handful of `word_saved` / `review_done` / `card_known` rows come from
  unpacked dev/e2e builds running master.
- Live probes: `/api/track` and `/api/extension/track` both answer 204 for
  extension-shaped requests, with and without a bearer. Master's code path is
  correct; the gap is that it never shipped, and nothing in telemetry could say so.

## Functional Behavior

- Every extension learning-loop beacon (`POST /api/track`, `kind: "feature"`) carries
  `v: <manifest version>`; every funnel beacon (`POST /api/extension/track`) carries
  the same `v`.
- The server accepts `v` only when it is a dotted numeric version (1–4 parts, each
  1–5 digits). Anything else (missing, non-string, `1.0.0-beta`, `<script>`, >23
  chars) is stored as `""`. Invalid `v` never drops the event.
- `/api/track` writes the version to a new `clientVersion` blob APPENDED to
  `EVENT_BLOBS` (existing blob positions unchanged). Website beacons send no `v`,
  so their rows carry `""`.
- `/api/extension/track` writes the version as `blob2` of `extension_funnel`
  (`blob1` remains the event name; existing funnel query unchanged). Body limit
  stays 256 bytes and fits the longest event + version.
- Linked installs keep sending the sync-token bearer, so learning-loop rows carry
  the learner's userId (#112 path unchanged).
- `/owner` gains an "Extension builds" panel: the learning-loop events the
  EXTENSION fires, grouped by `clientVersion`, with distinct learners; `""` is
  labelled as unstamped (pre-0.5.7). `streak_day` / `card_unlocked` are written by
  the sync route with no version and are excluded, or every current learner would
  read as an old build. It honours the focus-user filter like the Learning loop
  panel, and is included in the AI-insights digest.
- The extension ships as **0.6.0** (release PR #144). This branch originally bumped
  to 0.5.7; that was dropped in favour of 0.6.0 when #144 merged first.

## Unit Tests

- `test/feature-events.test.ts` — beacon body includes `v` from `chrome.runtime.getManifest()`;
  still `{kind, name}` otherwise; bearer still attached when linked.
- `test/extension-events.test.ts` (or existing funnel test) — funnel body includes `v`.
- `web/src/lib/track-events.test.ts` — `normalizeClientVersion` accepts `0.5.7`,
  `1`, `1.2.3.4`; rejects `""`, `1.0.0-beta`, `1..2`, `123456.1`, non-strings.
- `web/src/lib/telemetry*.test.ts` — `EVENT_BLOBS` ends with `clientVersion`; the
  first 13 positions are unchanged.
- `web/src/lib/telemetry-query` tests — `featureBuildsSql` filters `kind='feature'`,
  learning-loop names, optional userId, groups by the clientVersion column.

## Integration / Functional Tests

- `/api/track` route test: feature event with a valid `v` writes `clientVersion`;
  with a hostile `v` writes `""`; pageview without `v` writes `""`.
- `/api/extension/track` route test: allowlisted event with `v` writes
  `blobs: [event, version]`; invalid `v` writes `[event, ""]`.
- Owner dashboard load: the new query's rows fold into `extensionBuilds`, and a
  failure of that one query does not blank the other panels.

## Smoke Tests

- Root: `npm run typecheck`, `npm run test:unit`, `npm run build`.
- `web/`: `npm run test:unit` (or `npx vitest run`), `npm run lint`, typecheck.
- `extension/manifest.json` is valid JSON with version `0.6.0`.

## E2E Tests

- `npm run test:e2e:learning-loop` — existing real-Chromium run: Know/Learn on a
  card and a dashboard review arrive at the server as `word_saved` / `review_done`
  with the bearer; extended to assert the body carries `v` equal to the manifest version.

## Manual / cURL Tests

- `curl -X POST https://animevocab.com/api/track -H 'content-type: application/json' -d '{"kind":"feature","name":"word_saved","v":"0.5.7"}'` → 204 (after web deploy).
- After publishing 0.6.0: link an install, save + review a word, open
  `/owner?user=<id>` → "Learning loop" shows `word_saved`/`review_done` for that
  user and "Extension builds" shows `0.6.0`. **Requires the store release — cannot
  be run from this PR.**
