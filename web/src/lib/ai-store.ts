// Storage + env for the AI coach (issue #13).
//
// Reuses the AVC_SYNC_KV binding for two things:
//   - per-user monthly usage counters (ai:usage:<userId>:<YYYY-MM>)
//   - a shared response cache keyed by word+line+level (from ai-coach.ts)
// Local Next dev with no Cloudflare binding falls back to an in-process Map so the
// route is exercisable before deploy. Cache hits never consume quota.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  DEFAULT_COACH_MODEL,
  DEFAULT_FREE_LIMIT,
  DEFAULT_MAX_LIMIT,
  DEFAULT_PRO_LIMIT,
} from "./ai-coach";

interface CoachKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface CoachEnv {
  AVC_SYNC_KV?: CoachKV;
  OPENAI_API_KEY?: string;
  AI_COACH_MODEL?: string;
  FREE_AI_CALLS_PER_MONTH?: string;
  PRO_AI_CALLS_PER_MONTH?: string;
  MAX_AI_CALLS_PER_MONTH?: string;
}

const localStore = new Map<string, string>();

const USAGE_TTL_SECONDS = 60 * 24 * 3600; // ~60 days: monthly keys self-clean
const CACHE_TTL_SECONDS = 30 * 24 * 3600; // 30 days

async function cfEnv(): Promise<CoachEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as CoachEnv;
  } catch {
    return {};
  }
}

async function getKV(): Promise<CoachKV | null> {
  const env = await cfEnv();
  return env.AVC_SYNC_KV ?? null;
}

/** OpenAI key: process.env for local dev, Cloudflare secret in production. */
export async function getOpenAiKey(): Promise<string | null> {
  const fromProcess = process.env.OPENAI_API_KEY;
  if (fromProcess) return fromProcess;
  const env = await cfEnv();
  return env.OPENAI_API_KEY ?? null;
}

export async function getCoachConfig(): Promise<{
  model: string;
  freeLimit: number;
  proLimit: number;
  maxLimit: number;
}> {
  const env = await cfEnv();
  const num = (v: string | undefined, fallback: number) => {
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    model: process.env.AI_COACH_MODEL || env.AI_COACH_MODEL || DEFAULT_COACH_MODEL,
    freeLimit: num(process.env.FREE_AI_CALLS_PER_MONTH || env.FREE_AI_CALLS_PER_MONTH, DEFAULT_FREE_LIMIT),
    proLimit: num(process.env.PRO_AI_CALLS_PER_MONTH || env.PRO_AI_CALLS_PER_MONTH, DEFAULT_PRO_LIMIT),
    maxLimit: num(process.env.MAX_AI_CALLS_PER_MONTH || env.MAX_AI_CALLS_PER_MONTH, DEFAULT_MAX_LIMIT),
  };
}

export function currentMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function usageKey(userId: string, month: string): string {
  return `ai:usage:${userId}:${month}`;
}

export async function getUsage(userId: string, month: string): Promise<number> {
  const key = usageKey(userId, month);
  const kv = await getKV();
  const raw = kv ? await kv.get(key) : localStore.get(key) ?? null;
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function incrementUsage(userId: string, month: string): Promise<number> {
  const key = usageKey(userId, month);
  const next = (await getUsage(userId, month)) + 1;
  const kv = await getKV();
  if (kv) {
    await kv.put(key, String(next), { expirationTtl: USAGE_TTL_SECONDS });
  } else {
    localStore.set(key, String(next));
  }
  return next;
}

export async function getCachedResult(cacheKey: string): Promise<unknown | null> {
  const kv = await getKV();
  const raw = kv ? await kv.get(cacheKey) : localStore.get(cacheKey) ?? null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function putCachedResult(
  cacheKey: string,
  value: unknown,
  expirationTtl = CACHE_TTL_SECONDS
): Promise<void> {
  const raw = JSON.stringify(value);
  const kv = await getKV();
  if (kv) {
    await kv.put(cacheKey, raw, { expirationTtl });
  } else {
    localStore.set(cacheKey, raw);
  }
}
