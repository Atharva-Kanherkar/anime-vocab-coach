# Issue 206 verification

Contract: [feat-206-account-gate.md](feat-206-account-gate.md).

- Extension: 406 unit tests pass; `npm run typecheck` passes.
- Web: 718 unit/component tests pass; `npx tsc --noEmit` and production build pass.
- `node e2e/signin-gate.mjs`: 22/22 checks pass in a fresh Chromium profile with the real extension and fake YouTube/AnimeVocab hosts. Production APIs and telemetry are blocked.
- `npm run pack && npm run verify:package`: 10/10 checks pass against the actual ZIP.
- `/start`: desktop and 390px mobile smoke pass, including missing-extension fallback and no browser errors. Signed-out Google/email rendering is covered by component tests with Clerk mocked.
- `TIERS.free` and pricing copy are unchanged.

Reviewed fixes include signed-out API guards, Copilot/Lens teardown, cancellation of pending Listening starts, stale session/course responses, stale sync/mint responses after logout, tab-return attribution, persistent dismissal and late-player detection. Explicit sign-out clears the account cache; subsequent sign-in restores the owned cloud snapshot before accepting the token. Legacy local decks are retained and uploaded on first sign-in.

## Remaining manual verification

Real Google/email OAuth and the under-30-second install journey require configured Clerk keys and a Clerk testing token. These were not available in this checkout; no live login was exercised. With those configured, follow the contract's manual checks, including an unauthenticated `POST /api/sync/token` returning 401 and a Google sign-in returning to the video tab.

An actual Chrome Web Store upgrade from 0.7.1 was not exercised. The version predicate is unit tested, and the one-time notice plus legacy-deck upload are browser tested with seeded state. No deployment or merge was performed.

## Review 5722205984 follow-up

All ten inline findings were addressed. Sign-out now retains unsynced progress in a durable account-bound pending export, flushes it with the outgoing token and retries failed uploads. Device API keys remain local across sign-out/restore. Token acceptance is independent of restore requests; restore runs outside the storage queue, retains its retry marker on failure and exposes a popup sync error with a retry action. A successful restore merges new local words. Outgoing snapshots replay cloud reviews before upload.

Install-origin sign-in keeps `/start` open. Chip/popup sign-in still returns to the video tab. Netflix requests its tracks/context after gate resolution and when signing in mid-episode. `/start` lint, signed-in event overcounting and missing-extension copy are corrected.

Fresh verification:
- Extension typecheck and 410 unit tests pass.
- Web lint: zero errors (six existing warnings); 718 tests, typecheck and production build pass.
- Real extension gate E2E: 30/30, including install success, unsynced offline sign-out, device-key preservation, restore failure/retry and mid-episode Netflix sign-in.
- Netflix tracks: all three timing journeys pass with `AVC_E2E_GATE_DELAY_MS=500`, including the first subtitle cue.
- Packaged ZIP: 10/10 checks pass; committed bundles rebuilt.

Live Clerk OAuth remains the previously documented manual check.
