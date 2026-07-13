import type { Env } from "./index";
import type { TranscriptMeta, TranscriptRecord, TranscriptSegment, TranscriptSource } from "./transcript-types";
import { validateSegments } from "./validate";

const META_PREFIX = "txmeta:";
const BODY_PREFIX = "txbody:";
const MAX_STORED_SEGMENTS = 8000;

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

export function isRecordCurrent(record: TranscriptRecord, modelVersion: string): boolean {
  return record.modelVersion === modelVersion;
}

export function mergeSegments(existing: TranscriptSegment[], incoming: TranscriptSegment[]): TranscriptSegment[] {
  const err = validateSegments(incoming);
  if (err) throw new Error(err);
  const map = new Map<number, TranscriptSegment>();
  for (const seg of [...existing, ...incoming]) {
    const key = Math.round(seg.start * 100);
    const prev = map.get(key);
    if (!prev || seg.text.length >= prev.text.length) map.set(key, seg);
  }
  const merged = [...map.values()].sort((a, b) => a.start - b.start);
  if (merged.length > MAX_STORED_SEGMENTS) {
    return merged.slice(merged.length - MAX_STORED_SEGMENTS);
  }
  return merged;
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
    source,
    createdAt: existing?.createdAt || new Date().toISOString(),
    segments: merged
  };

  await env.AVC_KV.put(bodyKey(cacheKey), JSON.stringify(record));

  const prevMeta = await getMeta(env, cacheKey);
  const meta: TranscriptMeta = {
    cacheKey,
    modelVersion: record.modelVersion,
    source: record.source,
    createdAt: record.createdAt,
    hitCount: prevMeta?.hitCount || 0,
    // missCount is owned by bumpTranscribeMiss (covers empty/failed attempts too).
    missCount: prevMeta?.missCount || 0,
    segmentCount: merged.length
  };
  await env.AVC_KV.put(metaKey(cacheKey), JSON.stringify(meta));
  return record;
}

/** @deprecated Per-hit meta bumps burned KV put quota; hitCount is no longer updated live. */
export async function bumpTranscribeHit(_env: Env, _cacheKey: string): Promise<void> {
  /* no-op — warm hits must stay KV-write-free */
}

/** Count a cache-miss attempt (including empty transcripts and provider failures). */
export async function bumpTranscribeMiss(env: Env, cacheKey: string): Promise<void> {
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

/** Segments overlapping [t, t+windowSec). */
export function segmentsAt(record: TranscriptRecord, t: number, windowSec = 8): TranscriptSegment[] {
  const end = t + windowSec;
  return record.segments.filter((s) => s.end > t && s.start < end);
}

/** True when a segment actually covers playback time t (not merely nearby in the window). */
export function coversTime(record: TranscriptRecord, t: number): boolean {
  return record.segments.some(
    (s) => s.start <= t && s.end > t && s.text.trim().length > 0 && /[぀-ヿ一-鿿]/.test(s.text)
  );
}

/** True when the window [t, t+windowSec) has a segment spanning most of it. */
export function hasCoverage(record: TranscriptRecord, t: number, windowSec = 8): boolean {
  if (coversTime(record, t)) return true;
  const windowEnd = t + windowSec;
  return record.segments.some((s) => {
    if (!s.text.trim() || !/[぀-ヿ一-鿿]/.test(s.text)) return false;
    const overlapStart = Math.max(s.start, t);
    const overlapEnd = Math.min(s.end, windowEnd);
    const overlap = overlapEnd - overlapStart;
    return overlap >= Math.min(windowSec * 0.5, 2);
  });
}
