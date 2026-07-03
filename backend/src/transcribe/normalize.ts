import type { TranscriptSegment } from "../transcript-types";
import type { WhisperRawResponse } from "./types";

const JA_RE = /[぀-ヿ一-鿿]/;

/** Normalize provider-specific Whisper output to internal timestamped segments. */
export function normalizeWhisperResponse(
  data: WhisperRawResponse,
  startSec: number,
  pcmBytes: number,
  sampleRate = 24000
): TranscriptSegment[] {
  if (data.segments?.length) {
    return data.segments
      .map((s) => ({
        start: startSec + (s.start ?? 0),
        end: startSec + (s.end ?? s.start ?? 0),
        text: (s.text || "").trim()
      }))
      .filter((s) => s.text.length > 0 && JA_RE.test(s.text));
  }

  const text = (data.text || "").trim();
  if (!text || !JA_RE.test(text)) return [];
  const duration = pcmBytes / (sampleRate * 2);
  return [{ start: startSec, end: startSec + duration, text }];
}

/** Some providers return segments with string timestamps or nested fields. */
export function coerceWhisperJson(raw: unknown): WhisperRawResponse {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;

  if (obj.error && typeof obj.error === "object") {
    const err = obj.error as { message?: string };
    return { error: { message: err.message || "provider error" } };
  }

  const segments = Array.isArray(obj.segments)
    ? obj.segments.map((s) => {
        const seg = s as Record<string, unknown>;
        return {
          start: Number(seg.start ?? seg.start_time ?? 0),
          end: Number(seg.end ?? seg.end_time ?? seg.start ?? 0),
          text: String(seg.text ?? "")
        };
      })
    : undefined;

  return {
    text: typeof obj.text === "string" ? obj.text : undefined,
    segments
  };
}
