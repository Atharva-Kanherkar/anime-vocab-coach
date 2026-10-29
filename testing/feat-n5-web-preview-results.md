# Hosted N5 private preview: verification

Contract: [feat-n5-web-preview.md](feat-n5-web-preview.md), committed at `e348da7` before implementation. Begins #176; does not close the complete course epic or frontend issue.

## Results

| Check | Result |
| --- | --- |
| Web unit suite | 603 tests in 43 files pass |
| Backend real workerd/KV/D1 suite | 36 tests pass |
| Web lint | Zero errors; six existing warnings in unrelated components |
| Web TypeScript | Pass |
| Pure-boundary fuzzing | Four properties, 1,000 cases each, seed 1762026; pass |
| Pure-boundary mutation testing | 264/273 killed (96.70%); nine survivors, zero uncovered/error/timeout mutants; unchanged 90% gate |
| Fresh-profile browser integration | Romaji and kana journeys through real Next gateway, Worker, KV and migrated D1 pass |
| Production Cloudflare build | OpenNext completes and emits `.open-next/worker.js`; no deploy performed |
| HTTP smoke probes | Authenticated read 200; browser bearer 401; cross-origin mutation 403; arbitrary upstream/query 404; default-off page/API 404 |
| Visual/keyboard checks | Both scripts at desktop and mobile sizes; no horizontal overflow, labelled inputs, keyboard script choice and invalid-field focus |

The final browser run and production build were repeated after correcting small-text and primary-button contrast. The primary white-on-orange button contrast is 5.78:1. Inspected lesson, quiz and result screenshots are in `/tmp/animevocab-n5-web`; CI uploads fresh browser evidence and mutation reports. The OpenNext build emits a tracing-root warning while completing successfully.

## Browser evidence

The self-contained `web/e2e/n5-course.mjs` test uses synthetic accounts only. It runs the real API Worker and production D1 migrations rather than replacing the course store. It verifies:

- Separate script onboarding, planned versus available content, original preparation, regional official provider link, manual watch gate and recap.
- Eight objective and two typed questions, server-authoritative objective result, production needing review, missing speaking/listening/kanji evidence and false mastery.
- Unsaved refresh recovery, offline API failure, real concurrent-writer conflict, explicit server reload, byte-identical idempotent retry after the server commits but its HTTP response is lost, and saved result reload.
- Invalid kana question focus, stale-content discard preserving completed history, account-auth loss clearing scoped drafts, no microphone calls and no bearer/private grading keys in course responses.
- Default-off page/API and exact documented curl probes.

The shared Worker test harness now resolves its entry point and migrations relative to its module. All existing 36 backend tests still pass. The web gateway tests separately cover flag, verified identity, per-user credentials, Host/Origin checks, ignored forwarded-host spoofing, method/path/query allowlists, bounded request/response streams, redirects, timeout and sanitized errors.

## Mutation scope and surviving mutants

Stryker instruments `web/src/lib/n5/core.ts`, including route allowlisting, safe links and scoped draft validation. There are no excluded mutations. React, gateway authentication and Worker persistence are outside this percentage and have separate unit/HTTP/browser tests.

The nine survivors were inspected against actual JSON-only storage input and the route matrix:

- Two whitespace guards overlap the strict ASCII path regex; removing trim does not admit whitespace through the regex.
- One query-method guard is implied by the preceding allowed route/method matrix.
- One missing-script fallback changes to another disallowed script value, still rejected.
- Three array/type/size guards overlap JSON array operations and unique known-question bounds. JSON non-arrays cannot provide callable array methods, and failures are caught.
- Two pending revision/null guards overlap equality to the separately validated draft revision and the outer malformed-JSON catch.

The surviving changes do not allow a different owner, attempt, content version, script, unknown route or unsafe provider URL through the supported JSON/HTTP domain. This is a scoped 96.70% result, not a claim about mutation coverage of the entire feature.

## Limits and reproduction

Run commands and trust/rollout details are in [web/N5.md](../web/N5.md). Only the unreviewed Your Lie in April episode 1 pilot is practisable. Five other tracks and later units are planned; voice, listening audio, season/final assessment, reviewed production grading and SRS consumption remain follow-ups. The new web flag stays absent from production configuration.

The working checkpoint is `/tmp/animevocab-n5-web/reviewcheckpoint.json`, isolated from another task's global scratch file. It is intentionally not committed. No real learner data, imported browser profile, model call, provider spend, cloud deployment or production activation was used for verification.
