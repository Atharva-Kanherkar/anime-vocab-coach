# Merged N5 audit and corrections

Contract: [fix-n5-merged-audit.md](fix-n5-merged-audit.md), committed before implementation. Audited merged PRs #177/#178 at `50666c6`; unfinished extension branch #175 is excluded.

## Confirmed findings and fixes

| Finding | Evidence before fix | Correction |
| --- | --- | --- |
| Invited web-only learners falsely become extension users | Actual gateway with real sync-store wrote `synctoken:user:<id>:v1`; regression failed on the key namespace | Separate N5-only, one-hour server credentials; zero extension-token reads/writes; ordinary extension/paid APIs reject them |
| Lost enrolment response or a second tab overrides the selected reading style | Executed actual hub handlers after a committed/dropped opposite-script write; corrective request was skipped | Reconcile explicit opens and pin script in the lesson URL |
| Lost start response returns the prior script's attempt | Start-receipt key omitted script; backend returned its old attempt before reading current enrolment | Script-specific keys, expected-script contract, atomic enrolment check and recovery action |
| Session recovery stays stuck | Playwright clicked the actual recovery link after restoring API access; practice never reappeared | Full document navigation resets expired layout state while retaining same-account draft |
| Owner exclusions and plan joins use incorrect IDs | Real `:v1` keys made the owner-count regression fail: three linked users instead of two | Parse the terminal version suffix; test real key shapes |

All findings are high-confidence P2 correctness issues. The owner-key parser defect predates N5; it compounds the new course-token analytics regression. Follow-up review also caught a same-key KV write race in the new credential cache; pointer publication is now best effort after successful unique-record persistence, with an explicit rate-limited concurrency test.

## Verification

| Gate | Result |
| --- | --- |
| Extension unit tests / typecheck | 316 tests pass; types pass |
| Actual-extension Playwright | Package 10/10, popup 19/19, learning loop 34/34, cue checks 10/10 |
| Web unit tests / lint | 648 tests pass; zero lint errors, six existing unrelated warnings |
| Backend unit tests / real Worker-D1 | 48 unit tests and 38 runtime tests pass |
| Seeded fuzzing | 7,000 web/shared + 6,000 backend-domain + 200 HTTP cases pass |
| Backend mutation | 140/140 killed; 100%; unchanged 90% gate |
| Expanded web/shared mutation | 443/455 killed; 97.36%; unchanged 90% gate; no exclusions, uncovered mutants, errors or timeouts |
| Browser through web/gateway/Worker/KV/D1 | Complete romaji/kana journeys and new retry, cross-tab and actual session-recovery-link regressions pass with both default Turbopack and the supported webpack fallback |
| Worker bundle / contracts / bindings | Dry-run bundle, schema, generated type and dependency-parity checks pass |

The twelve surviving expanded-scope mutants were inspected. Ten are the previously documented overlapping route/draft/state checks. In each of the two credential-rule modules, removing the empty-input guard still reaches the caught JSON parse failure; those two changes preserve supported JSON input behavior. All 21 mutations in the new web credential helper are killed, including expiry, write-failure and rate-limited-pointer behavior.

The production Cloudflare build completes and emits `.open-next/worker.js`; web/backend/extension type checks pass. Default Turbopack browser verification passes, including disabled/misconfigured preview probes. The standalone web package uses a build-checked local mirror of the shared credential rules, avoiding global tracing-root changes. A negative drift probe rejects a deliberately altered copy, while an exact copy passes.

Screenshots from actual extension cards/review/popup and desktop/mobile course quizzes/results were inspected. Browser evidence is in `/tmp/animevocab-n5-web` and `e2e/shots`; CI uploads the web evidence. The first expanded mutation attempt exposed a sandbox import failure for shared runtime code, so mutation now runs from the repository root instead of excluding it.

No production feature flag, cloud resource, deployment, model call or real learner account is used by this audit.

## Coverage and limits

The browser course test exercises real Next routes, gateway, workerd, KV and migrated D1. A test-only Node preload supplies the web process with the same Miniflare KV as the API through an authenticated loopback bridge. It does not replace authentication or the store. Synthetic Clerk identity remains in use; a real-Clerk sign-in/session-expiry pass is still required before rollout.

Playwright loads the actual packaged/unpacked extension in fresh persistent Chromium profiles. The extension has no merged N5 mode yet. Extension fixtures exercise cards, SRS/review, telemetry relay, popup and owned pages with local providers/network interception; live Netflix/Crunchyroll account playback and voice are not claimed as verified.

The optional-script request is backward compatible with existing API callers. Explicit lesson opens now write enrolment receipts instead of relying on stale initial client progress; receipt retention remains bounded. The preview stays disabled by default.
