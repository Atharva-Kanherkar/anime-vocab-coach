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
