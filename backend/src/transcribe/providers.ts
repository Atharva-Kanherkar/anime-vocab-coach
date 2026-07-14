import type { Env } from "../index";
import { coerceWhisperJson, normalizeWhisperResponse } from "./normalize";
import { pcmDurationMinutes, pcmToWav } from "./pcm";
import type { ProviderConfig, TranscribeOpts, TranscribeResult, WhisperRawResponse } from "./types";
import { PROVIDER_COST_USD_PER_MIN } from "./types";

const SAMPLE_RATE = 24000;
const DEFAULT_TIMEOUT_MS = 20_000;

interface ProviderDef {
  name: string;
  model: string;
  url: string;
  apiKey: (env: Env) => string | undefined;
  costPerMinuteUsd: number;
}

function providerDefs(env: Env): ProviderDef[] {
  return [
    {
      name: "groq",
      model: env.GROQ_WHISPER_MODEL || "whisper-large-v3",
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      apiKey: (e) => e.GROQ_API_KEY,
      costPerMinuteUsd: PROVIDER_COST_USD_PER_MIN.groq
    },
    {
      name: "deepinfra",
      model: env.DEEPINFRA_WHISPER_MODEL || "openai/whisper-large-v3",
      url: "https://api.deepinfra.com/v1/openai/audio/transcriptions",
      apiKey: (e) => e.DEEPINFRA_API_KEY,
      costPerMinuteUsd: PROVIDER_COST_USD_PER_MIN.deepinfra
    },
    {
      name: "openai",
      model: env.OPENAI_WHISPER_MODEL || env.TRANSCRIBE_MODEL || "whisper-1",
      url: "https://api.openai.com/v1/audio/transcriptions",
      apiKey: (e) => e.OPENAI_API_KEY,
      costPerMinuteUsd: PROVIDER_COST_USD_PER_MIN.openai
    }
  ];
}

export function resolveProviderChain(env: Env, override?: string): ProviderDef[] {
  const defs = providerDefs(env);
  const byName = new Map(defs.map((d) => [d.name, d]));
  const chainSpec = (override || env.TRANSCRIBE_PROVIDERS || "openai").trim();
  const names = chainSpec.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const chain: ProviderDef[] = [];
  for (const name of names) {
    const def = byName.get(name);
    if (!def) {
      console.warn(`TRANSCRIBE_PROVIDERS: unknown provider "${name}" ignored`);
      continue;
    }
    if (!def.apiKey(env)) {
      console.warn(`TRANSCRIBE_PROVIDERS: "${name}" skipped — no API key configured`);
      continue;
    }
    chain.push(def);
  }
  if (!chain.length) {
    const openai = byName.get("openai");
    if (openai?.apiKey(env)) chain.push(openai);
  }
  return chain;
}

export function listProviderConfigs(env: Env): ProviderConfig[] {
  return providerDefs(env).map((d) => ({
    name: d.name,
    model: d.model,
    costPerMinuteUsd: d.costPerMinuteUsd,
    apiKey: d.apiKey(env) ? "(set)" : undefined,
    enabled: !!d.apiKey(env)
  }));
}

/**
 * Whisper models (whisper-1, whisper-large-v3) return per-segment timestamps via
 * verbose_json; the gpt-4o transcribe models do NOT and reject those params with
 * a 400. Anything that isn't a gpt-4o model is assumed to be Whisper-compatible.
 */
function supportsSegmentTimestamps(model: string): boolean {
  return !/gpt-4o/i.test(model);
}

async function invokeProvider(
  env: Env,
  def: ProviderDef,
  wav: Blob,
  language: string,
  timeoutMs: number
): Promise<WhisperRawResponse> {
  const key = def.apiKey(env);
  if (!key) throw new Error(`${def.name}: API key not configured`);

  const form = new FormData();
  form.append("file", wav, "chunk.wav");
  form.append("model", def.model);
  form.append("language", language);
  // gpt-4o(-mini)-transcribe accept only response_format=json|text and reject
  // verbose_json + timestamp_granularities with a 400 — the bug that failed
  // every cache-miss chunk in production. Whisper models still return
  // per-segment timestamps; the gpt-4o path falls back to one chunk-spanning
  // segment (normalizeWhisperResponse handles the segment-less shape).
  if (supportsSegmentTimestamps(def.model)) {
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
  } else {
    form.append("response_format", "json");
  }

  const res = await fetch(def.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs)
  });

  const raw = await res.json().catch(() => ({}));
  const data = coerceWhisperJson(raw);
  if (!res.ok) {
    const err = new Error(`${def.name}: ${data.error?.message || res.status}`) as ProviderError;
    err.status = res.status;
    throw err;
  }
  return data;
}

interface ProviderError extends Error {
  status?: number;
}

