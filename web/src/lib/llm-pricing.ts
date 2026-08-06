// Model pricing + OpenAI usage parsing, so every LLM call can be costed at the
// call site instead of guessed at from a monthly invoice.
//
// Rates are USD per 1M tokens. gpt-5.6-luna is verified against
// developers.openai.com (Aug 2026); the gpt-4.x rates are OpenAI's published
// list prices and match the figures already assumed elsewhere in this repo.
// An unknown model costs 0 and is surfaced as such on the dashboard rather
// than silently guessed — a wrong cost is worse than a missing one.

export interface ModelRate {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M cached input tokens. */
  cachedInput: number;
  /** USD per 1M output tokens (reasoning tokens bill at this rate). */
  output: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
  "gpt-4.1-nano": { input: 0.1, cachedInput: 0.025, output: 0.4 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-4.1": { input: 2.0, cachedInput: 0.5, output: 8.0 },
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
};

export function rateForModel(model: string): ModelRate | null {
  if (MODEL_RATES[model]) return MODEL_RATES[model];
  // Dated snapshots (gpt-5.6-luna-2026-07-09) bill as their base model.
  const base = model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return MODEL_RATES[base] ?? null;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Subset of outputTokens the model spent thinking. Billed as output. */
  reasoningTokens: number;
  /** Subset of inputTokens served from the prompt cache, billed cheaper. */
  cachedInputTokens: number;
}

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  cachedInputTokens: 0,
};

/** Shape of the `usage` object on an OpenAI chat completion (and the final
 * chunk of a stream when stream_options.include_usage is set). */
interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

export function parseUsage(raw: unknown): TokenUsage {
  if (!raw || typeof raw !== "object") return EMPTY_USAGE;
  const u = raw as OpenAiUsage;
  return {
    inputTokens: num(u.prompt_tokens),
    outputTokens: num(u.completion_tokens),
    reasoningTokens: num(u.completion_tokens_details?.reasoning_tokens),
    cachedInputTokens: num(u.prompt_tokens_details?.cached_tokens),
  };
}

/**
 * Cost in USD for one call.
 *
 * Cached input is priced separately and is a SUBSET of prompt_tokens, so it is
 * subtracted from the full-rate input count rather than added on top —
 * double-counting it would overstate spend on every cache hit. Reasoning
 * tokens are already inside completion_tokens and are NOT added again.
 */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const rate = rateForModel(model);
  if (!rate) return 0;
  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const fullInput = usage.inputTokens - cached;
  const usd =
    (fullInput * rate.input + cached * rate.cachedInput + usage.outputTokens * rate.output) / 1e6;
  // Sub-cent costs matter here (a nano call was $0.00014), so keep 6 decimals.
  return Math.round(usd * 1e6) / 1e6;
}

export function isKnownModel(model: string): boolean {
  return rateForModel(model) !== null;
}
