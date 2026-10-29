# N5 backend foundation verification

Contract: [feat-n5-backend-foundation.md](feat-n5-backend-foundation.md). This evidence covers the private foundation slice of #174, not the full course/content/voice deliverable.

| Gate | Result |
| --- | --- |
| Backend TypeScript | Passed |
| Existing and new unit tests | 25 passed across 3 files |
| Real workerd/KV/D1 HTTP tests | 17 passed across 2 files, including both script journeys, concurrency, rollback, persistence and HTTP fuzz properties |
| Domain fuzzing | 4 properties, 1,000 cases each, seed 1742026 |
| HTTP fuzzing | 2 properties, 100 cases each, seeds 1742026 and 1742027; included in the 17 runtime tests |
| Stryker mutation | 130/130 killed, 100.00%, no surviving/uncovered/error/timeout mutants |
| Runtime-derived request schemas | Match checked-in shared JSON Schema |
| Generated local binding types | Match Wrangler config |
| Production Wrangler deploy dry-run | Passed without provisioning or deployment |
| Documented manual curl checks | All 6 passed against a loopback Worker |
| Production dependency audit | `npm audit --omit=dev`: zero findings |

Mutation scope is `backend/src/n5/domain.ts`: all executable strict validation, script rendering, answer completeness, grading and fingerprinting functions in that module. Routing and SQL are not included in that percentage; their behavior is tested in the actual Worker/D1 runtime. No mutants are excluded. The first run killed 129/130; the surviving removal of the romaji regex's start anchor exposed a missing leading-kana test. Adding that negative case killed the remaining mutant without changing the gate.

Manual checks executed the commands described in `backend/N5.md`, substituting the loopback URL printed by `npm run dev:n5`: unauthenticated catalogue 401, authenticated catalogue 200, kana enrolment 200, kana lesson 200, attempt creation 200, voice endpoint 503 with `voice_unavailable`. Only synthetic local tokens were used.

Review findings addressed before completion:

- Tightened script checks to reject control whitespace and both orders of mixed-script text.
- Separated the independent explicit answer oracle from unit-test registration so runtime tests are counted correctly.
- Validated the D1 finalisation transaction by forcing an outbox insert failure and checking that status/revision/result roll back.
- Added strict deletion-body rejection and correct HTTP `Allow` headers for method errors.
- Verified a missing feature flag with no D1 binding leaves the course disabled and existing public config working.
- Checked the complete API/store/migration and the integration diff against the original contract. Saved attempt script/version, owner isolation, private key projection, retry receipts and unassessed-skill labels remain consistent across increments.

Remaining scope is explicit: no qualified educator review, full six-season question bank, live provider grading/voice, season/final/delayed tests, actual SRS consumers, production account lifecycle hook, or public rollout is claimed. All these remain under #174. The preview fixture always reports mastery=false. No production smoke test or deployment was performed.

Detailed mutation JSON/HTML reports are generated under ignored `backend/reports/mutation/` and uploaded by CI. The per-step review scratchpad is `/tmp/reviewcheckpoint.json` and is not committed.

## CI repair: repository-root Worker build

The initial PR passed all four GitHub Actions jobs but failed Cloudflare's separate Workers build check. A clean checkout with only repository-root dependencies reproduced `Could not resolve "zod"` for the new backend validation import. Installing backend dependencies made the same command pass, explaining why the original backend job masked this install-path problem. Private Cloudflare logs were unavailable; the actual remote check must verify the repair after push.

The root build entrypoint now declares Zod at the same version range as the standalone backend. CI first installs only root dependencies, asserts `backend/node_modules` is absent, and bundles `backend/src/index.ts` before backend installation. This avoids relying on a developer's populated backend dependency tree.

Verification of the repair:

- Before the manifest change, both the cold root esbuild bundle and root `wrangler versions upload --dry-run --config backend/wrangler.toml` failed on missing Zod.
- After copying only the repaired root manifests into the same clean checkout and running root `npm ci`, both commands passed with `backend/node_modules` still absent.
- Root TypeScript and all 316 extension unit tests passed. Existing backend unit, real Worker/D1, fuzz and mutation gates were rerun; the validation/grading source did not change.
- No dashboard settings, live Worker deployment, feature flags or learning behavior changed. The remote result is visible in PR #177's checks.

## PR review repairs

Addressed all seven inline review comments after committing the expanded contract in `f8366aa`:

