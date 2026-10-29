# feat/n5-full-course — Results

Reviewed against `testing/feat-n5-full-course.md`. All runs are local on 30 October 2026, with OpenAI replaced by the deterministic mock in `backend/test/mock-openai.ts`.

| Gate | Result |
| --- | --- |
| Backend typecheck, unit tests | pass, 304 tests (text, curriculum, domain, tutor/feedback) |
| Backend Worker/D1/KV runtime tests | pass, 55 tests (15 new: all 24 lessons, audio cache, feedback, conversations, budgets, kill switch, deletion cascade) |
| Backend fuzz | pass, 9 domain/text/sanitizer properties + 2 HTTP properties |
| Backend mutation (`domain.ts`, `text.ts`) | 90.42% (break 90); grading `domain.ts` 98.36% |
| Contracts, generated bindings, dependency parity | pass |
| Worker production bundle dry-run | pass, 1024.65 KiB / 176.70 KiB gzip |
| Web lint, typecheck, unit tests | pass, 0 lint errors, 661 tests |
| Web fuzz | pass |
| Web mutation (drafts, routes, credentials, drills, recorder) | 95.65% (break 90) |
| Web production build (`opennextjs-cloudflare build`) | pass |
| Web browser journey (`web/e2e/n5-course.mjs`) | pass, 23 checks in romaji (desktop) and kana (mobile) |
| Extension typecheck, unit tests, committed bundles | pass, 361 tests |
| Extension mutation | 91.85% (break 90) |
| Actual-extension Playwright journey (`e2e/n5-course.mjs`) | pass, 8 checks |
| cURL smoke (`npm run dev:n5`) | 24 units; unit 7 kana lesson without keys; audio 200 `audio/mpeg`; unauthenticated 401 |

## Bugs found and fixed during this branch

- Romaji glued sentence-final particles (`desuka`); the renderer now splits `desu ka`, `masen ka`, `desu ne`.
- Grammar explanations and prompts mixed kana into romaji mode; English teaching text now renders inline Japanese per script, enforced by a test over all 24 lessons in both scripts.
- Workers reject `fetch(..., { redirect: "error" })`, which would have failed every provider call in production; provider calls use manual redirects.
- A background save during the quiz silently dropped the next answer (edits lock while a save is in flight); saving now happens only on the review screen.
- Hidden radio inputs couldn't receive direct clicks; each radio now covers its card.

## Not verified

- Live OpenAI speech, transcription and tutor behavior: no key is available locally. Fallbacks are tested (provider failure, invalid model output, kill switch), but voice quality, latency and Japanese naturalness need a pass in a deployed environment.
- Real Clerk sign-in: browser suites use the existing synthetic-auth mode, as before.
- The content has not been reviewed by a Japanese educator.
