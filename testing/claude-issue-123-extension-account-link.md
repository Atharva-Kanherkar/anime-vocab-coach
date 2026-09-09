# claude/issue-123-extension-account-link — Test Contract

Fixes [#123](https://github.com/Atharva-Kanherkar/anime-vocab-coach/issues/123): a
learner can be signed in on animevocab.com while the extension popup still reads
"Not signed in", so cloud sync, Listening Mode metering and the AI coach — the
whole paid surface — stay invisible until the learner happens to open `/app`.

## Root cause (established before writing code)

The only path that hands the extension a sync token is the page→extension
postMessage handshake in `web/src/lib/use-extension-link.ts`. It runs only where
`useExtensionLink()` is mounted, which is `/app` (connection banner, cloud sync
panel, install guide). So the extension is linked only if the learner both is
signed in *and* lands on `/app` after installing. A fresh Web Store install with
an animevocab.com marketing tab open — or no animevocab.com tab at all — links
nothing, and nothing in the product tells the learner that.

Two smaller defects fall out of the same area:

- `src/entries/sync-bridge.ts` stores only `{email, name}` from the profile the
  mint endpoint returns, dropping `plan`, so the popup can never name the tier.
- `web/src/components/extension-connector.tsx` is dead code superseded by
  `use-extension-link.ts` — a second, divergent copy of the handshake.

## Functional Behavior

### Auto-link (acceptance 1)

- The background service worker can link the extension with no page open and no
  click, by minting a sync token itself: `POST https://animevocab.com/api/sync/token`
  with `credentials: "include"`. The extension holds `https://animevocab.com/*`
  host permission, so the request carries the Clerk session cookie and is not
  subject to page CORS.
- On HTTP 200 with a token: store `syncToken`, store `syncProfile`
  (`email`, `name`, `plan`), clear `relinkNeeded`, reset `syncAuthFailures`, and
  kick a cloud sync.
- On HTTP 401 (not signed in on this Chrome profile): change nothing. The
  extension stays local-only and no error is surfaced.
- On any other status or a network failure: change nothing.
- Attempts are triggered on: fresh install, browser startup, opening the popup
  while unlinked, and the onboarding page's "Connect account" button.
- Attempts are rate-limited to protect the KV write budget:
  - never while a token is already stored;
  - at most once per hour for background triggers;
  - never within 5 minutes of a site sign-out (so signing out on animevocab.com
    cannot be undone by a probe racing the cookie clear);
  - a user-initiated attempt (`force`) ignores the hourly cooldown but still
    respects the sign-out suppression and the already-linked short-circuit.
- The existing `ensureSyncBridgeInOpenTabs()` path is unchanged and still runs;
  auto-link is an additional, independent path.

### Fresh-install onboarding (acceptance 2)

- `chrome.runtime.onInstalled` with `reason === "install"` opens a first-run page
  (`welcome/welcome.html`). `reason === "update"` does not open it.
- The page shows three steps in the issue's order: watch → first card → connect
  account, with the account step showing live state:
  - checking, while the auto-link attempt is in flight;
  - linked (account + plan named) when a token is present;
  - not linked, with a "Connect account" button that retries the silent link and,
    if that fails, opens `https://animevocab.com/app`.
- The page reacts live to `chrome.storage.local` changes, so completing sign-in
  in another tab flips it to linked without a reload.
- Steps 1 and 2 link out to Netflix/YouTube/Crunchyroll and to the extension's
  own dashboard respectively.

### Popup shows account and plan (acceptance 3)

- Linked: the account row names the account and the plan, e.g.
  `Synced as a@b.com · Pro · 2m ago`. Plan is omitted (not guessed) when unknown.
- Unlinked: the row offers a one-click "Connect account" that attempts the silent
  link first and only opens `/app` when that does not link.
- A successful silent link repaints the popup without the user reopening it
  (existing `chrome.storage.onChanged` listener).

### Profile plumbing

- `SyncProfile` carries `plan: "free" | "pro" | "max" | null`.
- `src/entries/sync-bridge.ts` forwards `plan` from the page's postMessage.
- An older web build that sends no `plan` leaves the stored plan untouched rather
  than overwriting it with `null`.

### Copy

Standing house rule (it reads as an AI tell): no em dash or en dash in prose
people read. Every user-facing string this change adds is free of both, and the
account-status copy shared by the popup and the onboarding page lives in one
exported constant so a test can pin it rather than trusting review.

The popup's existing upgrade button carried one; it is corrected here because it
sits in the same account surface.

## Unit Tests — `test/account-link.test.ts`

- `shouldAttemptAutoLink` returns false when a token is already stored.
- `shouldAttemptAutoLink` returns false inside the 1-hour cooldown and true after it.
- `shouldAttemptAutoLink` returns true inside the cooldown when `force` is set.
- `shouldAttemptAutoLink` returns false inside the sign-out suppression window
  even when `force` is set.
- `shouldAttemptAutoLink` returns true on a first attempt (no prior attempt recorded).
- `interpretMintResponse` maps 200 + token → `linked`, carrying email/name/plan.
- `interpretMintResponse` maps 200 without a token → `error` (no token stored).
- `interpretMintResponse` maps 401 → `signed-out`, 503/500 → `error`.
- `interpretMintResponse` ignores an unrecognized `plan` string rather than
  storing it.
- `normalizeSyncProfile` (storage) keeps a previously stored plan when the new
  payload omits `plan`, and clears it when the payload sends `null`.
- No string in the shared `ACCOUNT_COPY` constant matches `/[—–]/`.
- The onboarding page's HTML matches no `/[—–]/`.
- `planLabel` names only tiers the account reported, and returns an empty label
  for an unknown plan so the popup renders no badge.

## Integration / Functional Tests

- `npm run typecheck` passes at the repo root.
- `npm run build` regenerates `extension/*.js` including the new `welcome.js`
  bundle, and the committed bundles match their sources.
- `npm run test:unit` passes — existing suites plus the new one.
- `cd web && npx tsc --noEmit` and `npm run lint` pass (the web change is the
  removal of the dead connector plus the plan type).
- `extension/manifest.json` still parses and its `web_accessible_resources`,
  permissions and content-script blocks are unchanged apart from what this
  feature needs.

## Smoke Tests

- `node -e` parse of `extension/manifest.json` succeeds and the version is above
  the 0.5.5 currently on the Web Store.
- `extension/welcome/welcome.html` references only files that exist.
- The built `extension/background.js` contains the install-time onboarding open
  and the auto-link call.
- The built `extension/popup/popup.js` contains the plan-bearing account row.

## E2E Tests

Partly N/A. A true end-to-end run needs a Chrome profile with a live Clerk
session on animevocab.com plus an unpacked build, which this workspace cannot
provision non-interactively (no signed-in browser profile, and the extension is
distributed through the Web Store rather than a dev server).

What is verified instead:
- The onboarding page is rendered in a real browser against a stubbed
  `chrome.*` API, in both the linked and unlinked states, and screenshotted.
- The popup account row is rendered the same way for: unlinked, linked-free,
  linked-pro, and re-link-needed.

Manual E2E steps for a reviewer with a signed-in profile are listed below.

## Manual / cURL Tests

1. Confirm the mint endpoint rejects an anonymous caller (this is what makes the
   401 branch the safe default):
   ```
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://animevocab.com/api/sync/token
   ```
   Expect `401`.
2. Confirm the endpoint still sends no `Access-Control-Allow-Origin` (which is why
   the mint has to happen in the background worker, not a content script):
   ```
   curl -si -X OPTIONS https://animevocab.com/api/sync/token \
     -H 'Origin: https://www.youtube.com' -H 'Access-Control-Request-Method: POST' \
     | grep -i access-control
   ```
   Expect no output.
3. Reviewer with a signed-in Chrome profile, unpacked build:
   - Sign in on animevocab.com, close every animevocab.com tab, then load the
     unpacked extension. Expect the onboarding tab to open already showing the
     linked account and plan, and the popup to read "Cloud sync on".
   - Sign out on animevocab.com, reload the extension. Expect onboarding to show
     "Not connected" and the popup to offer "Connect account".
   - Click "Connect account" while signed out. Expect animevocab.com/app to open.
