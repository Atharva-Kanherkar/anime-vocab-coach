# Hosted N5 private preview: verification

Contract: [feat-n5-web-preview.md](feat-n5-web-preview.md), committed at `e348da7` before implementation. Begins #176; does not close the complete course epic or frontend issue.

## Results

| Check | Result |
| --- | --- |
| Web unit suite | 619 tests in 45 files pass |
| Backend real workerd/KV/D1 suite | 36 tests pass |
| Web lint | Zero errors; six existing warnings in unrelated components |
| Web TypeScript | Pass |
| Pure-boundary fuzzing | Six properties, 1,000 cases each, seed 1762026; pass |
| Pure-boundary mutation testing | 339/349 killed (97.13%); ten survivors, zero uncovered/error/timeout mutants; unchanged 90% gate |
| Fresh-profile browser integration | Romaji and kana journeys through real Next gateway, Worker, KV and migrated D1 pass |
| Production Cloudflare build | OpenNext completes and emits `.open-next/worker.js`; no deploy performed |
| HTTP smoke probes | Authenticated read 200; browser bearer 401; cross-origin mutation 403; arbitrary upstream/query 404; default-off page/API 404 |
| Visual/keyboard checks | Both scripts at desktop and mobile sizes; no horizontal overflow, labelled inputs, keyboard script choice and invalid-field focus |

The final browser run and production build were repeated after correcting small-text and primary-button contrast. The primary white-on-orange button contrast is 5.78:1. Inspected lesson, quiz and result screenshots are in `/tmp/animevocab-n5-web`; CI uploads fresh browser evidence and mutation reports. The feature-specific global Turbopack root override was removed. The browser journey now exercises default Turbopack, and the production build exercises the production bundler.

## Browser evidence

The self-contained `web/e2e/n5-course.mjs` test uses synthetic accounts only. It runs the real API Worker and production D1 migrations rather than replacing the course store. It verifies:

- Separate script onboarding, planned versus available content, original preparation, regional official provider link, manual watch gate and recap.
- Eight objective and two typed questions, server-authoritative objective result, production needing review, missing speaking/listening/kanji evidence and false mastery.
- Unsaved refresh recovery, offline API failure, real concurrent-writer conflict, explicit server reload, byte-identical idempotent retry after the server commits but its HTTP response is lost, and saved result reload.
- Invalid kana question focus, stale-content discard preserving completed history, transient account-auth loss retaining scoped drafts for the same account, no microphone calls and no bearer/private grading keys in course responses.
- Default-off page/API and exact documented curl probes.

The shared Worker test harness now resolves its entry point and migrations relative to its module. All existing 36 backend tests still pass. The web gateway tests separately cover flag, verified identity, per-user credentials, Host/Origin checks, ignored forwarded-host spoofing, method/path/query allowlists, bounded request/response streams, redirects, timeout and sanitized errors.

## Mutation scope and surviving mutants

Stryker instruments `web/src/lib/n5/core.ts` (264/273 killed, 96.70%) and `web/src/lib/n5/attempt-state.ts` (75/76 killed, 98.68%). This covers route/link/draft boundaries and the extracted pure edit/save/acknowledge/retry/conflict/finish transitions. There are no excluded mutations. React, gateway authentication and Worker persistence are outside this percentage and have separate unit/HTTP/browser tests.

The nine core-helper survivors were inspected against actual JSON-only storage input and the route matrix:

- Two whitespace guards overlap the strict ASCII path regex; removing trim does not admit whitespace through the regex.
- One query-method guard is implied by the preceding allowed route/method matrix.
- One missing-script fallback changes to another disallowed script value, still rejected.
- Three array/type/size guards overlap JSON array operations and unique known-question bounds. JSON non-arrays cannot provide callable array methods, and failures are caught.
- Two pending revision/null guards overlap equality to the separately validated draft revision and the outer malformed-JSON catch.

The surviving changes do not allow a different owner, attempt, content version, script, unknown route or unsafe provider URL through the supported JSON/HTTP domain. The remaining state-machine survivor removes a redundant finish guard: finish freezes editing only after answers are acknowledged, so the unchanged-answer check still prevents a second save. This is a combined scoped 97.13% result, not feature-wide mutation coverage.

## Limits and reproduction

Run commands and trust/rollout details are in [web/N5.md](../web/N5.md). Only the unreviewed Your Lie in April episode 1 pilot is practisable. Five other tracks and later units are planned; voice, listening audio, season/final assessment, reviewed production grading and SRS consumption remain follow-ups. The new web flag stays absent from production configuration.

No real learner data, imported browser profile, model call, provider spend, cloud deployment or production activation was used for verification.

## Review corrections

Review 5693117444 is covered by these additional checks:

- Mocked Clerk component tests with the bypass disabled cover loading before hydration, signed-out expiry, a confirmed different user, a transient non-JSON 401 hiding content while preserving drafts, and same-owner remount. No live Clerk instance or test keys were used.
- Server tests cover locally verified session identity, full-profile minting only for a missing token, normalized production/explicit same-Worker preview origins, rejection of unrelated origins, private access probes, malformed config hiding the nav, and a two-read/corrupt-record-safe token lookup.
- Browser probes remove synthetic backend access and verify course 404 plus a working dashboard without the nav. A separate restart uses malformed config and verifies dashboard 200 and course 404.
- Browser journeys verify unchanged-script hub visits create no enrolment, direct lesson resume creates no extra attempt, and active results URLs redirect to editing. Lost finish responses retry an identical finish payload with zero extra answer writes. Blocked text can be focused/selected; cancelling discard preserves the attempt and confirmation deletes it.
- Eight reducer tests and two additional 1,000-case fuzz properties cover immutable pending receipts, acknowledgement, dirty/unchanged snapshots, conflicts, restored lost responses and finish retries. HTTP failures retain status even with HTML bodies; generic server errors do not say the learner is offline.

All N5 components were reformatted to make recovery transitions and result markup reviewable. The hosted pilot remains disabled by default, with the original content/voice limitations unchanged.
