// AnimeVocab Pro backend.
//
// Pro users: the extension asks us for transcript segments from a shared cache
// (GET /v1/transcript). On cache miss, audio is sent here once for server-side
// Whisper transcription — then stored and served to all future users.
//
// BYO-key users still stream audio directly to OpenAI Realtime (no cache).
//
// Endpoints (all JSON, CORS *, license key via "Authorization: Bearer <key>"):
//   GET  /v1/public/config                  -> promo flag, checkout URLs (no auth)
//   POST /v1/license/activate   { licenseKey }  -> activate key with Dodo, return status
//   GET  /v1/license/status                     -> plan status + minutes used/cap
//   POST /v1/session                            -> ephemeral OpenAI token (BYO fallback / legacy)
//   POST /v1/usage/heartbeat    { minutes }     -> extension reports listening time (max 10/report)
//   GET  /v1/transcript?key=&t=                 -> lookup cached segments at playback time t
//   POST /v1/transcript                         -> prefill subtitle segments { key, segments, source }
//   POST /v1/transcript/transcribe              -> transcribe-on-miss { key, startSec, audio }
//   GET  /v1/transcript/stats                   -> cache hit rate metrics

import { activateLicense, validateLicense } from "./dodo";
import { getMetrics } from "./metrics";
import { mintTranscriptionToken } from "./openai";
import { publicConfig } from "./promo";
import { lookupTranscript, prefillTranscript, transcribeAndStore } from "./transcript";
import type { TranscriptSegment, TranscriptSource } from "./transcript-types";
import { addMinutes, getUsage } from "./usage";

export interface Env {
  AVC_KV: KVNamespace;
  OPENAI_API_KEY: string;
  DODO_API_KEY: string;
  CAP_MINUTES: string;
  TRANSCRIBE_MODEL: string;
  TRANSCRIPT_MODEL_VERSION: string;
  DODO_API_BASE: string;
  CHECKOUT_URL: string;
  PROMO_CHECKOUT_URL: string;
  PROMO_END_UTC: string;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
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
  if (!licenseKey) return { ok: false, response: json({ error: "missing Authorization: Bearer <license key>" }, 401) };
  const check = await checkLicense(env, licenseKey);
  if (!check.valid) return { ok: false, response: json({ error: check.reason || "subscription inactive" }, 402) };
  const id = await keyId(licenseKey);
  return { ok: true, licenseKey, id };
}

async function checkUsageCap(env: Env, id: string): Promise<Response | null> {
  const cap = Number(env.CAP_MINUTES);
  const used = await getUsage(env, id);
  if (used >= cap) {
    return json({ error: "monthly listening hours used up", usedMinutes: used, capMinutes: cap }, 429);
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (path === "/v1/public/config" && req.method === "GET") {
        return json(publicConfig(env));
      }

      if (path === "/v1/license/activate" && req.method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { licenseKey?: string };
        const licenseKey = (body.licenseKey || "").trim();
        if (!licenseKey) return json({ error: "missing licenseKey" }, 400);

        const result = await activateLicense(env, licenseKey);
        if (!result.valid) return json({ active: false, error: result.reason || "invalid license" }, 402);

        const id = await keyId(licenseKey);
        await env.AVC_KV.put(`lic:${id}`, "valid", { expirationTtl: 6 * 3600 });
        const usage = await getUsage(env, id);
        return json({ active: true, capMinutes: Number(env.CAP_MINUTES), usedMinutes: usage });
      }

      const licenseKey = bearer(req);
      if (!licenseKey) return json({ error: "missing Authorization: Bearer <license key>" }, 401);
      const id = await keyId(licenseKey);

      if (path === "/v1/license/status" && req.method === "GET") {
        const check = await checkLicense(env, licenseKey);
        const usage = await getUsage(env, id);
        const metrics = await getMetrics(env);
        return json({
          active: check.valid,
          error: check.valid ? undefined : check.reason,
          capMinutes: Number(env.CAP_MINUTES),
          usedMinutes: usage,
          cacheHitRate: metrics.hitRate,
          cacheHits: metrics.hits,
          cacheMisses: metrics.misses
        }, check.valid ? 200 : 402);
      }

      if (path === "/v1/session" && req.method === "POST") {
        const check = await checkLicense(env, licenseKey);
        if (!check.valid) return json({ error: check.reason || "subscription inactive" }, 402);

        const capErr = await checkUsageCap(env, id);
        if (capErr) return capErr;

        const token = await mintTranscriptionToken(env);
        return json({
          token,
          model: env.TRANSCRIBE_MODEL,
          usedMinutes: await getUsage(env, id),
          capMinutes: Number(env.CAP_MINUTES)
        });
      }

      if (path === "/v1/usage/heartbeat" && req.method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { minutes?: number };
        const minutes = Math.max(0, Math.min(10, Math.round(Number(body.minutes) || 0)));
        const cap = Number(env.CAP_MINUTES);
        const used = await addMinutes(env, id, minutes);
        return json({ usedMinutes: used, capMinutes: cap, overCap: used >= cap }, used >= cap ? 429 : 200);
      }

      // --- Shared transcript cache (Pro only) ---

      if (path === "/v1/transcript/stats" && req.method === "GET") {
        const check = await checkLicense(env, licenseKey);
        if (!check.valid) return json({ error: check.reason || "subscription inactive" }, 402);
        return json(await getMetrics(env));
      }

      if (path === "/v1/transcript" && req.method === "GET") {
        const auth = await requireLicense(env, req);
        if (!auth.ok) return auth.response;

        const cacheKey = url.searchParams.get("key") || "";
        const t = Number(url.searchParams.get("t") || "0");
        const windowSec = Number(url.searchParams.get("window") || "8");
        if (!cacheKey) return json({ error: "missing key" }, 400);

        const result = await lookupTranscript(env, cacheKey, t, windowSec);
        return json(result);
      }

      if (path === "/v1/transcript" && req.method === "POST") {
        const auth = await requireLicense(env, req);
        if (!auth.ok) return auth.response;

        const body = (await req.json().catch(() => ({}))) as {
          key?: string;
          segments?: TranscriptSegment[];
          source?: TranscriptSource;
        };
        const cacheKey = (body.key || "").trim();
        if (!cacheKey) return json({ error: "missing key" }, 400);
        if (!Array.isArray(body.segments) || !body.segments.length) {
          return json({ error: "missing segments" }, 400);
        }

        const source: TranscriptSource = body.source === "subtitle_track" ? "subtitle_track" : "whisper";
        const result = await prefillTranscript(env, cacheKey, body.segments, source);
        return json(result);
      }

      if (path === "/v1/transcript/transcribe" && req.method === "POST") {
        const auth = await requireLicense(env, req);
        if (!auth.ok) return auth.response;

        const capErr = await checkUsageCap(env, auth.id);
        if (capErr) return capErr;

        const body = (await req.json().catch(() => ({}))) as {
          key?: string;
          startSec?: number;
          audio?: string;
        };
        const cacheKey = (body.key || "").trim();
        const startSec = Number(body.startSec || 0);
        const audio = body.audio || "";
        if (!cacheKey || !audio) return json({ error: "missing key or audio" }, 400);

        const result = await transcribeAndStore(env, cacheKey, audio, startSec);
        return json(result);
      }

      return json({ error: "not found" }, 404);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return json({ error: "internal: " + detail }, 500);
    }
  }
};
