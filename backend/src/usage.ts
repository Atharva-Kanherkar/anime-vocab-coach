// Per-license monthly usage in Workers KV (stored as fractional minutes).

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
  return parseFloat(v || "0") || 0;
}

export async function addMinutes(env: Env, id: string, minutes: number): Promise<number> {
  if (!Number.isFinite(minutes) || minutes <= 0) return getUsage(env, id);
  const key = usageKey(id);
  const current = parseFloat((await env.AVC_KV.get(key)) || "0") || 0;
  const next = Math.max(0, current + minutes);
  await env.AVC_KV.put(key, String(next), { expirationTtl: 40 * 24 * 3600 });
  return next;
}