- Current practice capacity counts only matching lesson/version/full pack hash. Stale attempts stay readable; an owner can abandon any active attempt with `DELETE /attempts/:id`, with cascading receipt cleanup. Completed results survive abandonment/finish races. The full pack hash intentionally remains conservative about prompt changes.
- NFKC keyboard validation accepts IME spaces, smart apostrophes, Hepburn macrons/circumflexes and kana wave marks/ellipsis without transliterating or mixing scripts. Original answer text and idempotency fingerprints remain intact. Invalid answer errors include only the offending question ID.
- Progress/reviews/export now return shared response types. Existing export field names are preserved, and COURSE_ID is bound into export SQL.
- Enrolment/event receipt limits are atomic at 100/1,000 per user, with successful replays still available at capacity. Concurrent and cross-account cases pass.
- Root/backend Zod manifest and locked-version parity is now checked before backend dependency installation, including negative mismatch tests. The existing root build entrypoint is retained without requiring dashboard changes.
- Generated schema metadata imports CONTENT_VERSION. Restored the existing package description formatting.

Verification on the reviewed changes:

- Backend TypeScript: pass. Unit tests: 41 pass; dependency-parity tests: 4 pass, including deliberately mismatched in-memory lockfiles and manifest ranges.
- Actual Worker/KV/D1 E2Es: 29 pass, including both full-script journeys, pack/version/lesson recovery, abandon/save/finish races, response projections, keyboard snapshots/replays, concurrent capacity limits, ownership, rollback and deletion.
- Five seeded domain properties x 1,000 cases plus two HTTP properties x 100 cases: 5,200 pass.
- Stryker: 137/138 killed (99.28%), zero uncovered/error/timeout mutants, unchanged 90% CI gate, no exclusions. The one survivor replaces smart apostrophes with an empty string instead of an allowed ASCII apostrophe in the validation-only view. This is equivalent for the boolean validator: neither punctuation counts as a letter, and removing or replacing it cannot change valid-script membership; persisted raw text is untouched. No artificial test or exclusion was added for that equivalent case.
- Generated request schemas and binding checks: pass. Production Wrangler deploy dry-run: pass, with no upload.
- Ten local curl probes using the synthetic identity: unauthenticated catalogue 401; catalogue/enrolment/lesson/attempt 200; voice 503; kana keyboard snapshot 200; mixed-script snapshot 400 with question ID; abandon 200; subsequent read 404.

Review scratch state is isolated at `/tmp/animevocab-n5-review/reviewcheckpoint.json` because the global `/tmp/reviewcheckpoint.json` is currently owned by an unrelated concurrent branch. No scratch files are committed. Remote checks will be verified after the repair commits are pushed.

## Follow-up review: remove permanent lockouts and finish input/export consistency

The contract extension in `f7da529` supersedes the previous lifetime enrolment/event caps and snake_case export names.

- Enrolment history now keeps the latest 100 receipts and prunes older ones atomically. Script changes and fresh-key requests remain available at capacity. Retained-key replay cannot reset the current preference; evicted keys are new requests.
- Durable observations are unique per user/episode/kind, separate from a rolling 1,000-request receipt window. Rewatching returns the canonical observation ID and receipt eviction cannot erase progress. Conflicting concurrent key reuse cannot create a losing observation.
- Forward migration 0002 preserves original response IDs for retained legacy receipts, deduplicates observation state, and bounds retry history. A persisted upgrade with 1,006 legacy rows verifies progress, retained replay/conflict, canonical IDs for fresh keys, attempt preservation, restart and account deletion.
- Romaji now accepts smart double quotes; kana accepts full-width parentheses, corner quotes and colon. Raw stored/exported text is preserved. Exports consistently use camelCase and share review-event types with `/me/reviews`.

Verification:

- Backend TypeScript, 48 backend unit tests and 4 dependency-parity tests: pass.
- 36 actual Worker/KV/D1 HTTP tests: pass, including migration/restart, 105 script changes beyond the former cap, concurrent duplicate observations at 1,000 receipts, conflicting writers, ownership, deletion and all expanded keyboard cases.
- Six domain properties x 1,000 cases and two HTTP properties x 100: 6,200 pass. An initial run timed out on redundant unchanged public-fixture checks inside the unrelated key/revision property; removed that repeated work, retained its dedicated exact public-projection unit tests, and reran the full fuzz command successfully. Case counts, seeds and timeouts were not relaxed.
- Stryker: **140/140 killed (100%)**, zero survivors/uncovered/error/timeout mutants, unchanged 90% gate and no exclusions. Correction to the preceding evidence: the previously described equivalent quote-removal mutant was not equivalent in kana mode, which rejects these unsupported quote forms. Added kana counterexamples; they kill both apostrophe- and double-quote-removal mutants.
- Request-schema/binding generation checks, Zod manifest/lock parity and production Wrangler dry-run: pass. The deploy bundle was not uploaded.
- Local curl probes passed for catalogue authentication, enrolment/lesson/attempt/voice, same-episode fresh-key deduplication, both punctuation snapshot examples, script switching and camelCase export with original typed text.

No production database migration or manual deployment was performed. Apply both versioned migrations before enabling the new Worker layout; flag-off remains the rollback path. Remote checks will be verified on the pushed commit.
