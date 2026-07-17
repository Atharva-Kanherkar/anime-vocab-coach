// Extension funnel counters on AVC_SYNC_KV:
//   - extstats:<day>:<event>   — per UTC day (TTL ~120d)
//   - extstats:total:<event>   — all-time (no TTL)
// Local Next dev falls back to an in-process Map.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { EXTENSION_EVENTS, type ExtensionEvent } from "./extension-funnel";

interface ExtKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const localStore = new Map<string, string>();
const STATS_DAY_TTL_SECONDS = 120 * 24 * 3600;

async function getKV(): Promise<ExtKV | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as { AVC_SYNC_KV?: ExtKV }).AVC_SYNC_KV ?? null;
  } catch {
    return null;
  }
}

async function kvGet(key: string): Promise<string | null> {
  const kv = await getKV();
  return kv ? kv.get(key) : localStore.get(key) ?? null;
}

async function kvPut(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
  const kv = await getKV();
  if (kv) await kv.put(key, value, options);
  else localStore.set(key, value);
}

async function bumpCounter(key: string, ttlSeconds: number): Promise<void> {
  const raw = await kvGet(key);
  const next = String((Number(raw) || 0) + 1);
  if (ttlSeconds > 0) await kvPut(key, next, { expirationTtl: ttlSeconds });
  else await kvPut(key, next);
}

export function currentExtStatsDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const dayKey = (day: string, event: ExtensionEvent) => `extstats:${day}:${event}`;
const totalKey = (event: ExtensionEvent) => `extstats:total:${event}`;

/** Fire-and-forget. Never throws. */
export async function trackExtensionEvent(event: ExtensionEvent, day = currentExtStatsDay()): Promise<void> {
  try {
    await Promise.all([
      bumpCounter(dayKey(day, event), STATS_DAY_TTL_SECONDS),
      bumpCounter(totalKey(event), 0),
    ]);
  } catch {
    // swallow
  }
}

export async function getExtensionStatsTotals(): Promise<Record<string, number>> {
  const totals: Record<string, number> = {};
  await Promise.all(
    EXTENSION_EVENTS.map(async (e) => {
      totals[e] = Number(await kvGet(totalKey(e))) || 0;
    })
  );
  return totals;
}
