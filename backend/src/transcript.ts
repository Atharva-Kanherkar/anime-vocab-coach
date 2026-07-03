import { bumpHit, bumpMiss, getRecord, hasCoverage, segmentsAt, storeSegments } from "./cache";
import type { Env } from "./index";
import { recordHit, recordMiss } from "./metrics";
import type { TranscriptSegment, TranscriptSource } from "./transcript-types";
import { transcribePcm } from "./transcribe";

export interface LookupResult {
  hit: boolean;
  segments: TranscriptSegment[];
  source?: TranscriptSource;
}

export async function lookupTranscript(
  env: Env,
  cacheKey: string,
  t: number,
  windowSec = 8
): Promise<LookupResult> {
  const record = await getRecord(env, cacheKey);
  if (!record || !hasCoverage(record, t, windowSec)) {
    await recordMiss(env);
    await bumpMiss(env, cacheKey);
    return { hit: false, segments: [] };
  }
  await recordHit(env);
  await bumpHit(env, cacheKey);
  return {
    hit: true,
    segments: segmentsAt(record, t, windowSec),
    source: record.source
  };
}

export async function prefillTranscript(
  env: Env,
  cacheKey: string,
  segments: TranscriptSegment[],
  source: TranscriptSource
): Promise<{ stored: number }> {
  if (!segments.length) return { stored: 0 };
  const record = await storeSegments(env, cacheKey, segments, source, env.TRANSCRIPT_MODEL_VERSION);
  return { stored: record.segments.length };
}

export async function transcribeAndStore(
  env: Env,
  cacheKey: string,
  pcmBase64: string,
  startSec: number
): Promise<LookupResult> {
  const existing = await getRecord(env, cacheKey);
  if (existing && hasCoverage(existing, startSec)) {
    await recordHit(env);
    await bumpHit(env, cacheKey);
    return { hit: true, segments: segmentsAt(existing, startSec), source: existing.source };
  }

  await recordMiss(env);
  await bumpMiss(env, cacheKey);
  const segments = await transcribePcm(env, pcmBase64, startSec);
  if (segments.length) {
    await storeSegments(env, cacheKey, segments, "whisper", env.TRANSCRIPT_MODEL_VERSION);
  }
  return { hit: false, segments, source: "whisper" };
}
