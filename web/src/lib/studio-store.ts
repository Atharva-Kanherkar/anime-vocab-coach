// Storage + env for Manga Studio. Reuses the AVC_SYNC_KV binding:
//   - studio:item:<id>    — creation meta JSON (script, words, flags)
//   - studio:img:<id>     — the generated page as base64 PNG
//   - studio:index:<user> — light per-user index (newest first)
//   - studio:usage:<user>:<YYYY-MM> — monthly creation counter
// Local Next dev with no Cloudflare binding falls back to an in-process Map so
// the routes are exercisable before deploy (same pattern as ai-store.ts).

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  DEFAULT_STUDIO_ANON_ART_PER_DAY,
  DEFAULT_STUDIO_ANON_DRAFTS_PER_DAY,
  DEFAULT_STUDIO_ART_PER_MONTH,
  DEFAULT_STUDIO_IMAGE_MODEL,
  DEFAULT_STUDIO_IMAGE_QUALITY,
  DEFAULT_STUDIO_LIMIT,
  DEFAULT_STUDIO_SCRIPT_MODEL,
  toGalleryEntry,
  toIndexEntry,
  type StudioCreationMeta,
  type StudioGalleryEntry,
  type StudioIndexEntry,
} from "./studio";

interface StudioKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface StudioEnv {
  AVC_SYNC_KV?: StudioKV;
  STUDIO_CREATIONS_PER_MONTH?: string;
  STUDIO_ART_PER_MONTH?: string;
  STUDIO_ANON_ART_PER_DAY?: string;
  STUDIO_ANON_DRAFTS_PER_DAY?: string;
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
  artPerMonth: number;
  anonArtPerDay: number;
  anonDraftsPerDay: number;
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
    artPerMonth: num(process.env.STUDIO_ART_PER_MONTH || env.STUDIO_ART_PER_MONTH, DEFAULT_STUDIO_ART_PER_MONTH),
    anonArtPerDay: num(process.env.STUDIO_ANON_ART_PER_DAY || env.STUDIO_ANON_ART_PER_DAY, DEFAULT_STUDIO_ANON_ART_PER_DAY),
    anonDraftsPerDay: num(
      process.env.STUDIO_ANON_DRAFTS_PER_DAY || env.STUDIO_ANON_DRAFTS_PER_DAY,
      DEFAULT_STUDIO_ANON_DRAFTS_PER_DAY
    ),
    scriptModel: process.env.STUDIO_SCRIPT_MODEL || env.STUDIO_SCRIPT_MODEL || DEFAULT_STUDIO_SCRIPT_MODEL,
    imageModel: process.env.STUDIO_IMAGE_MODEL || env.STUDIO_IMAGE_MODEL || DEFAULT_STUDIO_IMAGE_MODEL,
    imageQuality: process.env.STUDIO_IMAGE_QUALITY || env.STUDIO_IMAGE_QUALITY || DEFAULT_STUDIO_IMAGE_QUALITY,
  };
}

// ── Monthly usage ────────────────────────────────────────────────────────

function usageKey(userId: string, month: string): string {
  return `studio:usage:${userId}:${month}`;
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

// ── Art-call metering (the expensive OpenAI image calls) ──────────────────
// Signed-in users get a monthly art budget; anonymous "taste" callers get a
// small per-IP daily budget so a stranger can try one manga without an account
// but can't run up the owner-funded OpenAI bill in a loop.

const DAY_TTL_SECONDS = 3 * 24 * 3600; // daily anon keys self-clean

export function currentDay(now = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/** Best-effort caller IP for anonymous rate limiting (Cloudflare first). */
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "anon"
  );
}

