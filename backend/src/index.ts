// AnimeVocab Pro backend.
//
// Pro users: shared transcript cache (GET /v1/transcript). Cache misses are
// transcribed server-side once via Whisper, metered against the monthly cap.
// Client-supplied transcript writes are NOT accepted (v1 — server-only cache).
//
// BYO-key users stream audio directly to OpenAI Realtime (no cache).

import { activateLicense, validateLicense } from "./dodo";
import { getMetrics } from "./metrics";
import { mintTranscriptionToken } from "./openai";
import { publicConfig } from "./promo";
import { lookupTranscript, transcribeAndStore } from "./transcript";
import { getProviderMetrics } from "./transcribe";
import { addMinutes, getUsage } from "./usage";
import { validateCacheKey, validateStartSec, validateWindowSec } from "./validate";

export interface Env {
  AVC_KV: KVNamespace;
  OPENAI_API_KEY: string;
  GROQ_API_KEY?: string;
  DEEPINFRA_API_KEY?: string;
  DODO_API_KEY: string;
  CAP_MINUTES: string;
  TRANSCRIBE_MODEL: string;
  OPENAI_WHISPER_MODEL: string;
  GROQ_WHISPER_MODEL: string;
  DEEPINFRA_WHISPER_MODEL: string;
  TRANSCRIBE_PROVIDERS: string;
  TRANSCRIPT_MODEL_VERSION: string;
  DODO_API_BASE: string;
  CHECKOUT_URL: string;
  PROMO_CHECKOUT_URL: string;
  PROMO_END_UTC: string;
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

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) }
  });
}

function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

async function keyId(licenseKey: string): Promise<string> {
  const data = new TextEncoder().encode(licenseKey);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function checkLicense(env: Env, licenseKey: string): Promise<{ valid: boolean; reason?: string }> {
  const id = await keyId(licenseKey);
  const cacheKey = `lic:${id}`;
  const cached = await env.AVC_KV.get(cacheKey);
  if (cached === "valid") return { valid: true };

  const result = await validateLicense(env, licenseKey);
  if (result.valid) {
    await env.AVC_KV.put(cacheKey, "valid", { expirationTtl: 6 * 3600 });
  }
  return result;
}

async function requireLicense(env: Env, req: Request): Promise<
  { ok: true; licenseKey: string; id: string } | { ok: false; response: Response }
> {
  const licenseKey = bearer(req);
  if (!licenseKey) return { ok: false, response: json(req, { error: "missing Authorization: Bearer <license key>" }, 401) };
  const check = await checkLicense(env, licenseKey);
  if (!check.valid) return { ok: false, response: json(req, { error: check.reason || "subscription inactive" }, 402) };
  const id = await keyId(licenseKey);
  return { ok: true, licenseKey, id };
}

async function checkUsageCap(env: Env, req: Request, id: string): Promise<Response | null> {
  const cap = Number(env.CAP_MINUTES);
  const used = await getUsage(env, id);
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

      if (path === "/v1/license/activate" && req.method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { licenseKey?: string };
        const licenseKey = (body.licenseKey || "").trim();
        if (!licenseKey) return json(req, { error: "missing licenseKey" }, 400);

        const result = await activateLicense(env, licenseKey);
        if (!result.valid) return json(req, { active: false, error: result.reason || "invalid license" }, 402);

        const id = await keyId(licenseKey);
        await env.AVC_KV.put(`lic:${id}`, "valid", { expirationTtl: 6 * 3600 });
        const usage = await getUsage(env, id);
        return json(req, { active: true, capMinutes: Number(env.CAP_MINUTES), usedMinutes: Math.floor(usage) });
      }

      const licenseKey = bearer(req);
      if (!licenseKey) return json(req, { error: "missing Authorization: Bearer <license key>" }, 401);
      const id = await keyId(licenseKey);

      if (path === "/v1/license/status" && req.method === "GET") {
        const check = await checkLicense(env, licenseKey);
        const usage = await getUsage(env, id);
        const metrics = await getMetrics(env);
        return json(req, {
          active: check.valid,
          error: check.valid ? undefined : check.reason,
          capMinutes: Number(env.CAP_MINUTES),
          usedMinutes: Math.floor(usage),
          cacheHitRate: metrics.transcribeHitRate,
          cacheHits: metrics.transcribeHits,
          cacheMisses: metrics.transcribeMisses,
          lookupHits: metrics.lookupHits
        }, check.valid ? 200 : 402);
      }

      if (path === "/v1/session" && req.method === "POST") {
        const check = await checkLicense(env, licenseKey);
        if (!check.valid) return json(req, { error: check.reason || "subscription inactive" }, 402);

        const capErr = await checkUsageCap(env, req, id);
        if (capErr) return capErr;

        const token = await mintTranscriptionToken(env);
        return json(req, {
          token,
          model: env.TRANSCRIBE_MODEL,
          usedMinutes: Math.floor(await getUsage(env, id)),
          capMinutes: Number(env.CAP_MINUTES)
        });
      }

      if (path === "/v1/usage/heartbeat" && req.method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { minutes?: number };
        const minutes = Math.max(0, Math.min(10, Math.round(Number(body.minutes) || 0)));
        const cap = Number(env.CAP_MINUTES);
        const used = await addMinutes(env, id, minutes);
        return json(req, {
          usedMinutes: Math.floor(used),
          capMinutes: cap,
          overCap: used >= cap
        }, used >= cap ? 429 : 200);
      }

      if (path === "/v1/transcript/stats" && req.method === "GET") {
        const check = await checkLicense(env, licenseKey);
        if (!check.valid) return json(req, { error: check.reason || "subscription inactive" }, 402);
        const cache = await getMetrics(env);
        const providers = await getProviderMetrics(env);
        return json(req, { cache, providers, chain: env.TRANSCRIBE_PROVIDERS || "openai" });
      }

      if (path === "/v1/transcript" && req.method === "GET") {
        const auth = await requireLicense(env, req);
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

      // Client transcript writes disabled — cache is populated only by server-side Whisper.
      if (path === "/v1/transcript" && req.method === "POST") {
        return json(req, { error: "client transcript upload not supported" }, 403);
      }

      if (path === "/v1/transcript/transcribe" && req.method === "POST") {
        const auth = await requireLicense(env, req);
        if (!auth.ok) return auth.response;

        const capErr = await checkUsageCap(env, req, auth.id);
        if (capErr) return capErr;

        const body = (await req.json().catch(() => ({}))) as {
          key?: string;
          startSec?: number;
          audio?: string;
          /** Testing override: single provider name or comma-separated chain */
          provider?: string;
        };
        const cacheKey = (body.key || "").trim();
        const keyErr = validateCacheKey(cacheKey);
        if (keyErr) return json(req, { error: keyErr }, 400);

        const startSec = Number(body.startSec);
        const startErr = validateStartSec(startSec);
        if (startErr) return json(req, { error: startErr }, 400);

        const audio = body.audio || "";
        if (!audio) return json(req, { error: "missing audio" }, 400);

        const result = await transcribeAndStore(env, auth.id, cacheKey, audio, startSec, body.provider);
        return json(req, result);
      }

      return json(req, { error: "not found" }, 404);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      if (/monthly listening hours used up/i.test(detail)) {
        return json(req, { error: detail }, 429);
      }
      return json(req, { error: "internal: " + detail }, 500);
    }
  }
};
