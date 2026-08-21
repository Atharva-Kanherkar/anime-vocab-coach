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
import { recordTranscription } from "./telemetry";

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

/** Observability context for a transcription, from the request that asked. */
export interface TranscribeContext {
  plan?: string;
  country?: string;
}

export async function transcribeAndStore(
  env: Env,
  licenseId: string,
  cacheKey: string,
  pcmBase64: string,
  startSec: number,
  capMinutes: number,
  ctx: TranscribeContext = {}
): Promise<LookupResult> {
  const language = cacheKey.split(":").pop() || "ja";
  // Every recordTranscription call shares this, so a row can always be tied to
  // a person, a plan and a language even when no provider was reached.
  const base = { userId: licenseId, plan: ctx.plan, country: ctx.country, language };
  const startedAt = Date.now();

  const { pcm, error: pcmErr } = decodePcmBase64(pcmBase64);
  if (pcmErr) throw new Error(pcmErr);

  const existing = await getRecord(env, cacheKey);
  if (existing && isRecordCurrent(existing, env.TRANSCRIPT_MODEL_VERSION) && coversTime(existing, startSec)) {
    // Warm transcribe hit: return cached segments with no KV writes.
    const segments = segmentsAt(existing, startSec);
    // A hit used to be completely silent, which made the cache unmeasurable.
    recordTranscription(env, {
      ...base,
      outcome: "cache_hit",
      audioMinutes: pcmDurationMinutes(pcm.length),
      segments: segments.length,
      latencyMs: Date.now() - startedAt,
    });
    return { hit: true, segments, source: "whisper" };
  }

  const lockOwner = `${licenseId}:${chunkBucket(startSec)}`;
  const gotLock = await acquireTranscribeLock(env, cacheKey, startSec, lockOwner);
  if (!gotLock) {
    await waitForPeerLock(env, cacheKey, startSec);
    const afterPeer = await getRecord(env, cacheKey);
    if (afterPeer && isRecordCurrent(afterPeer, env.TRANSCRIPT_MODEL_VERSION) && coversTime(afterPeer, startSec)) {
      const segments = segmentsAt(afterPeer, startSec);
      recordTranscription(env, {
        ...base,
        outcome: "peer_hit",
        audioMinutes: pcmDurationMinutes(pcm.length),
        segments: segments.length,
        latencyMs: Date.now() - startedAt,
      });
      return { hit: true, segments, source: "whisper" };
    }
    // Lost the lock and the peer produced nothing usable: a wasted round trip
    // worth seeing, since it means the client will ask again.
    recordTranscription(env, {
      ...base,
      outcome: "peer_hit",
      errorCode: "peer_empty",
      latencyMs: Date.now() - startedAt,
    });
    return { hit: false, segments: [] };
  }

  try {
    const minutes = pcmDurationMinutes(pcm.length);
    const usedBefore = await getUsage(env, licenseId);
    if (usedBefore + minutes > capMinutes) {
      recordTranscription(env, {
        ...base,
        outcome: "cap_exceeded",
        errorCode: "cap_exceeded",
        audioMinutes: minutes,
        monthMinutesAfter: usedBefore,
        latencyMs: Date.now() - startedAt,
      });
      throw new Error("monthly listening hours used up");
    }

    // Count the miss attempt before the provider call so empty responses and
    // provider failures still increment missCount (same meaning as before).
    await bumpTranscribeMiss(env, cacheKey);

    let tx;
    try {
      tx = await transcribeWithFallback(env, pcm, { language, startSec });
    } catch (err) {
      recordTranscription(env, {
        ...base,
        outcome: "provider_error",
        errorCode: err instanceof Error ? err.message.slice(0, 120) : "provider_failed",
        audioMinutes: minutes,
        latencyMs: Date.now() - startedAt,
      });
      throw err;
    }

    // Charge only AFTER a provider actually returned a transcript. The old path
    // charged upfront then refunded on failure, but the refund hit the same KV
    // key <1s later and was rejected by KV's 1-write/sec/key limit — silently
    // burning the user's monthly minutes on every failed chunk. A thrown
    // TranscriptionError now exits here having charged nothing. (addMinutes
    // itself soft-fails its KV put, so a metering write can't turn a successful
    // transcription into an error.)
    const monthMinutesAfter = await addMinutes(env, licenseId, minutes);
    await recordProviderSuccess(env, tx.provider, tx.durationMinutes, tx.estimatedCostUsd);
    recordTranscription(env, {
      ...base,
      outcome: "provider_call",
      provider: tx.provider,
      model: tx.model,
      fallbackUsed: tx.fallbackUsed,
      audioMinutes: tx.durationMinutes,
      costUsd: tx.estimatedCostUsd,
      segments: tx.segments.length,
      monthMinutesAfter,
      latencyMs: Date.now() - startedAt,
    });

    if (tx.segments.length) {
      try {
        await storeSegments(env, cacheKey, tx.segments, "whisper", env.TRANSCRIPT_MODEL_VERSION);
      } catch (err) {
        // Still return live segments if cache persistence is blocked (KV put limit).
        console.warn("[transcript] storeSegments failed; returning uncached segments", err);
      }
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
