import type { Env } from "./index";
import { chunkBucket } from "./validate";

// A single chunk transcription takes a few seconds; the TTL only needs to
// outlast that. Keep it short so a killed request that never reaches the
// finally-release strands the lock for at most this long (was 120s).
const LOCK_TTL_SEC = 60;

function lockKey(cacheKey: string, startSec: number): string {
  return `txlock:${cacheKey}:${chunkBucket(startSec)}`;
}

/** Try to acquire an in-flight transcription lock. Returns true if acquired. */
export async function acquireTranscribeLock(
  env: Env,
  cacheKey: string,
  startSec: number,
  owner: string
): Promise<boolean> {
  const key = lockKey(cacheKey, startSec);
  const existing = await env.AVC_KV.get(key);
  if (existing && existing !== owner) return false;
  try {
    await env.AVC_KV.put(key, owner, { expirationTtl: LOCK_TTL_SEC });
  } catch (err) {
    // If KV writes are blocked, proceed without a durable lock rather than
    // failing every cache miss (duplicate Whisper spend is better than offline).
    console.warn("[lock] acquire put failed; proceeding unlocked", err);
  }
  return true;
}

export async function releaseTranscribeLock(
  env: Env,
  cacheKey: string,
  startSec: number,
  owner: string
): Promise<void> {
  const key = lockKey(cacheKey, startSec);
  const existing = await env.AVC_KV.get(key);
  if (existing === owner) await env.AVC_KV.delete(key);
}

export async function waitForPeerLock(
  env: Env,
  cacheKey: string,
  startSec: number,
  maxWaitMs = 3000
): Promise<boolean> {
  const key = lockKey(cacheKey, startSec);
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const existing = await env.AVC_KV.get(key);
    if (!existing) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
