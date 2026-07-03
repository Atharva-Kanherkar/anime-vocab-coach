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
    if (def && def.apiKey(env)) chain.push(def);
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
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch(def.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs)
  });

  const raw = await res.json().catch(() => ({}));
  const data = coerceWhisperJson(raw);
  if (!res.ok) {
    throw new Error(`${def.name}: ${data.error?.message || res.status}`);
  }
  return data;
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
  const chain = resolveProviderChain(env, opts.providerOverride);

  if (!chain.length) {
    throw new Error("no transcription providers configured");
  }

  let lastError = "all providers failed";
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
      await recordProviderError(env, def.name);
    }
  }

  throw new Error(lastError);
}

async function recordProviderError(env: Env, provider: string): Promise<void> {
  try {
    const key = `txprovider:${provider}:errors`;
    const v = await env.AVC_KV.get(key);
    await env.AVC_KV.put(key, String((Number(v) || 0) + 1));
  } catch { /* noop */ }
}

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
