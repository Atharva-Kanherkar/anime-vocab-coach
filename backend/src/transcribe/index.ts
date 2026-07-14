import type { Env } from "../index";
import type { TranscriptSegment } from "../transcript-types";
import {
  recordProviderSuccess,
  transcribeWithFallback
} from "./providers";
import type { TranscribeOpts } from "./types";

export { getProviderMetrics, listProviderConfigs, resolveProviderChain, TranscriptionError } from "./providers";
export type { TranscribeOpts, TranscribeResult } from "./types";

/** Transcribe PCM via the configured provider chain (cheap → OpenAI fallback). */
export async function transcribePcm(
  env: Env,
  pcm: Uint8Array,
  startSec: number,
  cacheKey: string,
  opts: Partial<TranscribeOpts> = {}
): Promise<TranscriptSegment[]> {
  const language = cacheKey.split(":").pop() || "ja";
  const result = await transcribeWithFallback(env, pcm, {
    language,
    startSec,
    ...opts
  });
  await recordProviderSuccess(env, result.provider, result.durationMinutes, result.estimatedCostUsd);
  return result.segments;
}
