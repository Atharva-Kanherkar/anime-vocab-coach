import {
  bumpTranscribeMiss,
  coversTime,
  getRecord,
  hasCoverage,
  isRecordCurrent,
  segmentsAt,
  storeSegments
} from "./cache";
import type { Env } from "./index";
import { acquireTranscribeLock, releaseTranscribeLock, waitForPeerLock } from "./lock";
import type { TranscriptSegment } from "./transcript-types";
import { transcribeWithFallback, recordProviderSuccess } from "./transcribe/providers";
import { chunkBucket, decodePcmBase64, pcmDurationMinutes } from "./validate";
import { addMinutes, getUsage } from "./usage";

export interface LookupResult {
  hit: boolean;
  segments: TranscriptSegment[];
  source?: "whisper";
  stale?: boolean;
}

export async function lookupTranscript(
  env: Env,
  cacheKey: string,
  t: number,
  windowSec = 8
): Promise<LookupResult> {
  const record = await getRecord(env, cacheKey);
  if (!record || !isRecordCurrent(record, env.TRANSCRIPT_MODEL_VERSION)) {
    return { hit: false, segments: [], stale: !!record };
  }
  if (!hasCoverage(record, t, windowSec)) {
    return { hit: false, segments: [] };
  }
  // Warm lookup is KV-read-only — never write metrics here (free-tier put budget).
  return {
    hit: true,
    segments: segmentsAt(record, t, windowSec),
    source: "whisper"
  };
}

export async function transcribeAndStore(
  env: Env,
  licenseId: string,
  cacheKey: string,
  pcmBase64: string,
  startSec: number
): Promise<LookupResult> {
  const { pcm, error: pcmErr } = decodePcmBase64(pcmBase64);
  if (pcmErr) throw new Error(pcmErr);

  const existing = await getRecord(env, cacheKey);
  if (existing && isRecordCurrent(existing, env.TRANSCRIPT_MODEL_VERSION) && coversTime(existing, startSec)) {
    // Warm transcribe hit: return cached segments with no KV writes.
    return { hit: true, segments: segmentsAt(existing, startSec), source: "whisper" };
  }

  const lockOwner = `${licenseId}:${chunkBucket(startSec)}`;
  const gotLock = await acquireTranscribeLock(env, cacheKey, startSec, lockOwner);
  if (!gotLock) {
    await waitForPeerLock(env, cacheKey, startSec);
    const afterPeer = await getRecord(env, cacheKey);
    if (afterPeer && isRecordCurrent(afterPeer, env.TRANSCRIPT_MODEL_VERSION) && coversTime(afterPeer, startSec)) {
      return { hit: true, segments: segmentsAt(afterPeer, startSec), source: "whisper" };
    }
    return { hit: false, segments: [] };
  }

  try {
    const cap = Number(env.CAP_MINUTES);
    const minutes = pcmDurationMinutes(pcm.length);
    const usedBefore = await getUsage(env, licenseId);
    if (usedBefore + minutes > cap) {
      throw new Error("monthly listening hours used up");
    }
    await addMinutes(env, licenseId, minutes);

    // Count the miss attempt before the provider call so empty responses and
    // provider failures still increment missCount (same meaning as before).
    await bumpTranscribeMiss(env, cacheKey);

    const language = cacheKey.split(":").pop() || "ja";
    let tx;
    try {
      tx = await transcribeWithFallback(env, pcm, { language, startSec });
    } catch (err) {
      // No provider produced a transcript — refund the minutes we reserved.
      await addMinutes(env, licenseId, -minutes);
      throw err;
    }
    await recordProviderSuccess(env, tx.provider, tx.durationMinutes, tx.estimatedCostUsd);

    if (tx.segments.length) {
      await storeSegments(env, cacheKey, tx.segments, "whisper", env.TRANSCRIPT_MODEL_VERSION);
    }
    return {
      hit: false,
      segments: tx.segments,
      source: "whisper"
    };
  } finally {
    await releaseTranscribeLock(env, cacheKey, startSec, lockOwner);
  }
}
