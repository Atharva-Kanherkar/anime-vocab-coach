// Per-license monthly minute counters in Workers KV.
//
// KV is eventually consistent, so a rare concurrent heartbeat can lose an
// update — acceptable for fair-use metering (it only ever under-counts).
// Counters expire ~40 days after last write, so old months clean themselves up.

import type { Env } from "./index";

function monthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function usageKey(id: string): string {
  return `use:${id}:${monthKey()}`;
}

export async function getUsage(env: Env, id: string): Promise<number> {
  const v = await env.AVC_KV.get(usageKey(id));
  return Number(v) || 0;
}

export async function addMinutes(env: Env, id: string, minutes: number): Promise<number> {
  const key = usageKey(id);
  const current = Number(await env.AVC_KV.get(key)) || 0;
  const next = current + minutes;
  await env.AVC_KV.put(key, String(next), { expirationTtl: 40 * 24 * 3600 });
  return next;
}
