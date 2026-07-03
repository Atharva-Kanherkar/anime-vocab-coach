import {
  bumpTranscribeHit,
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
import { recordLookupHit, recordTranscribeHit, recordTranscribeMiss } from "./metrics";
import type { TranscriptSegment } from "./transcript-types";
import { transcribePcm } from "./transcribe";
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
  await recordLookupHit(env);
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
    await recordTranscribeHit(env);
    await bumpTranscribeHit(env, cacheKey);
    return { hit: true, segments: segmentsAt(existing, startSec), source: "whisper" };
  }

  const lockOwner = `${licenseId}:${chunkBucket(startSec)}`;
  const gotLock = await acquireTranscribeLock(env, cacheKey, startSec, lockOwner);
  if (!gotLock) {
    await waitForPeerLock(env, cacheKey, startSec);
    const afterPeer = await getRecord(env, cacheKey);
    if (afterPeer && isRecordCurrent(afterPeer, env.TRANSCRIPT_MODEL_VERSION) && coversTime(afterPeer, startSec)) {
      await recordTranscribeHit(env);
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

    await recordTranscribeMiss(env);
    await bumpTranscribeMiss(env, cacheKey);

    const segments = await transcribePcm(env, pcm, startSec, cacheKey);
    if (segments.length) {
      await storeSegments(env, cacheKey, segments, "whisper", env.TRANSCRIPT_MODEL_VERSION);
    }
    return { hit: false, segments, source: "whisper" };
  } finally {
    await releaseTranscribeLock(env, cacheKey, startSec, lockOwner);
  }
}
