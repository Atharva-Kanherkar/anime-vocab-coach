import type { TranscriptSegment } from "../transcript-types";

/** Raw segment shape returned by OpenAI-compatible Whisper APIs. */
export interface WhisperRawSegment {
  start: number;
  end: number;
  text: string;
}

export interface WhisperRawResponse {
  text?: string;
  segments?: WhisperRawSegment[];
  error?: { message?: string };
}

export interface TranscribeOpts {
  language: string;
  startSec: number;
  timeoutMs?: number;
}

export interface TranscribeResult {
  segments: TranscriptSegment[];
  provider: string;
  model: string;
  durationMinutes: number;
  estimatedCostUsd: number;
  fallbackUsed: boolean;
}

export interface ProviderConfig {
  name: string;
  model: string;
  costPerMinuteUsd: number;
  apiKey?: string;
  enabled: boolean;
}

// Rough per-minute estimates for the default model on each provider. Used only
// for the cost figure on the stats endpoint; openai tracks gpt-4o-mini-transcribe
// (the configured TRANSCRIBE_MODEL), not whisper-1.
export const PROVIDER_COST_USD_PER_MIN: Record<string, number> = {
  groq: 0.002,
  deepinfra: 0.0008,
  openai: 0.003
};