async function readCounter(key: string): Promise<number> {
  const raw = await kvGet(key);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function bumpCounter(key: string, ttl: number): Promise<number> {
  const next = (await readCounter(key)) + 1;
  await kvPut(key, String(next), { expirationTtl: ttl });
  return next;
}

const artKey = (userId: string, month: string) => `studio:art:${userId}:${month}`;
const anonArtKey = (ip: string, day: string) => `studio:anonart:${ip}:${day}`;
const anonDraftKey = (ip: string, day: string) => `studio:anondraft:${ip}:${day}`;

export const getArtUsage = (userId: string, month: string) => readCounter(artKey(userId, month));
export const incrementArtUsage = (userId: string, month: string) =>
  bumpCounter(artKey(userId, month), USAGE_TTL_SECONDS);

export const getAnonArtUsage = (ip: string, day: string) => readCounter(anonArtKey(ip, day));
export const incrementAnonArtUsage = (ip: string, day: string) =>
  bumpCounter(anonArtKey(ip, day), DAY_TTL_SECONDS);

export const getAnonDraftUsage = (ip: string, day: string) => readCounter(anonDraftKey(ip, day));
export const incrementAnonDraftUsage = (ip: string, day: string) =>
  bumpCounter(anonDraftKey(ip, day), DAY_TTL_SECONDS);

// ── Creations ────────────────────────────────────────────────────────────

const itemKey = (id: string) => `studio:item:${id}`;
const imageKey = (id: string) => `studio:img:${id}`; // legacy single grid page
const panelKey = (id: string, i: number) => `studio:panel:${id}:${i}`;
const indexKey = (userId: string) => `studio:index:${userId}`;
const GALLERY_KEY = "studio:gallery";
const MAX_GALLERY_ENTRIES = 240;

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

/** Legacy single-shot path: meta + one baked grid image in one write. */
export async function putCreation(meta: StudioCreationMeta, imageB64: string): Promise<void> {
  await kvPut(itemKey(meta.id), JSON.stringify(meta));
  await kvPut(imageKey(meta.id), imageB64);
  const index = await listCreations(meta.ownerId);
  await writeIndex(meta.ownerId, [toIndexEntry(meta), ...index.filter((e) => e.id !== meta.id)]);
}

/** Editor path: save the assembled meta (per-panel images uploaded separately). */
export async function saveCreationMeta(meta: StudioCreationMeta): Promise<void> {
  await kvPut(itemKey(meta.id), JSON.stringify(meta));
  const index = await listCreations(meta.ownerId);
  await writeIndex(meta.ownerId, [toIndexEntry(meta), ...index.filter((e) => e.id !== meta.id)]);
}

export async function putPanelImage(id: string, i: number, imageB64: string): Promise<void> {
  await kvPut(panelKey(id, i), imageB64);
}

export async function getPanelImage(id: string, i: number): Promise<string | null> {
  return kvGet(panelKey(id, i));
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

// ── Global public gallery index ───────────────────────────────────────────

export async function listGallery(): Promise<StudioGalleryEntry[]> {
  const raw = await kvGet(GALLERY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StudioGalleryEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeGallery(entries: StudioGalleryEntry[]): Promise<void> {
  await kvPut(GALLERY_KEY, JSON.stringify(entries.slice(0, MAX_GALLERY_ENTRIES)));
}

async function addToGallery(meta: StudioCreationMeta): Promise<void> {
  const gallery = await listGallery();
  await writeGallery([toGalleryEntry(meta), ...gallery.filter((e) => e.id !== meta.id)]);
}

async function removeFromGallery(id: string): Promise<void> {
  const gallery = await listGallery();
  const next = gallery.filter((e) => e.id !== id);
  if (next.length !== gallery.length) await writeGallery(next);
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
  if (isPublic) await addToGallery(updated);
  else await removeFromGallery(meta.id);
  return updated;
}

export async function deleteCreation(meta: StudioCreationMeta): Promise<void> {
  await kvDelete(itemKey(meta.id));
  await kvDelete(imageKey(meta.id));
  await Promise.all(meta.panels.map((_, i) => kvDelete(panelKey(meta.id, i))));
  await removeFromGallery(meta.id);
  const index = await listCreations(meta.ownerId);
  await writeIndex(
    meta.ownerId,
    index.filter((e) => e.id !== meta.id)
  );
}
