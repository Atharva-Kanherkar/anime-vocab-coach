# claude/gpt-luna-listening-dictionary-d6b46b — Test Contract

## Functional Behavior

- Every caller of the shared AI coach model, including word picking and notebook summaries, uses the documented GPT-5.6 Chat Completions fields: `reasoning_effort` and `max_completion_tokens`, without non-default `temperature` or deprecated `max_tokens`.
- Max-effort coach requests reserve at least 25,000 generated tokens for reasoning and visible output, matching current OpenAI guidance.
- Transcript cues are emitted once across overlapping cache polling and offscreen cache delivery.
- A bounded cue ledger evicts only its oldest cue when full; reaching the cap never clears all dedupe history.
- Transcript responses that finish after an episode/cache-key change are discarded instead of emitting stale cues or repopulating the reset ledger.
- Dictionary entries honor JMdict reading restrictions (`re_restr`) and sense restrictions (`stagk` / `stagr`). For example, `撮る` means “take a photograph”, while `録る` means “record”.
- The generated extension bundles and dictionary stay reproducible from their sources.

## Unit Tests

- `completionTuning` gives max-effort reasoning requests at least 25,000 total generated-token capacity.
- Word-picker requests use low effort and notebook-summary requests use the configured coach effort when the selected model is a reasoning model; classic model overrides keep their prior sampling fields.
- `CueLedger` rejects duplicate keys and retains recent keys when its bounded capacity evicts the oldest key.
- Dictionary parsing selects the first sense applicable to each written form and reading.
- Dictionary parsing honors `re_restr` and resolves ranked kana collisions independently of input order.

## Integration / Functional Tests

- Root TypeScript, unit tests, and extension build pass.
- Web TypeScript, lint, unit tests, and production build pass.
- `npm run build-dict` regenerates the committed dictionary byte-for-byte and passes homograph/sense assertions.
- Generated extension bundles contain the timestamp relay and bounded cue-ledger behavior from TypeScript sources.

## Smoke Tests

- Existing 58 extension tests and 155 web tests remain green before fixes.
- After fixes, all root and web checks remain green with no new lint errors.

## E2E Tests

N/A — this change has no deterministic browser fixture for a live third-party video plus transcript cache. Cross-context cue relay is covered by pure ledger tests and source/build assertions.

## Manual / cURL Tests

- Confirm official OpenAI model, reasoning, pricing, and Chat Completions references match the request contract.
- Inspect generated dictionary values for `録る`, `空ける`, `明ける`, `いる`, `くる`, `人`, and `入る`.
- No live OpenAI call is required because this workspace has no API key; request bodies are verified with mocked fetch tests.
