// Storage + env for Manga Studio. Reuses the AVC_SYNC_KV binding:
//   - wordmanga:item:<id>    — creation meta JSON (script, words, flags)
//   - wordmanga:img:<id>     — the generated page as base64 PNG
//   - wordmanga:index:<user> — light per-user index (newest first)
//   - wordmanga:usage:<user>:<YYYY-MM> — monthly creation counter
// Local Next dev with no Cloudflare binding falls back to an in-process Map so
// the routes are exercisable before deploy (same pattern as ai-store.ts).

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  DEFAULT_STUDIO_IMAGE_MODEL,
  DEFAULT_STUDIO_IMAGE_QUALITY,
  DEFAULT_STUDIO_LIMIT,
  DEFAULT_STUDIO_SCRIPT_MODEL,
  toIndexEntry,
  type StudioCreationMeta,
  type StudioIndexEntry,
} from "./word-manga";

interface StudioKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface StudioEnv {
  AVC_SYNC_KV?: StudioKV;
  STUDIO_CREATIONS_PER_MONTH?: string;
  STUDIO_SCRIPT_MODEL?: string;
  STUDIO_IMAGE_MODEL?: string;
  STUDIO_IMAGE_QUALITY?: string;
}

const localStore = new Map<string, string>();

const USAGE_TTL_SECONDS = 60 * 24 * 3600; // monthly keys self-clean

/** Keep the newest N creations per user; older ones age out of the index. */
const MAX_INDEX_ENTRIES = 60;

async function cfEnv(): Promise<StudioEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as StudioEnv;
  } catch {
    return {};
  }
}

async function getKV(): Promise<StudioKV | null> {
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

async function kvDelete(key: string): Promise<void> {
  const kv = await getKV();
  if (kv) await kv.delete(key);
  else localStore.delete(key);
}

// ── Config ───────────────────────────────────────────────────────────────

export async function getStudioConfig(): Promise<{
  limit: number;
  scriptModel: string;
  imageModel: string;
  imageQuality: string;
}> {
  const env = await cfEnv();
  const num = (v: string | undefined, fallback: number) => {
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    limit: num(process.env.STUDIO_CREATIONS_PER_MONTH || env.STUDIO_CREATIONS_PER_MONTH, DEFAULT_STUDIO_LIMIT),
    scriptModel: process.env.STUDIO_SCRIPT_MODEL || env.STUDIO_SCRIPT_MODEL || DEFAULT_STUDIO_SCRIPT_MODEL,
    imageModel: process.env.STUDIO_IMAGE_MODEL || env.STUDIO_IMAGE_MODEL || DEFAULT_STUDIO_IMAGE_MODEL,
    imageQuality: process.env.STUDIO_IMAGE_QUALITY || env.STUDIO_IMAGE_QUALITY || DEFAULT_STUDIO_IMAGE_QUALITY,
  };
}

// ── Monthly usage ────────────────────────────────────────────────────────

function usageKey(userId: string, month: string): string {
  return `wordmanga:usage:${userId}:${month}`;
}

export async function getStudioUsage(userId: string, month: string): Promise<number> {
  const raw = await kvGet(usageKey(userId, month));
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function incrementStudioUsage(userId: string, month: string): Promise<number> {
  const next = (await getStudioUsage(userId, month)) + 1;
  await kvPut(usageKey(userId, month), String(next), { expirationTtl: USAGE_TTL_SECONDS });
  return next;
}

// ── Creations ────────────────────────────────────────────────────────────

const itemKey = (id: string) => `wordmanga:item:${id}`;
const imageKey = (id: string) => `wordmanga:img:${id}`;
const indexKey = (userId: string) => `wordmanga:index:${userId}`;

export async function listCreations(userId: string): Promise<StudioIndexEntry[]> {
  const raw = await kvGet(indexKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StudioIndexEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(userId: string, entries: StudioIndexEntry[]): Promise<void> {
  await kvPut(indexKey(userId), JSON.stringify(entries.slice(0, MAX_INDEX_ENTRIES)));
}

export async function putCreation(meta: StudioCreationMeta, imageB64: string): Promise<void> {
  await kvPut(itemKey(meta.id), JSON.stringify(meta));
  await kvPut(imageKey(meta.id), imageB64);
  const index = await listCreations(meta.ownerId);
  await writeIndex(meta.ownerId, [toIndexEntry(meta), ...index.filter((e) => e.id !== meta.id)]);
}

export async function getCreation(id: string): Promise<StudioCreationMeta | null> {
  const raw = await kvGet(itemKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudioCreationMeta;
  } catch {
    return null;
  }
}

export async function getCreationImage(id: string): Promise<string | null> {
  return kvGet(imageKey(id));
}

export async function setCreationPublic(
  meta: StudioCreationMeta,
  isPublic: boolean
): Promise<StudioCreationMeta> {
  const updated = { ...meta, isPublic };
  await kvPut(itemKey(meta.id), JSON.stringify(updated));
  const index = await listCreations(meta.ownerId);
  await writeIndex(
    meta.ownerId,
    index.map((e) => (e.id === meta.id ? { ...e, isPublic } : e))
  );
  return updated;
}

export async function deleteCreation(meta: StudioCreationMeta): Promise<void> {
  await kvDelete(itemKey(meta.id));
  await kvDelete(imageKey(meta.id));
  const index = await listCreations(meta.ownerId);
  await writeIndex(
    meta.ownerId,
    index.filter((e) => e.id !== meta.id)
  );
}
