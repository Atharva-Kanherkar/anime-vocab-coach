# issue-13-ai-coach - Test Contract

Ships the first two AI anime-coach features (issue #13) and defers the rest.

## Scope (AC1: first 2 features, defer rest)

- **Explain-in-scene** (`mode: "explain"`): beginner-English meaning + why the
  character phrased it this way in this line (tone, politeness, anime register).
- **Memory hooks** (`mode: "hooks"`): three memory hooks tied to the exact line.
- Deferred: review-sentence generation, episode recap, ask-about-this-line.

## Constraints (issue #13)

- Every call is tied to a word + line; only the single line is sent, never a full transcript.
- Responses cached by word+line+level; cache hits cost $0 and do not consume quota.
- Free tier gets a small taste; Pro gets a meaningful monthly cap.

## Usage limits by plan (AC2)

- Free: `FREE_AI_CALLS_PER_MONTH` (default 5) per Clerk user per month.
- Pro: `PRO_AI_CALLS_PER_MONTH` (default 300). Pro is read from Clerk
  `publicMetadata.plan` (Dodo linking is a follow-up).
- Enforced in `web/src/app/api/ai/coach/route.ts`; counters in `AVC_SYNC_KV`.

## Cost per active user (AC3)

- Model `gpt-4.1-nano` (verified Jul 2026: $0.10/$0.40 per 1M tokens).
- Per call ~350 in + 250 out ≈ **$0.00014**.
- Realistic free user (5 calls): ~$0.0007/mo. Realistic Pro (~40 calls): ~$0.006/mo.
  Worst-case Pro (300 calls): ~$0.042/mo — under 0.5% of Pro net revenue.
- Caching drives repeated-content cost toward zero.

## UI entry point (AC4)

- Working AI coach card in the hosted app dashboard (`/app`), replacing the
  previous "coming soon" placeholder. Recent words prefill; shows remaining quota.

## Unit Tests

- `normalizeCoachRequest` validates mode, requires word+line, clamps oversized input.
- `coachCacheKey` is stable per input and differs by mode.
- `runCoach` shapes explain + hooks responses, caps hooks at 3, throws on HTTP error
  and on empty content. (OpenAI `fetch` is mocked.)
- `aiLimitForPlan` returns the correct per-plan cap.

## Integration / Build

- `cd web && npm run test:unit` passes (now runs all `src/lib` tests).
- `cd web && npx eslint src` passes.
- `cd web && npm run build` compiles `/api/ai/coach` and `/app`.

## Manual Verification (Clerk off, dev)

- POST `/api/ai/coach` with a valid body and an invalid key returns 502 `openai_401`
  (proves a real OpenAI request is issued; a valid key returns content).
- Invalid mode / missing word / malformed JSON return 400.
- `/app` renders the AI coach with recent-word chips; the error path degrades
  gracefully; a valid `OPENAI_API_KEY` produces real explanations and hooks.

## Deploy note

Set the key as a Worker secret: `cd web && npx wrangler secret put OPENAI_API_KEY`.
