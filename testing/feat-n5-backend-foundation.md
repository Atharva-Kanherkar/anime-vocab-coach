# feat/n5-backend-foundation - Test Contract

## Functional Behavior

This first PR begins #174 with an authenticated, private backend preview. It does not close #174 or advertise a complete course. Production is disabled by default, and both an explicit enable flag and server-owned user allowlist are required. Missing D1 binding fails closed. Existing transcription/auth/metering behavior is preserved.

- Shared versioned TypeScript contracts describe the six planned tracks, the 24-unit syllabus, script mode, preview lesson, enrolment, immutable attempt identity, answer snapshots, results, observations, and remediation outbox.
- Only Your Lie in April episode 1 is an original, explicitly unreviewed preview fixture. Five other tracks stay planned and cannot be enrolled in. No content claims qualified review or complete support.
- Course-owned Japanese text is pure romaji or kana as selected. Attempts freeze content/script version. No mixed or kanji rendering is accepted, no answer keys/accepted responses are sent before completion, and no client score or user ID is trusted.
- Verified sync-token identity owns every mutation/read. Cross-account attempt access returns 404. Invalid auth, malformed JSON, wrong content type, oversized bodies, invalid identifiers, wrong methods, stale versions, unknown fields, and unsupported script return typed errors without writes.
- D1 persists enrolment, watch/practice observations, attempts, and remediation. User/lesson/script/version are pinned. Creation and observations use server-scoped idempotency; reusing a key with a different payload is a conflict. Answers use bounded full snapshots and compare-and-swap revisions; identical replays succeed while divergent same-key replays and stale revisions fail. An attempt can only finish after every objective and typed question has an answer.
- Objective scores come only from server-held keys. Typed answers are stored for later review, not automatically declared writing mastery. Voice is explicitly unavailable and cannot mint credentials or award speaking evidence. Even a perfect fixture result reports preview practice completion, production needs-review, voice unassessed, and mastery false.
- Finishing once creates durable per-question review events with deterministic IDs in the same transaction. Duplicate/concurrent finish produces one immutable result and one event per objective response. Outbox consumption into the actual SRS is deferred to the frontend/extension follow-ups; this PR does not claim consumer-side exactly-once review application.
- Export is scoped to authenticated user; deleting course data removes all associated rows atomically and leaves existing vocabulary/auth/listening data intact.
- No new external model calls, production resources, deployment, pricing changes, or frontend/extension changes. Live voice transport, educator review, published question banks, season/final assessments, billing, and SRS consumers remain explicit follow-ups under #174.

## Unit Tests

- Contract validators reject unknown fields, malformed/non-finite revisions, oversized IDs/text, duplicate/missing/unknown questions, invalid options, script mismatch, and client-supplied grades/identities.
- Script renderer supplies equivalent semantic options in both scripts and never leaks private keys or mixed-script Japanese into public payloads.
- Grader uses the pinned fixture key, scores exact objective answers, records typed production as needs-review, and cannot award mastery/speaking from objective results.
- Idempotency and payload fingerprinting distinguish exact replay from conflicting content; data/version changes cannot silently reinterpret an attempt.

## Integration / Functional Tests

- Actual Miniflare/workerd Worker with local KV and real local D1 runs production migrations and dispatches real HTTP requests; do not substitute a fake SQL Map.
- Test ownership/isolation, database persistence, rollback constraints, concurrent attempts/answer CAS/finalisation, exact and conflicting retries, user-scoped keys, deletion/re-enrolment, and unauthenticated/disabled/unallowlisted states.
- Runtime imports and worker bundle succeed with production flag disabled and no course binding. Existing backend tests continue passing.

## Smoke Tests

- Wrangler production dry-run succeeds without creating cloud resources. Generated local binding types match the local preview config.
- Local HTTP health checks: disabled course 404; enabled allowlisted catalogue 200; missing auth 401; voice 503 without provider fetch; pre-existing public config 200.

## E2E Tests

- HTTP journey in workerd, for both romaji and kana: authenticated catalogue -> course overview -> enrolment -> lesson -> watch event -> attempt -> answer snapshot -> finish -> persisted result -> progress -> remediation -> export -> deletion. Reinstantiate the Worker over the same D1 to verify resume.
- Exercise two accounts, concurrent/replayed submissions, failed finish before complete answers, and malformed request recovery. No browser UI exists in this backend PR; browser E2Es belong to #175/#176.

## Fuzz Tests

