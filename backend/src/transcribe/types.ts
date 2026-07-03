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
  /** Override provider chain for testing (comma-separated names). */
  providerOverride?: string;
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

export const PROVIDER_COST_USD_PER_MIN: Record<string, number> = {
  groq: 0.002,
  deepinfra: 0.0008,
  openai: 0.006
};
