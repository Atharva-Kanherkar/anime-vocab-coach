import type { Env } from "./index";

/** Global hit/miss counters for the shared transcript cache. */
export async function recordHit(env: Env): Promise<void> {
  await env.AVC_KV.put("txmetrics:hits", String((await getCounter(env, "txmetrics:hits")) + 1));
}

export async function recordMiss(env: Env): Promise<void> {
  await env.AVC_KV.put("txmetrics:misses", String((await getCounter(env, "txmetrics:misses")) + 1));
}

async function getCounter(env: Env, key: string): Promise<number> {
  const v = await env.AVC_KV.get(key);
  return v ? Number(v) || 0 : 0;
}

export async function getMetrics(env: Env): Promise<{ hits: number; misses: number; hitRate: number }> {
  const hits = await getCounter(env, "txmetrics:hits");
  const misses = await getCounter(env, "txmetrics:misses");
  const total = hits + misses;
  return { hits, misses, hitRate: total ? hits / total : 0 };
}