- Seeded fast-check properties with at least 1,000 runs per pure validation/grading property and at least 100 runtime malformed request cases. Invariants: invalid shapes never write; arbitrary objects do not crash validation; public payloads contain no keys; rendering preserves semantic answers; grading is bounded and never awards mastery.
- Seeds and counterexamples appear on failure and can be replayed. Fuzzing covers arbitrary Unicode/script input, boundary lengths, revision/idempotency fields, and adversarial grade/identity fields.

## Mutation Tests

- Run StrykerJS against all new executable pure validation/rendering/grading modules. Require a >=90% mutation score (break threshold), no uncovered mutants in this target, and inspect survivors. Do not silently exclude security conditions or lower the gate to make the run pass.
- Mutation target and any justified equivalent-mutant exclusions must be documented in the committed results. Worker/D1 behavior is additionally covered by real-runtime concurrency/ownership tests, not claimed as covered by this pure-module mutation score.

## Manual / cURL Tests

- Reproducible local preview commands and synthetic auth seeding live in backend N5 documentation. Execute the documented curl flow against localhost, including unauthenticated catalogue, catalogue with a local-only synthetic token, and disabled voice. No real user credentials or production data are used.
- Run backend typecheck, existing/new unit tests, runtime E2Es, fuzz suite, mutation suite, Wrangler type generation check, and deploy dry-run. Record exact results in testing evidence before opening a PR. No production deployment smoke test is claimed.

## CI Repair: Root Worker Build

The repository-root Worker build is a supported entrypoint alongside the backend directory. A fresh checkout with only root `npm ci` must resolve every Worker runtime import without requiring `backend/node_modules`. The root manifest must provide the Worker runtime dependency used by the root build; backend standalone installs must continue to work.

- Regression: with no backend dependency tree installed, bundle `backend/src/index.ts` using the root-installed esbuild. It must succeed after root `npm ci`; before the repair it fails resolving `zod`.
- GitHub CI must exercise this cold root bundle before running backend `npm ci`, so a populated backend dependency tree cannot mask missing root dependencies.
- Verify a real root `wrangler versions upload --dry-run --config backend/wrangler.toml` in a clean snapshot with no backend dependency tree, then rerun the existing backend gates. Keep the N5 feature disabled and preserve current API behavior.
- Push the repair to PR #177 and verify the actual Cloudflare Workers build check. A local reproduction alone does not establish that the remote failure is fixed.

## PR Review Repairs

- Attempt recovery: only active attempts pinned to the current lesson/version/full pack hash count toward the five-attempt creation bound. A user can `DELETE /attempts/:id` to abandon an active attempt, including stale content, without losing enrolments, observations or other results. Ownership is enforced, receipts cascade, completed attempts cannot be abandoned, and delete/save/finish races cannot leave orphaned reviews. Full pack hashing remains conservative so edited prompts cannot silently reinterpret existing attempts.
- Keyboard input: script validation checks an NFKC-normalized view with smart apostrophes folded to ASCII. Accept IME spaces, kana wave marks/ellipsis, and Hepburn macron/circumflex vowels (including capitals and decomposed forms). Preserve submitted answer text and receipt identity. Continue rejecting mixed scripts, kanji, emoji, controls and text without letters. Invalid answer errors identify the offending question without echoing typed text.
- Shared responses: progress, review envelopes and exports use shared return types checked by TypeScript. Preserve existing export field names and keep all private storage fields out of responses. Bind COURSE_ID in export SQL and derive generated schema contentVersion from CONTENT_VERSION.
- Storage bounds: atomically cap enrolment receipts at 100 and observation receipts at 1,000 per user, preserving successful idempotent replays at capacity and enforcing limits under concurrent writes. Return specific 429 errors for new writes; another user's capacity remains independent.
- Dependency parity: retain the supported root Worker entrypoint and fail CI if root/backend manifests or lockfiles resolve different Zod versions. Test both matching locks and a deliberate mismatch without changing tracked locks.
- Unit tests cover normalization, answer diagnostics and dependency parity. Real Worker/D1 E2Es cover stale-cap recovery, active abandonment/ownership/cascades/races, keyboard input snapshots, response/export shapes and concurrent storage boundaries. Seeded Unicode fuzzing uses the expanded accepted alphabet while retaining script separation. Run the entire backend unit/E2E/fuzz/mutation gates, schema/binding checks and Wrangler dry-run; inspect mutation survivors and maintain the existing threshold without exclusions. Verify remote checks after pushing.
- Manual smoke checks use the local synthetic-identity harness. Browser E2Es remain N/A for this API-only revision. Restore the existing package description formatting without unrelated package changes.
