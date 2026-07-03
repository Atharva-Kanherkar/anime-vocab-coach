import type { Env } from "./index";
import type { TranscriptMeta, TranscriptRecord, TranscriptSegment, TranscriptSource } from "./transcript-types";

const META_PREFIX = "txmeta:";
const BODY_PREFIX = "txbody:";

function metaKey(cacheKey: string): string {
  return META_PREFIX + cacheKey;
}

function bodyKey(cacheKey: string): string {
  return BODY_PREFIX + cacheKey;
}

export async function getMeta(env: Env, cacheKey: string): Promise<TranscriptMeta | null> {
  const raw = await env.AVC_KV.get(metaKey(cacheKey));
  if (!raw) return null;
  return JSON.parse(raw) as TranscriptMeta;
}

export async function getRecord(env: Env, cacheKey: string): Promise<TranscriptRecord | null> {
  const raw = await env.AVC_KV.get(bodyKey(cacheKey));
  if (!raw) return null;
  return JSON.parse(raw) as TranscriptRecord;
}

/** Merge new segments into an existing record (by start time, dedupe overlapping). */
export function mergeSegments(existing: TranscriptSegment[], incoming: TranscriptSegment[]): TranscriptSegment[] {
  const map = new Map<number, TranscriptSegment>();
  for (const seg of [...existing, ...incoming]) {
    const key = Math.round(seg.start * 100);
    const prev = map.get(key);
    if (!prev || seg.text.length >= prev.text.length) map.set(key, seg);
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

export async function storeSegments(
  env: Env,
  cacheKey: string,
  segments: TranscriptSegment[],
  source: TranscriptSource,
  modelVersion: string
): Promise<TranscriptRecord> {
  const existing = await getRecord(env, cacheKey);
  const merged = mergeSegments(existing?.segments || [], segments);
  const record: TranscriptRecord = {
    modelVersion,
    source: existing?.source === "subtitle_track" ? "subtitle_track" : source,
    createdAt: existing?.createdAt || new Date().toISOString(),
    segments: merged
  };

  await env.AVC_KV.put(bodyKey(cacheKey), JSON.stringify(record));

  const meta: TranscriptMeta = {
    cacheKey,
    modelVersion: record.modelVersion,
    source: record.source,
    createdAt: record.createdAt,
    hitCount: (await getMeta(env, cacheKey))?.hitCount || 0,
    missCount: (await getMeta(env, cacheKey))?.missCount || 0,
    segmentCount: merged.length
  };
  await env.AVC_KV.put(metaKey(cacheKey), JSON.stringify(meta));
  return record;
}

export async function bumpHit(env: Env, cacheKey: string): Promise<void> {
  const meta = await getMeta(env, cacheKey);
  if (!meta) return;
  meta.hitCount += 1;
  await env.AVC_KV.put(metaKey(cacheKey), JSON.stringify(meta));
}

export async function bumpMiss(env: Env, cacheKey: string): Promise<void> {
  const meta = await getMeta(env, cacheKey);
  const next: TranscriptMeta = meta || {
    cacheKey,
    modelVersion: "",
    source: "whisper",
    createdAt: new Date().toISOString(),
    hitCount: 0,
    missCount: 0,
    segmentCount: 0
  };
  next.missCount += 1;
  await env.AVC_KV.put(metaKey(cacheKey), JSON.stringify(next));
}

/** Return segments overlapping [t, t+windowSec). */
export function segmentsAt(record: TranscriptRecord, t: number, windowSec = 8): TranscriptSegment[] {
  const end = t + windowSec;
  return record.segments.filter((s) => s.end > t && s.start < end);
}

export function hasCoverage(record: TranscriptRecord, t: number, windowSec = 8): boolean {
  return segmentsAt(record, t, windowSec).some((s) => s.text.trim().length > 0);
}
