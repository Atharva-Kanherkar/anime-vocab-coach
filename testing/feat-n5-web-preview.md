# feat-n5-web-preview: Test Contract

## Functional Behavior

- Begin #176 with the hosted private pilot supported by merged #177. Stable `/app/n5`, lesson and attempt/result routes enable a later #175 extension handoff. Only Your Lie in April episode 1 is practisable; other tracks/units are labelled planned. Do not claim complete six-track support, voice, SRS integration, season/final tests or JLPT mastery.
- Default-off server feature flag hides the course page, gateway and navigation entry. Require a verified signed-in identity. The same-origin gateway obtains the existing sync token server-side and sends it only to the fixed API Worker (or an explicitly configured loopback upstream in development). No browser-provided user ID, bearer, upstream URL or grade changes identity. No credentials reach browser props, HTML, URLs or storage.
- Gateway allows only the needed N5 methods/paths and pure script query; requires exact same-origin mutation Origin, rejects cross-site fetches, bounds JSON bodies at 16 KiB, prevents redirects, times out upstream calls and returns private no-store responses. Auth/storage/network failures use safe errors without leaking upstream bodies or credentials.
- Choose romaji or kana separately from general app settings. Prepare with goals/vocabulary/grammar; recap appears after explicit watch confirmation. Legal provider link states regional availability/subscription limits. Watching never awards assessment credit.
- Create one server-pinned attempt with a stable operation key, then render MCQ and typed tasks from the public lesson. No private keys/client authoritative grading. Submit complete snapshots with revision/idempotency metadata; only finish after the current snapshot is acknowledged. Preserve the same request identity on a lost-response retry. Prevent double clicks and conflicting concurrent writers from silently overwriting state.
- Resume attempts from the server after navigation/refresh. Versioned, owner/attempt/content/script-scoped session drafts preserve unsaved answers across refresh/network loss; validate/bound drafts before use, clear on confirmed account mismatch/completion/discard; retain through signed-out expiry or transient auth loss while hiding content, and prevent cross-user attachment. No microphone/provider calls. Missing speaking/listening/kanji evidence stays unassessed; production needs review and mastery stays false.
- Recovery covers loading/empty/error, auth loss, storage unavailability, stale content, revision conflict, invalid answers with field focus, and active-attempt abandonment. Keep typed work visible through retryable failures. Completed results are immutable and based only on server evidence.
- Reuse the app theme/navigation and provide desktop/mobile layouts, visible focus, labelled fieldsets/inputs, keyboard operation and polite status/alert messages. All owned Japanese instructional strings use the selected script; English UI/explanations remain allowed.

## Unit Tests

- Gateway: flag/auth/origin/method/path/query/body bounds, fixed upstream/redirect policy, private token forwarding, no browser token leakage, bounded upstream failure/timeout and per-user identity.
- Pure request/draft helpers: exact immutable snapshot identity, scoped draft validation, bounds/duplicates, recovery classification and safe provider URLs. Malformed input must not throw or cross account/content/script identity.

## Integration / Functional Tests

- Next handlers bridge synthetic verified web identities to the actual workerd/KV/D1 backend and production migrations. No replacement course store. Test account ownership, duplicate saves, stable lost-response retry and real server objective grading; provider/model calls remain unavailable.
- Existing web and backend tests continue to pass; general settings, decks, billing and transcription routes remain unchanged.

## Smoke Tests

- Web lint, TypeScript, production OpenNext build, generated shared contracts and backend typecheck pass. Default-off page/API return unavailable; invalid caller receives auth failure; enabled local pilot renders.

## E2E Tests

- Fresh-profile Playwright drives both pure-script flows through real Next and Worker: choose script, prepare, provider link/manual watch, recap, quiz/typed tasks, save/finish, honest result and refreshed resume. Assert no answer keys or bearer tokens in browser responses/storage/HTML, and check mobile layout/keyboard/focus.
- Exercise offline draft refresh, lost save response with exact retry, revision conflict without overwriting, stale content/discard, API auth loss with draft retention, and unavailable voice state without getUserMedia.

## Fuzz Tests

- At least 1,000 fixed-seed cases per new pure draft/request boundary property: arbitrary JSON/Unicode, forged ownership/script/content, duplicate/oversized answers, stable snapshot identity and untrusted path/query input. Preserve shrinking/replay information.

## Mutation Tests

- Stryker instruments the new pure draft/request validation module, with an unchanged >=90% gate, no uncovered mutants and inspected survivors. Document exact scope; gateway/runtime/React paths have dedicated unit/HTTP/browser tests and are outside the mutation percentage. No exclusions to hide missing boundary coverage.

## Manual / cURL Tests

- Document synthetic-only local startup and exact curl checks for flag/auth/CSRF/path bounds. Inspect screenshots for desktop/mobile in each script after browser tests. No real credentials, signed-in browser clone, model spend, production deployment or flag activation is needed.

## PR review 5693117444: locked corrections

- Clerk loading shows neutral loading, signed-out expiry hides content and retains drafts, while confirmed mismatched accounts hide content and clear drafts, and a transient HTTP 401 hides content but retains owner-scoped unsaved drafts for same-account reauthentication. Component tests mock real `useUser` loading/expired/mismatch transitions without the dev bypass.
- Dashboard navigation and course layout require a successful backend catalog access probe for the verified session owner. Disabled/malformed config, denied users and backend failures hide the pilot without breaking `/app`. Normalize trusted API origins; allow only the production API, explicit branch previews of that same Worker and loopback development. No arbitrary origins. Use locally verified `auth().userId` for N5 identity; read a full Clerk profile only when a missing server credential must be minted. Existing token lookup uses two KV reads and handles malformed records safely.
- Extract and unit-test the attempt save/retry/conflict transitions. Acknowledged unchanged answers skip saving; lost finish responses retry finish without writing another answer revision. Keep blocked typed answers read-only and selectable. Require explicit confirmation before deleting an unfinished attempt. Results URLs redirect active attempts to their editing URL.
- Lesson handoff offers resume for existing active attempts and only starts a new attempt deliberately. Hub visits with an unchanged script skip enrolment writes. HTTP/non-JSON server failures preserve status/auth semantics and use server-error copy; only fetch network failures use offline copy.
- Format N5 components for review, remove the feature's global Turbopack root override, and exercise default Turbopack plus the production build. Extend browser coverage for finish-response loss, unchanged save, lesson resume, confirmed discard and 401 draft recovery. Expand the scoped mutation gate to the pure attempt state machine, retain >=90% without exclusions, and fuzz its invariants. Update evidence and PR scope; no live Clerk-key verification is claimed.
