/**
 * OpenAI calls for the course: speech, transcription and structured tutor output.
 * The API key never leaves the Worker. Typed answers, transcripts and audio are
 * never logged; failures are reported by status only.
 */
export interface ProviderEnv {
  OPENAI_API_KEY?: string;
  TRANSCRIBE_MODEL?: string;
  N5_AI_ENABLED?: string;
  N5_TUTOR_MODEL?: string;
  N5_TTS_MODEL?: string;
  N5_TTS_VOICE?: string;
}
export class ProviderError extends Error {
  constructor(readonly status: number) { super(`n5_provider_${status}`); }
}
const BASE = "https://api.openai.com/v1";

export function aiEnabled(env: ProviderEnv): boolean { return env.N5_AI_ENABLED === "1" && Boolean(env.OPENAI_API_KEY); }
export const ttsModel = (env: ProviderEnv) => env.N5_TTS_MODEL || "gpt-4o-mini-tts";
export const ttsVoice = (env: ProviderEnv) => env.N5_TTS_VOICE || "coral";
const tutorModel = (env: ProviderEnv) => env.N5_TUTOR_MODEL || "gpt-5.6-luna";

async function call(env: ProviderEnv, path: string, init: RequestInit, timeout: number): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      ...init, headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeout), redirect: "manual",
    });
  } catch { throw new ProviderError(0); }
  // Workers reject redirect: "error"; a manual 3xx is not ok and fails below.
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    console.warn("[n5] provider request failed", { path, status: response.status });
    throw new ProviderError(response.status);
  }
  return response;
}

/** MP3 speech for kana text. */
export async function speech(env: ProviderEnv, text: string): Promise<ArrayBuffer> {
  const response = await call(env, "/audio/speech", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: ttsModel(env), voice: ttsVoice(env), input: text, response_format: "mp3",
      instructions: "Speak natural, standard Tokyo Japanese at a calm, clear pace for a beginner. Read kana exactly as written." }),
  }, 20_000);
  const audio = await response.arrayBuffer();
  if (audio.byteLength < 100 || audio.byteLength > 2_000_000) throw new ProviderError(502);
  return audio;
}

/** Japanese transcription of a short learner recording. */
export async function transcribe(env: ProviderEnv, audio: Uint8Array, mime: string, hint: string): Promise<string> {
  const form = new FormData();
  const extension = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : mime.includes("wav") ? "wav" : "webm";
  form.append("file", new Blob([audio], { type: mime }), `turn.${extension}`);
  form.append("model", env.TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  form.append("language", "ja");
  form.append("response_format", "json");
  form.append("prompt", hint.slice(0, 600));
  const response = await call(env, "/audio/transcriptions", { method: "POST", body: form }, 20_000);
  const data = await response.json().catch(() => null) as { text?: unknown } | null;
  if (!data || typeof data.text !== "string") throw new ProviderError(502);
  return data.text.trim().slice(0, 500);
}

/** One structured JSON reply from the tutor model; the caller validates every field. */
export async function structured(env: ProviderEnv, name: string, schema: Record<string, unknown>, system: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<unknown> {
  const model = tutorModel(env);
  const reasoning = /^(gpt-5|o\d)/.test(model);
  const response = await call(env, "/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, messages: [{ role: "system", content: system }, ...messages],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
      ...(reasoning ? { reasoning_effort: "low", max_completion_tokens: 4_000 } : { temperature: 0.4, max_tokens: 900 }),
    }),
  }, 30_000);
  const data = await response.json().catch(() => null) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new ProviderError(502);
  try { return JSON.parse(content); } catch { throw new ProviderError(502); }
}
