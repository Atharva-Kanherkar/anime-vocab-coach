// AnimeVocab transcription backend.
//
// Authenticates extension callers via Clerk-linked sync tokens (avc_st_*).
// BYO-key users stream audio directly to OpenAI Realtime and never hit this API.

import { economicsSnapshot } from "./economics";
import { getMetrics } from "./metrics";
import { mintTranscriptionToken } from "./openai";
import { publicConfig } from "./promo";
import { lookupTranscript, transcribeAndStore } from "./transcript";
import { getProviderMetrics, TranscriptionError } from "./transcribe/index";
import { requireAuth } from "./sync-auth";
import { capMinutesForPlan, normalizePlan } from "./plan";
import { addMinutes, getUsage } from "./usage";
import { validateCacheKey, validateStartSec, validateWindowSec } from "./validate";

export interface Env {
  AVC_KV: KVNamespace;
  OPENAI_API_KEY: string;
  GROQ_API_KEY?: string;
  DEEPINFRA_API_KEY?: string;
  CAP_MINUTES: string;
  PRO_CAP_MINUTES?: string;
  MAX_CAP_MINUTES?: string;
  TRANSCRIBE_MODEL: string;
  OPENAI_WHISPER_MODEL: string;
  GROQ_WHISPER_MODEL: string;
  DEEPINFRA_WHISPER_MODEL: string;
  TRANSCRIBE_PROVIDERS: string;
  TRANSCRIPT_MODEL_VERSION: string;
  PAYMENT_FEE_RATE?: string;
  PAYMENT_FIXED_FEE_USD?: string;
  AI_COST_USD_PER_CALL?: string;
  FREE_AI_CALLS_PER_MONTH?: string;
  PRO_AI_CALLS_PER_MONTH?: string;
  MAX_AI_CALLS_PER_MONTH?: string;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowOrigin =
    origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")
      ? origin
      : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Vary": "Origin"
  };
}

function json(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req), ...extraHeaders }
  });
}

async function checkUsageCap(env: Env, req: Request, userId: string, cap: number): Promise<Response | null> {
  const used = await getUsage(env, userId);
  if (used >= cap) {
    return json(req, { error: "monthly listening hours used up", usedMinutes: Math.floor(used), capMinutes: cap }, 429);
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    try {
      if (path === "/v1/public/config" && req.method === "GET") {
        return json(req, publicConfig(env));
      }

      if (path === "/v1/session" && req.method === "POST") {
        const auth = await requireAuth(env.AVC_KV, req, json);
        if (!auth.ok) return auth.response;

        const cap = capMinutesForPlan(env, normalizePlan(auth.profile.plan));
        const capErr = await checkUsageCap(env, req, auth.userId, cap);
        if (capErr) return capErr;

        const body = (await req.json().catch(() => ({}))) as { language?: string };
        const language = body.language === "en" ? "en" : "ja";
        const token = await mintTranscriptionToken(env, language);
        return json(req, {
          token,
          model: env.TRANSCRIBE_MODEL,
          language,
          usedMinutes: Math.floor(await getUsage(env, auth.userId)),
          capMinutes: cap
        });
      }

      if (path === "/v1/usage/heartbeat" && req.method === "POST") {
        const auth = await requireAuth(env.AVC_KV, req, json);
        if (!auth.ok) return auth.response;

        const body = (await req.json().catch(() => ({}))) as { minutes?: number };
        const minutes = Math.max(0, Math.min(10, Math.round(Number(body.minutes) || 0)));
        const cap = capMinutesForPlan(env, normalizePlan(auth.profile.plan));
        let used: number;
        try {
          used = await addMinutes(env, auth.userId, minutes);
        } catch {
          used = await getUsage(env, auth.userId);
        }
        return json(req, {
          usedMinutes: Math.floor(used),
          capMinutes: cap,
          overCap: used >= cap
        }, used >= cap ? 429 : 200);
      }

      if (path === "/v1/transcript/stats" && req.method === "GET") {
        const auth = await requireAuth(env.AVC_KV, req, json);
        if (!auth.ok) return auth.response;

        const cache = await getMetrics(env);
        const providers = await getProviderMetrics(env);
        return json(req, {
          cache,
          providers,
          chain: env.TRANSCRIBE_PROVIDERS || "openai",
          economics: economicsSnapshot(env)
        });
      }

      if (path === "/v1/transcript" && req.method === "GET") {
        const auth = await requireAuth(env.AVC_KV, req, json);
        if (!auth.ok) return auth.response;

        const cacheKey = url.searchParams.get("key") || "";
        const keyErr = validateCacheKey(cacheKey);
        if (keyErr) return json(req, { error: keyErr }, 400);

        const t = Number(url.searchParams.get("t") || "0");
        const tErr = validateStartSec(t);
        if (tErr) return json(req, { error: tErr }, 400);

        const windowSec = validateWindowSec(Number(url.searchParams.get("window") || "8"));
        return json(req, await lookupTranscript(env, cacheKey, t, windowSec));
      }

      if (path === "/v1/transcript" && req.method === "POST") {
        return json(req, { error: "client transcript upload not supported" }, 403);
      }

      if (path === "/v1/transcript/transcribe" && req.method === "POST") {
        const auth = await requireAuth(env.AVC_KV, req, json);
        if (!auth.ok) return auth.response;

        const cap = capMinutesForPlan(env, normalizePlan(auth.profile.plan));
        const capErr = await checkUsageCap(env, req, auth.userId, cap);
        if (capErr) return capErr;

        const body = (await req.json().catch(() => ({}))) as {
          key?: string;
          startSec?: number;
          audio?: string;
        };
        const cacheKey = (body.key || "").trim();
        const keyErr = validateCacheKey(cacheKey);
        if (keyErr) return json(req, { error: keyErr }, 400);

        const startSec = Number(body.startSec);
        const startErr = validateStartSec(startSec);
        if (startErr) return json(req, { error: startErr }, 400);

        const audio = body.audio || "";
        if (!audio) return json(req, { error: "missing audio" }, 400);

        const result = await transcribeAndStore(env, auth.userId, cacheKey, audio, startSec, cap);
        return json(req, result);
      }

      return json(req, { error: "not found" }, 404);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      if (/monthly listening hours used up/i.test(detail)) {
        return json(req, { error: detail }, 429);
      }
      if (err instanceof TranscriptionError) {
        // A transient/upstream provider failure — surface a real status (503 or
        // 502) plus Retry-After so the extension can back off and retry instead
        // of silently dropping an opaque 500. [observability] surfaces `detail`.
        console.error("transcription failed:", detail);
        return json(
          req,
          { error: "transcription unavailable", retryable: err.retryable },
          err.status,
          err.retryable ? { "Retry-After": "5" } : undefined
        );
      }
      console.error("request failed:", detail);
      return json(req, { error: "internal error" }, 500);
    }
  }
};
