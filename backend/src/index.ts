// AnimeVocab Pro backend.
//
// Design goal: audio NEVER flows through this server. The extension asks us
// for a short-lived OpenAI ephemeral token, then streams tab audio directly
// to OpenAI's Realtime API. We only do three tiny jobs:
//   1. validate the user's Dodo Payments license (subscription-backed),
//   2. meter listening minutes against the monthly fair-use cap,
//   3. mint the ephemeral token with OUR OpenAI key (stored as a secret).
// That keeps the whole thing on Cloudflare's free tier for thousands of users.
//
// Endpoints (all JSON, CORS *, license key via "Authorization: Bearer <key>"):
//   POST /v1/license/activate   { licenseKey }  -> activate key with Dodo, return status
//   GET  /v1/license/status                     -> plan status + minutes used/cap
//   POST /v1/session                            -> ephemeral OpenAI token for one listening session
//   POST /v1/usage/heartbeat    { minutes }     -> extension reports listening time (max 10/report)

import { activateLicense, validateLicense } from "./dodo";
import { mintTranscriptionToken } from "./openai";
import { addMinutes, getUsage } from "./usage";

export interface Env {
  AVC_KV: KVNamespace;
  OPENAI_API_KEY: string;
  DODO_API_KEY: string;
  CAP_MINUTES: string;
  TRANSCRIBE_MODEL: string;
  DODO_API_BASE: string;
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

// Hash the license key before using it as a KV key so a KV dump alone can't
// be replayed as credentials.
async function keyId(licenseKey: string): Promise<string> {
  const data = new TextEncoder().encode(licenseKey);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// Dodo validation result cached for 6h so we don't call Dodo on every heartbeat.
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
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

      // Everything below requires a license key.
      const licenseKey = bearer(req);
      if (!licenseKey) return json({ error: "missing Authorization: Bearer <license key>" }, 401);
      const id = await keyId(licenseKey);

      if (path === "/v1/license/status" && req.method === "GET") {
        const check = await checkLicense(env, licenseKey);
        const usage = await getUsage(env, id);
        return json({
          active: check.valid,
          error: check.valid ? undefined : check.reason,
          capMinutes: Number(env.CAP_MINUTES),
          usedMinutes: usage
        }, check.valid ? 200 : 402);
      }

      if (path === "/v1/session" && req.method === "POST") {
        const check = await checkLicense(env, licenseKey);
        if (!check.valid) return json({ error: check.reason || "subscription inactive" }, 402);

        const cap = Number(env.CAP_MINUTES);
        const used = await getUsage(env, id);
        if (used >= cap) {
          return json({ error: "monthly listening hours used up", usedMinutes: used, capMinutes: cap }, 429);
        }

        const token = await mintTranscriptionToken(env);
        return json({
          token,
          model: env.TRANSCRIBE_MODEL,
          usedMinutes: used,
          capMinutes: cap
        });
      }

      if (path === "/v1/usage/heartbeat" && req.method === "POST") {
        const body = (await req.json().catch(() => ({}))) as { minutes?: number };
        // Clamp: heartbeats arrive every ≤5 min, so anything above 10 is bogus.
        const minutes = Math.max(0, Math.min(10, Math.round(Number(body.minutes) || 0)));
        const cap = Number(env.CAP_MINUTES);
        const used = await addMinutes(env, id, minutes);
        return json({ usedMinutes: used, capMinutes: cap, overCap: used >= cap }, used >= cap ? 429 : 200);
      }

      return json({ error: "not found" }, 404);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return json({ error: "internal: " + detail }, 500);
    }
  }
};