/**
 * Thrown when every configured provider failed. Carries a suggested HTTP status
 * so the API layer can surface a real 503 + Retry-After (transient/upstream) or
 * 502 (unrecoverable request) instead of collapsing everything to an opaque 500
 * that the extension silently drops.
 */
export class TranscriptionError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(message: string, opts: { status: number; retryable: boolean }) {
    super(message);
    this.name = "TranscriptionError";
    this.status = opts.status;
    this.retryable = opts.retryable;
  }
}

/** 4xx (except 429) is a request-level failure — retrying other providers won't help. */
function isNonRetryable(err: unknown): boolean {
  const status = (err as ProviderError)?.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 429;
}

export async function transcribeWithFallback(
  env: Env,
  pcm: Uint8Array,
  opts: TranscribeOpts
): Promise<TranscribeResult> {
  const language = opts.language || "ja";
  const startSec = opts.startSec;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const wav = pcmToWav(pcm, SAMPLE_RATE);
  const durationMinutes = pcmDurationMinutes(pcm.length, SAMPLE_RATE);
  const chain = resolveProviderChain(env);

  if (!chain.length) {
    throw new Error("no transcription providers configured");
  }

  let lastError = "all providers failed";
  let lastStatus: number | undefined;
  for (let i = 0; i < chain.length; i++) {
    const def = chain[i];
    try {
      const raw = await invokeProvider(env, def, wav, language, timeoutMs);
      const segments = normalizeWhisperResponse(raw, startSec, pcm.length, SAMPLE_RATE);
      return {
        segments,
        provider: def.name,
        model: def.model,
        durationMinutes,
        estimatedCostUsd: durationMinutes * def.costPerMinuteUsd,
        fallbackUsed: i > 0
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      lastStatus = (err as ProviderError)?.status;
      await recordProviderError(env, def.name);
      // A request-level rejection (bad audio, bad key) will fail identically on
      // every provider — stop rather than burn the whole chain's timeout budget.
      if (isNonRetryable(err)) break;
    }
  }

  // A 4xx (bad audio/key) won't fix itself on retry → 502. Anything else
  // (5xx, 429, timeout, network) is transient → 503 + Retry-After upstream.
  const retryable = !(
    typeof lastStatus === "number" && lastStatus >= 400 && lastStatus < 500 && lastStatus !== 429
  );
  throw new TranscriptionError(lastError, { status: retryable ? 503 : 502, retryable });
}

async function recordProviderError(env: Env, provider: string): Promise<void> {
  try {
    const key = `txprovider:${provider}:errors`;
    const v = await env.AVC_KV.get(key);
    await env.AVC_KV.put(key, String((Number(v) || 0) + 1));
  } catch { /* noop */ }
}

/**
 * Per-field counters (not one shared JSON blob) so a concurrent success and
 * failure cannot overwrite each other's fields via read-modify-write races.
 * Miss-path only — warm hits never call this.
 */
export async function recordProviderSuccess(
  env: Env,
  provider: string,
  durationMinutes: number,
  costUsd: number
): Promise<void> {
  try {
    const okKey = `txprovider:${provider}:ok`;
    const minKey = `txprovider:${provider}:minutes`;
    const costKey = `txprovider:${provider}:cost_usd`;
    const ok = Number(await env.AVC_KV.get(okKey)) || 0;
    const mins = parseFloat((await env.AVC_KV.get(minKey)) || "0") || 0;
    const cost = parseFloat((await env.AVC_KV.get(costKey)) || "0") || 0;
    await env.AVC_KV.put(okKey, String(ok + 1));
    await env.AVC_KV.put(minKey, String(mins + durationMinutes));
    await env.AVC_KV.put(costKey, String(cost + costUsd));
  } catch { /* noop */ }
}

export async function getProviderMetrics(env: Env): Promise<
  Record<string, { ok: number; errors: number; minutes: number; costUsd: number; errorRate: number }>
> {
  const names = ["groq", "deepinfra", "openai"];
  const out: Record<string, { ok: number; errors: number; minutes: number; costUsd: number; errorRate: number }> = {};
  for (const name of names) {
    const ok = Number(await env.AVC_KV.get(`txprovider:${name}:ok`)) || 0;
    const errors = Number(await env.AVC_KV.get(`txprovider:${name}:errors`)) || 0;
    const minutes = parseFloat((await env.AVC_KV.get(`txprovider:${name}:minutes`)) || "0") || 0;
    const costUsd = parseFloat((await env.AVC_KV.get(`txprovider:${name}:cost_usd`)) || "0") || 0;
    const total = ok + errors;
    out[name] = { ok, errors, minutes, costUsd, errorRate: total ? errors / total : 0 };
  }
  return out;
}
