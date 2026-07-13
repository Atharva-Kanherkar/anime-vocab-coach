import type { Env } from "./index";

/**
 * Cache hit/miss counters used to live in Workers KV via read-modify-write puts.
 * That burned the free-tier 1k writes/day under Listening Mode (lookup polls every
 * ~800ms + per-chunk transcribe hits). Counters are intentionally no-ops now so
 * product paths stay read-only on warm cache. `getMetrics` still reads any legacy
 * keys for the stats endpoint shape.
 */
export async function recordTranscribeHit(_env: Env): Promise<void> {
  /* no-op — see file comment */
}

export async function recordTranscribeMiss(_env: Env): Promise<void> {
  /* no-op — see file comment */
}

export async function recordLookupHit(_env: Env): Promise<void> {
  /* no-op — see file comment */
}

async function getCounter(env: Env, key: string): Promise<number> {
  const v = await env.AVC_KV.get(key);
  return v ? Number(v) || 0 : 0;
}

export async function getMetrics(env: Env): Promise<{
  transcribeHits: number;
  transcribeMisses: number;
  transcribeHitRate: number;
  lookupHits: number;
}> {
  const transcribeHits = await getCounter(env, "txmetrics:transcribe_hits");
  const transcribeMisses = await getCounter(env, "txmetrics:transcribe_misses");
  const lookupHits = await getCounter(env, "txmetrics:lookup_hits");
  const total = transcribeHits + transcribeMisses;
  return {
    transcribeHits,
    transcribeMisses,
    transcribeHitRate: total ? transcribeHits / total : 0,
    lookupHits
  };
}
