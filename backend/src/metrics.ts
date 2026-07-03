import type { Env } from "./index";

/** Count only server-side transcribe outcomes (not client lookup polls). */
export async function recordTranscribeHit(env: Env): Promise<void> {
  await increment(env, "txmetrics:transcribe_hits");
}

export async function recordTranscribeMiss(env: Env): Promise<void> {
  await increment(env, "txmetrics:transcribe_misses");
}

export async function recordLookupHit(env: Env): Promise<void> {
  await increment(env, "txmetrics:lookup_hits");
}

async function increment(env: Env, key: string): Promise<void> {
  try {
    const v = await env.AVC_KV.get(key);
    await env.AVC_KV.put(key, String((Number(v) || 0) + 1));
  } catch {
    /* metrics must not break the request path */
  }
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
