# hotfix/luna-chat-no-explicit-reasoning — Test Contract

## Functional Behavior

- Requests using the default `gpt-5.6-luna` coach configuration omit the explicit `reasoning_effort` field, allowing OpenAI's documented `medium` default to apply.
- Reasoning-model requests continue to use `max_completion_tokens` and do not send unsupported classic sampling fields (`temperature` or `max_tokens`).
- Callers that intentionally provide an explicit supported reasoning effort, such as background work at `low`, continue to send that value.
- Classic non-reasoning model overrides retain their existing `temperature` and `max_tokens` request contract.
- Production configuration no longer forces `AI_COACH_REASONING_EFFORT=max`.

## Unit Tests

- `ai-coach.test.ts` verifies the default Luna coach request omits `reasoning_effort` while retaining a reasoning-model completion budget.
- `ai-coach.test.ts` verifies explicit Luna reasoning efforts are preserved.
- Existing caller and model-family tests remain green.

## Integration / Functional Tests

- Run the full Vitest suite in `web`.
- Run the Next.js production build in `web`.

## Smoke Tests

- After deployment, authenticated `POST /api/ai/coach/stream` must return streamed content rather than `data: {"error":"openai_400"}`.
- The extension copilot must show an AI reply instead of “AI unavailable. Try again.”

## E2E Tests

- Manual production verification in the existing Chrome extension session covers the affected end-to-end path: extension → AnimeVocab Worker → OpenAI → streamed reply.

## Manual / cURL Tests

- Inspect the generated OpenAI request in unit tests and confirm `reasoning_effort` is absent for the default Luna path.
- Verify the deployed Worker version and repeat a short chat request in the production extension.
