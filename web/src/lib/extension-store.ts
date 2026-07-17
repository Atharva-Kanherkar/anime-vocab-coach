// Extension funnel events → Cloudflare Analytics Engine (append-only writes).
// Dataset binding: EXTENSION_AE → "extension_funnel" (see wrangler.jsonc).
// Local/unit tests use an injectable sink; production never uses KV RMW counters.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ExtensionEvent } from "./extension-funnel";

export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

interface ExtKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** Published Chrome Web Store id — only this (plus EXTRA_IDS) may write events. */
export const CWS_EXTENSION_ID = "lkjbomofgfonjjbemobacegffepbdnel";

/** Soft cap per client IP per UTC hour — bounds poisoning even if origin is spoofed. */
export const EXTENSION_TRACK_IP_HOURLY_LIMIT = 40;

const RATE_TTL_SECONDS = 2 * 3600;
const localRate = new Map<string, number>();

let testAe: AnalyticsEngineDataset | null = null;
let testKv: ExtKV | null = null;

/** Test-only: capture AE writes without Cloudflare. */
export function setExtensionAnalyticsForTests(ae: AnalyticsEngineDataset | null): void {
  testAe = ae;
}

/** Test-only: KV stand-in for rate-limit checks. */
export function setExtensionRateKvForTests(kv: ExtKV | null): void {
  testKv = kv;
  localRate.clear();
}

async function cfEnv(): Promise<{ EXTENSION_AE?: AnalyticsEngineDataset; AVC_SYNC_KV?: ExtKV }> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as { EXTENSION_AE?: AnalyticsEngineDataset; AVC_SYNC_KV?: ExtKV };
  } catch {
    return {};
  }
}

async function getAE(): Promise<AnalyticsEngineDataset | null> {
  if (testAe) return testAe;
  const env = await cfEnv();
  return env.EXTENSION_AE ?? null;
}

async function getRateKv(): Promise<ExtKV | null> {
  if (testKv) return testKv;
  const env = await cfEnv();
  return env.AVC_SYNC_KV ?? null;
}

export function currentExtStatsHour(now = new Date()): string {
  return now.toISOString().slice(0, 13); // YYYY-MM-DDTHH (UTC)
}

/**
 * Approximate per-IP hourly gate. Races may admit a few extras under load —
 * acceptable for abuse bounds, not used for the product counters themselves.
 */
export async function allowExtensionTrack(ipHash: string, hour = currentExtStatsHour()): Promise<boolean> {
  const key = `extrate:${ipHash}:${hour}`;
  const kv = await getRateKv();
  try {
    if (kv) {
      const n = Number((await kv.get(key)) || 0) || 0;
      if (n >= EXTENSION_TRACK_IP_HOURLY_LIMIT) return false;
      await kv.put(key, String(n + 1), { expirationTtl: RATE_TTL_SECONDS });
      return true;
    }
    const n = localRate.get(key) || 0;
    if (n >= EXTENSION_TRACK_IP_HOURLY_LIMIT) return false;
    localRate.set(key, n + 1);
    return true;
  } catch {
    // Fail closed on rate-limit infrastructure errors.
    return false;
  }
}

export async function hashTrackIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`avc-ext-track:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** Append-only Analytics Engine write. No-op if the binding is missing. */
export async function trackExtensionEvent(event: ExtensionEvent): Promise<void> {
  const ae = await getAE();
  if (!ae) return;
  // Fire-and-forget — writeDataPoint is non-blocking by design.
  ae.writeDataPoint({
    blobs: [event],
    doubles: [1],
    indexes: [event],
  });
}

/** chrome-extension:// IDs are 32 chars in a–p. */
export function parseExtensionId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const fromOrigin = s.match(/^chrome-extension:\/\/([a-p]{32})$/i);
  if (fromOrigin) return fromOrigin[1]!.toLowerCase();
  if (/^[a-p]{32}$/i.test(s)) return s.toLowerCase();
  return null;
}

export function allowedExtensionIds(): Set<string> {
  const extra = (process.env.EXTENSION_TRACK_EXTRA_IDS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-p]{32}$/.test(s));
  return new Set([CWS_EXTENSION_ID, ...extra]);
}

/**
 * Accept only requests that identify as our Chrome extension (Origin and/or
 * X-AVC-Extension-Id). Browsers/scripts without that shape are dropped.
 */
export function isAllowedExtensionClient(req: Request): boolean {
  const originId = parseExtensionId(req.headers.get("origin"));
  const headerId = parseExtensionId(req.headers.get("x-avc-extension-id"));
  const allowed = allowedExtensionIds();
  if (originId && headerId && originId !== headerId) return false;
  const id = originId || headerId;
  return !!id && allowed.has(id);
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0]!.trim() ||
    "anon"
  );
}

/** Reject oversized bodies before JSON parse (bytes). */
export const EXTENSION_TRACK_MAX_BODY_BYTES = 256;
