# claude/issue-133-extension-link-status — Test Contract

Fixes [#133](https://github.com/Atharva-Kanherkar/anime-vocab-coach/issues/133):
`/app` shows a red "Could not link extension [retry]" banner while the extension
popup reports signed in, Cloud sync on, Free plan. The link is working; the page
says it is broken.

## Root cause (established before writing code)

`web/src/lib/use-extension-link.ts` collapses two independent facts into one
`LinkState`:

1. whether the extension is present and answering the page's ping, and
2. whether *this page load* managed to mint a sync token.

`broadcastToken()` fails, hits `setLinkState("error")`, and the banner renders
"Could not link extension". But since #124 the extension mints its own token
from the background worker with the browser's session cookie, so a page-side
mint failure says nothing about whether the extension is linked. A learner whose
extension is linked and syncing sees an error about a link that is fine.

Two further defects in the same area:

- **The error carries no reason.** `broadcastToken()` swallows the cause in a
  bare `catch`, so 401 (session gone on this site), 503 (`getOrCreateSyncToken`
  could not reach KV) and a blocked network are one indistinguishable red
  banner. The learner is told to retry with no idea what would make it work, and
  the next QA report cannot say which failure it was.
- **A transient failure is a dead end.** Nothing retries on its own, so a 503
  that heals in seconds leaves the banner up until the learner notices the
  `retry` link.

## Functional Behavior

### Presence and token health are separate

- `useExtensionLink()` exposes extension presence (`installed`, plus the
  detection state) and token health (`tokenState`, `tokenError`) as separate
  values. Nothing about a token failure may change the detection state.
- Detection states stay as they are: `checking` → `installed` when the extension
  answers, or `checking` → `missing` after the 8s timeout.
- Token states: `idle` (nothing attempted yet), `ok` (a token was broadcast),
  `failed` (the mint failed, with a reason).

### The banner tells the truth (acceptance 1 and 3)

- Extension answering + token ok → "Extension connected", healthy dot. Word
  count when the snapshot has one, as today.
- Extension answering + token failed → still reads as connected, because it is,
  with the token problem named separately and a retry. Never "Could not link
  extension".
- Extension answering + the extension reports it already holds a token → healthy
  even when this page's own mint failed: the link the banner describes is live.
- Extension not detected (`missing`) → "Extension not installed yet" with the
  install-help link. Unchanged.
- Never-detected + token failed → the handshake genuinely did not complete:
  "Could not link extension" is correct here and only here.

### The reason is specific (acceptance 2)

`tokenError` carries a `kind` and learner-facing copy derived from what actually
happened:

- HTTP 401 → signed out on this site; the fix is to sign in again.
- HTTP 5xx (including the route's own 503) → the sync service is unavailable;
  retrying is the fix, and the page does it automatically.
- Any other HTTP status → names the status so the next report is actionable.
- A thrown fetch (offline, blocked, extension-blocked) → a network problem.
- Copy for every kind names the status where there is one, and contains no long
  dashes.

### Transient failures retry themselves

- A `failed` token state schedules one automatic retry, then backs off
  (roughly 2s, 5s, 15s, then stops), so a brief 503 clears without the learner
  doing anything.
- Automatic retries stop after a 401: no amount of retrying fixes a signed-out
  session, and each attempt is a wasted KV round-trip.
- The manual `retry()` always attempts once regardless of the backoff state.
- The retry budget must not reintroduce the token-mint storm from #123: at most
  one in-flight mint at a time, and the existing once-per-load + 20-minute
  refresh contract is unchanged.

### The extension can say it is already linked

- `sync-bridge.ts` includes `linked: boolean` on its `avc-ext-present`
  announcement, true when `syncToken` is a non-empty string in extension
  storage.
- The page treats a missing `linked` field (older extension build) as unknown
  and falls back to its own token state. No behaviour regression for a learner
  who has not updated yet.
- Reading `linked` never blocks the announcement: a storage failure announces
  presence without the field.

## Unit Tests

`web/src/lib/extension-link-status.test.ts` (new pure module holding the
decisions, so they are testable without a DOM):

- `tokenErrorFor(401)` → kind `signed_out`, copy mentions signing in.
- `tokenErrorFor(503)` / `(500)` → kind `unavailable`, copy mentions retrying.
- `tokenErrorFor(418)` → kind `http`, copy names 418.
- `tokenErrorFor(null)` (thrown fetch) → kind `network`.
- `shouldAutoRetry` is true for `unavailable` and `network`, false for
  `signed_out`, false once the attempt budget is spent.
- `retryDelayMs` grows across attempts and is undefined past the budget.
- `connectionLabel` for the matrix in Functional Behavior: detected+ok,
  detected+failed, detected+extension-linked+failed, missing, never-detected+failed.
- No long dashes in any copy the module produces.

`web/src/lib/use-extension-link.test.ts`: N/A — the hook is DOM and
`postMessage` bound; its decisions live in the pure module above, and its wiring
is pinned by the source test below.

## Integration / Functional Tests

`web/src/lib/extension-link-wiring.test.ts` (source-read pins, same approach as
`middleware-matcher.test.ts`):

- `broadcastToken` classifies the failure through `tokenErrorFor` and no longer
  calls `setLinkState("error")`.
- The detection state is never written from the token path.
- `sync-bridge.ts` announces `linked` from `syncToken`.

## Smoke Tests

- `npm run test:unit` in `web/` passes (existing suites included).
- `npx tsc --noEmit` clean in `web/` and at the repo root.
- `node build.mjs` at the root rebuilds the extension bundles with no diff on a
  second run.
- `/app` renders with the banner in every state via the dev server, driven by
  stubbing the token route (see Manual below).

## E2E Tests

`e2e/app-link-status.mjs` (added during implementation; headed browser, manual
gate). Runs the real `/app` against a dev server with
`NEXT_PUBLIC_AVC_DEV_NO_CLERK=1`, fails `/api/sync/token` on demand, and walks
the banner through: working mint, 503 named with its status, self-heal with no
click, extension-reports-linked, and 401.

The extension side is simulated by posting exactly the messages
`sync-bridge.ts` posts, and that message shape is pinned by
`extension-link-wiring.test.ts`. Loading the packaged extension instead would
mean serving `/app` at the animevocab.com origin (the bridge only matches that
host), and the dev server's client bundle does not hydrate when proxied to a
different origin, which was tried and abandoned.

    NEXT_PUBLIC_AVC_DEV_NO_CLERK=1 npm run dev --prefix web -- --port 4311
    node e2e/app-link-status.mjs

## Manual / cURL Tests

With `npm run dev` in `web/` and `NEXT_PUBLIC_AVC_DEV_NO_CLERK=1`:

1. Token route healthy: `curl -i -X POST localhost:3000/api/sync/token` returns
   200 with `{token, profile}`. `/app` shows "Extension connected" (or
   "Extension not installed yet" without the extension loaded).
2. Token route failing: temporarily force the route to 503 and reload `/app`.
   The banner must NOT read "Could not link extension"; it must name the sync
   service being unavailable, and it must clear itself when the route recovers,
   without clicking retry.
3. Signed-out mint: force the route to 401. The banner names the session and
   stops retrying.
