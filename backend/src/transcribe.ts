import type { Env } from "./index";
import type { TranscriptSegment } from "./transcript-types";

/** Transcribe a PCM audio buffer (16-bit LE, 24 kHz mono) via OpenAI batch API. */
export async function transcribePcm(
  env: Env,
  pcmBase64: string,
  startSec: number
): Promise<TranscriptSegment[]> {
  const pcmBytes = Uint8Array.from(atob(pcmBase64), (c) => c.charCodeAt(0));
  const wav = pcmToWav(pcmBytes, 24000);

  const form = new FormData();
  form.append("file", new Blob([wav], { type: "audio/wav" }), "chunk.wav");
  form.append("model", env.TRANSCRIBE_MODEL);
  form.append("language", "ja");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form
  });

  interface WhisperSegment { start: number; end: number; text: string }
  interface WhisperResponse {
    text?: string;
    segments?: WhisperSegment[];
    error?: { message?: string };
  }
  const data = (await res.json().catch(() => ({}))) as WhisperResponse;
  if (!res.ok) {
    throw new Error("Whisper failed: " + (data.error?.message || res.status));
  }

  if (data.segments?.length) {
    return data.segments
      .map((s) => ({
        start: startSec + s.start,
        end: startSec + s.end,
        text: s.text.trim()
      }))
      .filter((s) => s.text.length > 0);
  }

  const text = (data.text || "").trim();
  if (!text) return [];
  const duration = pcmBytes.length / (24000 * 2);
  return [{ start: startSec, end: startSec + duration, text }];
}

function pcmToWav(pcm: Uint8Array, sampleRate: number): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out.buffer;
}
