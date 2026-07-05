import { getOpenAiKey, getCachedResult, putCachedResult } from "./ai-store";

export const DEFAULT_TTS_MODEL = "tts-1";
export const DEFAULT_TTS_VOICE = "nova";
export const MAX_TTS_LEN = 120;

const CACHE_TTL_SECONDS = 90 * 24 * 3600; // 90 days — audio for a reading rarely changes

export async function ttsCacheKey(text: string): Promise<string> {
  const basis = text.trim().slice(0, MAX_TTS_LEN);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  return `tts:v1:${hex}`;
}

export async function synthesizeSpeech(apiKey: string, text: string): Promise<ArrayBuffer> {
  const input = text.trim().slice(0, MAX_TTS_LEN);
  if (!input) throw new Error("empty_text");

  const cacheKey = await ttsCacheKey(input);
  const cached = await getCachedResult(cacheKey);
  if (cached && typeof cached === "object" && cached !== null && "b64" in cached) {
    const b64 = (cached as { b64: string }).b64;
    return base64ToArrayBuffer(b64);
  }

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_TTS_MODEL || DEFAULT_TTS_MODEL,
      voice: process.env.AI_TTS_VOICE || DEFAULT_TTS_VOICE,
      input,
      response_format: "mp3",
    }),
  });

  if (!res.ok) throw new Error(`openai_tts_${res.status}`);
  const buf = await res.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);
  await putCachedResult(cacheKey, { b64 }, CACHE_TTL_SECONDS);
  return buf;
}

export async function runTts(text: string): Promise<ArrayBuffer> {
  const apiKey = await getOpenAiKey();
  if (!apiKey) throw new Error("ai_not_configured");
  return synthesizeSpeech(apiKey, text);
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
