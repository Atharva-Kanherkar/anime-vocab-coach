# feat/206-account-gate — Test Contract

Issue: [#206](https://github.com/Atharva-Kanherkar/anime-vocab-coach/issues/206)
"The extension requires a free account (no more signed-out use)"

Parent: #205. Related: #198 (cloud-first), #204 (activation).

## Scope

This change puts a free-account gate in front of the extension's learning
features. It does not put anything behind a payment. `TIERS.free` is unchanged.

A signed-out learner gets:

- a small dismissible sign-in chip on supported video sites,
- a popup with one primary sign-in action,
- no overlay, Lens, cards, Listening Mode, or AI/feature API calls,
- a `/start` page that signs them in with Google one-tap or email and links the
  extension through the existing sync bridge.

A signed-in learner keeps every current feature.

## Functional Behavior

### Account state

- A non-empty `syncToken` in `chrome.storage.local` means signed in. An empty or
  missing token means signed out.
- The content script starts in an unresolved state. It must not start the
  pipeline until the token read answers.
- If the token read fails, the extension behaves as signed out. A storage error
  must never unlock the pipeline.

### Signed-out content gate

- `pickAdapter()` returns null while signed out, so no site adapter is started.
- The 2 second adapter poll keeps running. When a token arrives, the next poll
  starts the adapter without a page reload.
- The content script mounts `src/lib/signin-chip.ts` in the top frame only, and
  only when a video or a large player iframe is present.
- The chip has one primary button, a dismiss control, and no other action.
- Dismissing the chip stores `signinChipDismissed` and hides it for later page
  loads. The popup gate remains.
- The chip click asks the background to link this browser first. If the browser
  already has an animevocab.com session, no new tab opens. Otherwise `/start`
  opens in a new tab.
- While signed out, no transcript lookup, anime context, coach, word pick,
  TTS, usage, N5, or Listening request is made from the page.
- The page's own subtitle adapter is not started, so no overlay, Lens, card, or
  Listening state is created.

### Signed-out popup

- The popup hides the normal account row, usage, onboarding, review prompt,
  actions, more options, stamp rally, and footer.
- It shows one gate section with one primary button.
- The gate button uses the same link-first flow as the chip.
- The popup does not mint a token just because it opened. A token is attempted
  only after the learner presses the button.
- If the learner updated from a build before 0.7.2 with a non-empty local deck
  and no token, the gate shows the one-time line:
  "Your words now live in your free account. Sign in to keep them."
  The flag is cleared after it is shown once.

### Background

- A fresh install opens `animevocab.com/start` instead of the local welcome
  page.
- `onInstalled` for an update from a version before 0.7.2 sets
  `signinUpgradeNotice` when there is no token and at least one local word.
- `avc-listen-start` refuses while signed out, before checking a BYO OpenAI key.
  The error names the free account and `/start`.
- `avc-open-signin` records the tab the learner came from, tries the silent
  account link, and opens `/start` only when no session exists.
- On the empty-to-non-empty token transition the background:
  - fires `signin_completed`,
  - uploads the local deck by calling `syncWithCloud()`,
  - focuses the recorded return tab,
  - closes the `/start` tab it opened,
  - clears the recorded return state and the upgrade notice.
- On a sign-out (non-empty to empty token) the background:
  - stops Listening on every tab that has it running,
  - clears `signinChipDismissed` so the gate returns,
  - clears `signinUpgradeNotice`.

### Web `/start`

- `/start` is public. It runs Clerk middleware because it reads `currentUser()`.
- Signed out, it shows:
  - a short dual-subtitle demo,
  - Google one-tap first,
  - the Clerk email sign-in form,
  - no card requirement.
- Signed in, it shows a success state with links to the cloud app and the
  supported video sites.
- On `/start`, a signed-in page mints a sync token and posts the same
  `avc-sync-token` message the `/app` page posts. It also answers the extension's
  `avc-request-token` ping.
- If the extension is not installed, the page still completes sign-in and shows
  an install link after a short wait.

### Events

New feature events, allowlisted on both the extension and the web:

- `signin_gate_shown` with surface `content_chip`, `popup`, or `start_page`
- `signin_started` with the same surfaces
- `signin_completed` with the surface that started the flow
- `signin_gate_dismissed` with surface `content_chip`

The `/api/track` route stores the surface only for these events, using an
allowlist. Any other surface becomes `""`.

### Free plan unchanged

- `web/src/lib/site.ts` `TIERS.free` is not edited.
- The pricing page still says the free plan is free forever.

## Unit Tests

`test/signin-gate.test.ts`

- `isSignedIn("")`, `isSignedIn(null)`, and `isSignedIn(undefined)` are false.
- `isSignedIn("token")` is true.
- `shouldShowSigninChip` is false when signed in, dismissed, not top frame, or
  no player.
- `shouldShowSigninChip` is true for the ordinary signed-out player case.
- `isBeforeAccountGate("0.7.1")` is true; `0.7.2`, `0.8.0`, and `1.0.0` are
  false; malformed versions are false.
- Every `SIGNIN_GATE_COPY` string has no em dash or en dash.
- `listenRequiresSigninCopy` names a free account and `/start`.

`test/signin-events.test.ts`

- Every extension sign-in event is in the web `TRACKABLE_EVENTS` list.
- Extension `SIGNIN_SURFACES` equals web `SIGNIN_SURFACES`.
- `isSigninEvent` and `isSigninSurface` reject unknown values.
- `trackSignin` from a non-worker sends `avc-track-signin` with event and
  surface.
- `sendSigninBeacon` posts a `feature` row with the surface.

`web/src/lib/signin-funnel.test.ts`

- The event and surface lists are allowlists.
- `normalizeSigninSurface` returns `""` for unknown values.
- `isSigninFunnelEvent` rejects names outside the list.

`web/src/lib/middleware-matcher.test.ts`

- `/start` is covered by the Clerk route list and the matcher.

## Integration / Functional Tests

- `npm run typecheck` passes.
- `npm test --prefix web -- --run` passes.
- `npm run test:unit` passes.
- `npm run build` builds the extension.
- `npm run build --prefix web` builds the web app (when Clerk env is present;
  otherwise the type check is the gate).

## Smoke Tests

- Load the unpacked extension with no token on a fake YouTube watch page:
  - the sign-in chip appears,
  - no overlay host, Lens line, or card is present,
  - no request reaches `/api/anime`, `/api/ai`, `/api/transcript`, `/api/me`,
    `/api/n5`, or `/api/tts`.
- Seed a token and wait one poll:
  - the chip disappears,
  - the adapter starts.
- Clear the token:
  - the chip returns.
- Open the popup with no token:
  - only the gate is visible,
  - the normal actions are hidden.
- Open `/start` with no session:
  - the demo and sign-in card render.

## E2E Tests

`e2e/signin-gate.mjs` (real Chromium, real extension, fake YouTube host):

- Signed out: chip visible, no pipeline, no feature API requests.
- Chip dismiss: chip gone, `signinChipDismissed` stored, no `signin_gate_dismissed`
  request is lost (the beacon is asserted at the fake server).
- Signed out popup: gate visible, action sections hidden, one primary button.
- Seed token: chip gone, adapter starts, `signin_completed` fires once.
- Seed token with a `/start` tab open and a recorded return tab: the return tab
  is focused and the `/start` tab closes.
- Clear token: chip returns, Listening stops.

Clerk's real Google sign-in needs a Clerk testing token and real keys. That part
is a manual check, documented below.

## Manual / cURL Tests

- `curl -i -X POST http://localhost:3000/api/sync/token` with no Clerk cookie
  returns 401.
- With a signed-in browser, `POST /api/sync/token` returns a token and profile.
- Visit `/start` signed out: Google one-tap or the Google button and the email
  form render.
- Sign in on `/start` from the chip flow: the video tab regains focus and the
  chip is gone.
- Sign out on animevocab.com: the extension chip returns on the next supported
  page load, and the popup gate returns.
- Confirm `/pricing` still says the free plan is free forever.

## Review 5722205984 regression contract

This amendment replaces the earlier requirement that cache restoration must finish before a token is accepted.

- Sign-out preserves every outgoing word and schedule in a durable, account-bound pending export before clearing the active cache. It attempts upload immediately and retries on sync/startup/alarm; failures never discard the pending export or upload it with another account's token.
- Device-only `settings.openaiKey` survives sign-out and restore and never enters a cloud payload.
- Token storage performs no network I/O inside the storage queue. A failed restore leaves the account linked, retains the restore marker and reports a visible sync error; later sync retries restore before uploading active state. Restore merges any new local words rather than replacing them.
- Netflix tracks and anime context are requested after account state resolves and on a signed-in token transition. Signed-out track requests remain blocked.
- An install-origin sign-in leaves `/start` open on success. Chip/popup flows still return to the original tab and close their sign-in tab.
- `/start` passes lint, counts gate views only while signed out, and shows an installation message without claiming to be connecting when the extension is missing.

Regression verification: unit tests for durable logout recovery, failed restore/retry/queue progress, device-key preservation and signed-in analytics/copy; real-extension sign-in and Netflix-track E2E; web lint/typecheck/unit tests; extension typecheck/unit tests and rebuilt bundle checks. Real Clerk OAuth remains manual as documented above.
