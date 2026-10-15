// Per-license monthly Listening Mode usage (fractional minutes).
//
// The running total lives in an Atomic Durable Object per user-month, so two
// requests that charge at the same moment both count (in KV, a read-then-write,
// one of them was silently lost). KV still gets a copy of every new total:
// the /owner dashboard lists `use:*` keys to chart listening history.

import { atomicFor } from "./atomic";
import type { Env } from "./index";

const USAGE_TTL_SEC = 40 * 24 * 3600;

function monthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function usageKey(id: string): string {
  return `use:${id}:${monthKey()}`;
}

/** Current month's minutes. Throws if the counter is unreachable: callers use
 * this to enforce the cap, and an unknown total must not read as zero. */
export async function getUsage(env: Env, id: string): Promise<number> {
  const key = usageKey(id);
  return atomicFor(env.ATOMIC, key).get(key, USAGE_TTL_SEC);
}

export async function addMinutes(env: Env, id: string, minutes: number): Promise<number> {
  // Allow refunds (negative) and no-ops.
  if (!Number.isFinite(minutes) || minutes === 0) return getUsage(env, id);
  const key = usageKey(id);
  const next = await atomicFor(env.ATOMIC, key).add(minutes, USAGE_TTL_SEC, key);
  try {
    await env.AVC_KV.put(key, String(next), { expirationTtl: USAGE_TTL_SEC });
  } catch (err) {
    // Only the dashboard copy is lost; the meter itself already counted.
    console.warn("[usage] KV mirror put failed", err);
  }
  return next;
}
