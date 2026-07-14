import { getOpenAiKey, getCachedResult, putCachedResult } from "./ai-store";

export const DEFAULT_TTS_MODEL = "tts-1";
export const DEFAULT_TTS_VOICE = "nova";
export const MAX_TTS_LEN = 120;

const CACHE_TTL_SECONDS = 90 * 24 * 3600; // 90 days — audio for a reading rarely changes

function ttsVoice(): string {
  return process.env.AI_TTS_VOICE || DEFAULT_TTS_VOICE;
}

function ttsModel(): string {
  return process.env.AI_TTS_MODEL || DEFAULT_TTS_MODEL;
}

// Cache key includes voice + model: audio for the same text but a different
// voice/model is a different asset, so it must not collide. (v1 keyed on text
// alone, which served stale audio when the voice env changed.)
export async function ttsCacheKey(text: string, voice: string, model: string): Promise<string> {
  const basis = `${voice}${model}${text.trim().slice(0, MAX_TTS_LEN)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  return `tts:v2:${hex}`;
}

export interface TtsResult {
  audio: ArrayBuffer;
  /** True when served from cache (no OpenAI call, must not consume quota). */
  cached: boolean;
}

/** Synthesize speech, caching by text+voice+model. `onBeforeSpend`, if given, is
 * awaited only on a cache miss right before the paid OpenAI call — throw from it
 * to enforce a quota gate without charging cache hits. */
export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  opts?: { onBeforeSpend?: () => Promise<void> }
): Promise<TtsResult> {
  const input = text.trim().slice(0, MAX_TTS_LEN);
  if (!input) throw new Error("empty_text");

  const voice = ttsVoice();
  const model = ttsModel();
  const cacheKey = await ttsCacheKey(input, voice, model);
  const cached = await getCachedResult(cacheKey);
  if (cached && typeof cached === "object" && cached !== null && "b64" in cached) {
    const b64 = (cached as { b64: string }).b64;
    return { audio: base64ToArrayBuffer(b64), cached: true };
  }

  if (opts?.onBeforeSpend) await opts.onBeforeSpend();

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input,
      response_format: "mp3",
    }),
  });

  if (!res.ok) throw new Error(`openai_tts_${res.status}`);
  const buf = await res.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);
  // Soft-fail the cache write: the paid OpenAI call already succeeded, so a KV
  // put-limit rejection must not turn a delivered audio buffer into an error.
  try {
    await putCachedResult(cacheKey, { b64 }, CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn("[tts] cache write failed", err);
  }
  return { audio: buf, cached: false };
}

export async function runTts(
  text: string,
  opts?: { onBeforeSpend?: () => Promise<void> }
): Promise<TtsResult> {
  const apiKey = await getOpenAiKey();
  if (!apiKey) throw new Error("ai_not_configured");
  return synthesizeSpeech(apiKey, text, opts);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
