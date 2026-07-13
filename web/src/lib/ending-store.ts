// Storage + env for the Ending Funnel (see ending-funnel.ts). Reuses the
// AVC_SYNC_KV binding with its own key namespace:
//   - ending:item:<id>          — EndingCreation JSON (script + progress)
//   - ending:panel:<id>:<i>     — one generated panel as base64 PNG
//   - ending:ipfree:<ipHash>    — endings created by this IP (the free gate)
//   - ending:signed:<user>:<m>  — signed-in monthly counter (sign-up carrot)
//   - ending:global:<day>       — global daily creations (ad-spike safety)
//   - endstats:<day>:<event>    — funnel analytics, per UTC day
// Local Next dev with no Cloudflare binding falls back to an in-process Map
// (same pattern as studio-store.ts).

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  DEFAULT_ENDING_FREE_PER_IP,
  DEFAULT_ENDING_GLOBAL_PER_DAY,
  DEFAULT_ENDING_SIGNED_PER_MONTH,
  ENDING_EVENTS,
  type EndingCreation,
  type EndingEvent,
} from "./ending-funnel";

interface FunnelKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface FunnelEnv {
  AVC_SYNC_KV?: FunnelKV;
  ENDING_FREE_PER_IP?: string;
  ENDING_SIGNED_PER_MONTH?: string;
  ENDING_GLOBAL_PER_DAY?: string;
}

const localStore = new Map<string, string>();

const ITEM_TTL_SECONDS = 90 * 24 * 3600; // creations + panels live ~90 days
const IP_TTL_SECONDS = 60 * 24 * 3600; // the "per IP" free gate window
const MONTH_TTL_SECONDS = 60 * 24 * 3600;
const DAY_TTL_SECONDS = 3 * 24 * 3600;
const STATS_DAY_TTL_SECONDS = 120 * 24 * 3600;

async function cfEnv(): Promise<FunnelEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as FunnelEnv;
  } catch {
    return {};
  }
}

async function getKV(): Promise<FunnelKV | null> {
  const env = await cfEnv();
  return env.AVC_SYNC_KV ?? null;
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

// ── Config ─────────────────────────────────────────────────────────────────

export async function getEndingConfig(): Promise<{
  freePerIp: number;
  signedPerMonth: number;
  globalPerDay: number;
}> {
  const env = await cfEnv();
  const num = (v: string | undefined, fallback: number) => {
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    freePerIp: num(process.env.ENDING_FREE_PER_IP || env.ENDING_FREE_PER_IP, DEFAULT_ENDING_FREE_PER_IP),
    signedPerMonth: num(
      process.env.ENDING_SIGNED_PER_MONTH || env.ENDING_SIGNED_PER_MONTH,
      DEFAULT_ENDING_SIGNED_PER_MONTH
    ),
    globalPerDay: num(
      process.env.ENDING_GLOBAL_PER_DAY || env.ENDING_GLOBAL_PER_DAY,
      DEFAULT_ENDING_GLOBAL_PER_DAY
    ),
  };
}

// ── Counters ───────────────────────────────────────────────────────────────

/** SHA-256 the caller IP so raw addresses never sit in KV. */
export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`avc-ending:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

async function readCounter(key: string): Promise<number> {
  const raw = await kvGet(key);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** ttl 0 ⇒ no expiration (all-time counters). */
async function bumpCounter(key: string, ttl: number, by = 1): Promise<number> {
  const next = (await readCounter(key)) + by;
  await kvPut(key, String(next), ttl > 0 ? { expirationTtl: ttl } : undefined);
  return next;
}

const ipFreeKey = (ipHash: string) => `ending:ipfree:${ipHash}`;
const signedKey = (userId: string, month: string) => `ending:signed:${userId}:${month}`;
const globalKey = (day: string) => `ending:global:${day}`;

export const getIpEndingCount = (ipHash: string) => readCounter(ipFreeKey(ipHash));
export const incrementIpEndingCount = (ipHash: string) =>
  bumpCounter(ipFreeKey(ipHash), IP_TTL_SECONDS);

export const getSignedEndingCount = (userId: string, month: string) =>
  readCounter(signedKey(userId, month));
export const incrementSignedEndingCount = (userId: string, month: string) =>
  bumpCounter(signedKey(userId, month), MONTH_TTL_SECONDS);

export const getGlobalEndingCount = (day: string) => readCounter(globalKey(day));
export const incrementGlobalEndingCount = (day: string) =>
  bumpCounter(globalKey(day), DAY_TTL_SECONDS);

// ── Creations ──────────────────────────────────────────────────────────────

const itemKey = (id: string) => `ending:item:${id}`;
const panelKey = (id: string, i: number) => `ending:panel:${id}:${i}`;

export async function putEndingCreation(creation: EndingCreation): Promise<void> {
  await kvPut(itemKey(creation.id), JSON.stringify(creation), {
    expirationTtl: ITEM_TTL_SECONDS,
  });
}

export async function getEndingCreation(id: string): Promise<EndingCreation | null> {
  const raw = await kvGet(itemKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EndingCreation;
  } catch {
    return null;
  }
}

export async function putEndingPanel(id: string, i: number, imageB64: string): Promise<void> {
  await kvPut(panelKey(id, i), imageB64, { expirationTtl: ITEM_TTL_SECONDS });
}

export async function getEndingPanel(id: string, i: number): Promise<string | null> {
  return kvGet(panelKey(id, i));
}

// ── Funnel analytics ───────────────────────────────────────────────────────

export function currentStatsDay(now = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

const statsDayKey = (day: string, event: EndingEvent) => `endstats:${day}:${event}`;

/** Fire-and-forget funnel counter. Never throws (analytics must not break UX).
 *  One KV put per event (daily bucket only) — all-time totals are derived from days. */
export async function trackEndingEvent(event: EndingEvent, day = currentStatsDay()): Promise<void> {
  try {
    await bumpCounter(statsDayKey(day, event), STATS_DAY_TTL_SECONDS);
  } catch {
    // swallow — a lost count is better than a broken funnel
  }
}

export interface EndingStats {
  totals: Record<string, number>;
  days: { day: string; events: Record<string, number> }[];
}

export async function getEndingStats(daysBack = 14): Promise<EndingStats> {
  const totals: Record<string, number> = Object.fromEntries(ENDING_EVENTS.map((e) => [e, 0]));
  const days: EndingStats["days"] = [];
  const now = Date.now();
  for (let d = 0; d < daysBack; d++) {
    const day = currentStatsDay(new Date(now - d * 86400000));
    const events: Record<string, number> = {};
    await Promise.all(
      ENDING_EVENTS.map(async (e) => {
        const n = await readCounter(statsDayKey(day, e));
        if (n > 0) {
          events[e] = n;
          totals[e] = (totals[e] || 0) + n;
        }
      })
    );
    days.push({ day, events });
  }
  return { totals, days };
}
