# N5 extension pilot

Private episode-one slice of #175, on top of merged #177, #178 and #179. This does not close the full extension issue or establish N5 proficiency.

## Try it

1. Run `npm ci && npm run build` in the repository root.
2. Load `extension/` unpacked at `chrome://extensions` (Developer mode).
3. Connect an AnimeVocab account eligible for the private pilot. Production access is disabled by default; this PR does not activate it.
4. Open **N5 Course · private pilot** in the popup. Choose romaji or kana.
5. Open Your Lie in April S1E1 with legitimate provider access, refresh the video tabs, select the tab and explicitly confirm the episode. An English-learning installation also confirms Japanese course focus.
6. Show the lesson beside the video. Original targets use the chosen script. Live cards/Lens suspend during focus; exiting restores ordinary viewing without changing stored settings or the deck.
7. Choose **Finish episode and practise**. The player must acknowledge pause and capture-stop must be confirmed before a fixed AnimeVocab lesson URL opens. Resume playback/listening explicitly.

A watch receipt records explicit learner intent. It is never assessment credit. The hosted objective/typed runner owns attempts; the backend owns grading. Voice, full reviewed content, finals, live target prioritization and SRS consumption remain follow-ups.

## Architecture and recovery

- `/v1/n5/extension/state` returns a bounded, authenticated teaching projection: verified owner, pinned context, original targets, at most five active attempt links and aggregate counts. It contains no questions, grading keys or raw summaries.
- The background accepts strict commands from exact owned extension pages. Provider frames can act only on their own bound player; app-origin messages can only request an authenticated refresh.
- Local caches/outboxes are keyed by verified owner and credential fingerprint. A successful fresh response verifies the owner before a relink can recover queued work. A known 401/404 invalidates offline authorization while preserving owner data and pending receipts. Account changes invalidate bindings.
- Watch events are persisted before network delivery or tab opening. Stable keys deduplicate retries. A full queue errors without deleting pending work. Retired-version work is retained for recovery. Offline lesson preparation is provisional; hosted assessments require connectivity.
- Bindings live in `storage.session`; outboxes live in `storage.local`. Worker restarts retain bindings; full browser restarts require reconfirming the player. Changed URLs, replaced videos and player-session changes unmount focus.
- Pending audio starts have generation fences in both background and offscreen. Offscreen retries check cancellation each time; late-acquired streams stop before an audio graph is constructed. Serialized listening-state writes prevent a cancelled start from restoring REC after stop.
- The hosted course emits an origin-checked refresh hint on route changes. The background fetches the authoritative state; the hint contains no result or credential.
- No browser permissions were added. Existing general vocabulary records and settings remain separate.

## Verification

```sh
npm ci
npm ci --prefix backend
npx playwright install chromium
npm run typecheck
npm run test:unit
npm run test:n5:fuzz
npm run test:n5:mutation
npm run build
npm run test:e2e:n5
node e2e/n5-system.mjs
npm run pack
npm run verify:package
```

`test:e2e:n5` uses the actual unpacked extension, a fresh Chromium profile, local HTTPS provider fixtures and real local Worker/KV/D1. It checks both scripts, ordinary settings/deck preservation, failed pause/capture acknowledgement, a pending capture start, durable offline replay across a stopped worker, SPA invalidation, resumed normal cards and account isolation. No production credentials, telemetry or model calls are used. Its hosted destination is a route fixture; `cd web && npm run test:e2e:n5` separately tests the full Next gateway → Worker → D1 practice journey.

The new CI job installs both root and backend dependencies and runs the extension/browser, seeded fuzz, mutation and responsive architecture-guide checks. The mutation scope covers context/command/route/outbox parsing and capture coordination, with a 90% minimum.

For local manual API inspection, run `npm run dev:n5 --prefix backend`. Use the printed local URL with the synthetic token (which has no production access):

```sh
curl -i -H 'Authorization: Bearer avc_st_n5local' \
  http://127.0.0.1:PORT/v1/n5/extension/state
```

No live Netflix/Crunchyroll subscription session was used by automated tests. Real provider playback and frame behavior remain a release check before allowlisting learners.

## Explainer

`docs/n5-system/index.html` is a self-contained interactive guide, deployed independently to the `animevocab-n5-system` Vercel project. It has no account integration, learner data or external scripts. Vercel hosts this guide; the application continues to run on Cloudflare. `e2e/n5-system.mjs` verifies desktop/mobile layout, keyboard tabs, script switching and every component explanation, locally or with `N5_SYSTEM_URL` pointing at the deployed share link.
