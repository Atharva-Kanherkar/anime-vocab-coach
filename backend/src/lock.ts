import { atomicFor } from "./atomic";
import type { Env } from "./index";
import { chunkBucket } from "./validate";

// A single chunk transcription takes a few seconds; the TTL only needs to
// outlast that. Keep it short so a killed request that never reaches the
// finally-release strands the lock for at most this long (was 120s).
const LOCK_TTL_SEC = 60;

function lockKey(cacheKey: string, startSec: number): string {
  return `txlock:${cacheKey}:${chunkBucket(startSec)}`;
}

const lockFor = (env: Env, cacheKey: string, startSec: number) =>
  atomicFor(env.ATOMIC, lockKey(cacheKey, startSec));

/**
 * Try to acquire an in-flight transcription lock. Returns true if acquired.
 *
 * Backed by a Durable Object, so of N simultaneous callers exactly one wins;
 * the KV get-then-put this replaced let several "win" at once and each paid a
 * provider for the same chunk.
 */
export async function acquireTranscribeLock(
  env: Env,
  cacheKey: string,
  startSec: number,
  owner: string
): Promise<boolean> {
  try {
    return await lockFor(env, cacheKey, startSec).claim(owner, LOCK_TTL_SEC * 1000);
  } catch (err) {
    // Duplicate provider spend is better than taking Listening Mode offline,
    // but it must be visible, not silent.
    console.error("[lock] claim failed; proceeding unlocked", err);
    return true;
  }
}

export async function releaseTranscribeLock(
  env: Env,
  cacheKey: string,
  startSec: number,
  owner: string
): Promise<void> {
  try {
    await lockFor(env, cacheKey, startSec).release(owner);
  } catch (err) {
    // The lock expires on its own after LOCK_TTL_SEC.
    console.warn("[lock] release failed", err);
  }
}

export async function waitForPeerLock(
  env: Env,
  cacheKey: string,
  startSec: number,
  maxWaitMs = 3000
): Promise<boolean> {
  const lock = lockFor(env, cacheKey, startSec);
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (!(await lock.held().catch(() => false))) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
