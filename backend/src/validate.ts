import type { TranscriptSegment } from "./transcript-types";

/** Shared-cache key shapes: platform:id:ja or fp:hash:ja. The shared cache is
 *  Japanese-only: it exists to teach Japanese vocab, and every learner of an
 *  episode reads the same lines. */
const SHARED_KEY_RE = /^(youtube|netflix|crunchyroll|fp):[A-Za-z0-9._-]{1,128}:ja$/;
/** Transcribe-only keys: billed and returned to the caller, never cached or
 *  shared. English-audio episodes (the ja-en direction), and `sess:` keys the
 *  extension makes up for a session with no episode identity yet. These used
 *  to go over the realtime WebSocket instead, which the server cannot meter
 *  (ISO 25010 security audit): this endpoint bills the actual audio length. */
const TRANSCRIBE_ONLY_KEY_RE =
  /^(?:(?:youtube|netflix|crunchyroll|fp):[A-Za-z0-9._-]{1,128}:en|sess:[A-Za-z0-9_-]{8,64}:(?:ja|en))$/;

export const MAX_SEGMENTS_PER_STORE = 500;
export const MAX_SEGMENT_TEXT = 500;
export const MAX_EPISODE_SEC = 86400;
export const MAX_PCM_BYTES = 400_000; // ~8.3s at 24 kHz mono 16-bit

export function validateCacheKey(key: string): string | null {
  const k = key.trim();
  if (!SHARED_KEY_RE.test(k) && !TRANSCRIBE_ONLY_KEY_RE.test(k)) return "invalid cache key format";
  return null;
}

/** Whether transcripts for this key go in (and come from) the shared cache. */
export function isSharedCacheKey(key: string): boolean {
  return SHARED_KEY_RE.test(key.trim());
}

export function parseAudioLang(cacheKey: string): string {
  return cacheKey.split(":").pop() || "ja";
}

export function validateStartSec(t: number): string | null {
  if (!Number.isFinite(t) || t < 0 || t > MAX_EPISODE_SEC) return "invalid startSec";
  return null;
}

export function validateWindowSec(w: number): number {
  if (!Number.isFinite(w) || w <= 0 || w > 60) return 8;
  return w;
}

export function validateSegments(segments: TranscriptSegment[]): string | null {
  if (!Array.isArray(segments) || segments.length === 0) return "missing segments";
  if (segments.length > MAX_SEGMENTS_PER_STORE) return `max ${MAX_SEGMENTS_PER_STORE} segments per request`;
  for (const seg of segments) {
    if (!Number.isFinite(seg.start) || !Number.isFinite(seg.end)) return "segment timestamps must be finite";
    if (seg.start < 0 || seg.end <= seg.start || seg.end > MAX_EPISODE_SEC) return "invalid segment time range";
    const text = (seg.text || "").trim();
    if (!text || text.length > MAX_SEGMENT_TEXT) return `segment text length 1–${MAX_SEGMENT_TEXT}`;
    if (!/[぀-ヿ一-鿿]/.test(text)) return "segment text must contain Japanese";
  }
  return null;
}

export function decodePcmBase64(audio: string): { pcm: Uint8Array; error?: string } {
  if (!audio || audio.length > 600_000) return { pcm: new Uint8Array(0), error: "audio payload too large" };
  try {
    const pcm = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
    if (pcm.length === 0 || pcm.length > MAX_PCM_BYTES) {
      return { pcm: new Uint8Array(0), error: "audio chunk out of allowed size" };
    }
    if (pcm.length % 2 !== 0) return { pcm: new Uint8Array(0), error: "invalid PCM length" };
    return { pcm };
  } catch {
    return { pcm: new Uint8Array(0), error: "invalid base64 audio" };
  }
}

export function pcmDurationMinutes(pcmBytes: number, sampleRate = 24000): number {
  const seconds = pcmBytes / (sampleRate * 2);
  return seconds / 60;
}

/** Bucket start time for in-flight transcription locks (6s windows). */
export function chunkBucket(startSec: number): number {
  return Math.floor(startSec / 6) * 6;
}
