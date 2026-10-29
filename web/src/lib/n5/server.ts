import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolveProfile } from "@/lib/auth";
import { getExistingSyncToken, getOrCreateSyncToken } from "@/lib/sync-store";
import { gatewayRoute } from "./core";

export async function n5Config(): Promise<{ enabled: boolean; origin: string }> {
  let env: Record<string, unknown> = {};
  try { env = (await getCloudflareContext({ async: true })).env as unknown as Record<string, unknown>; } catch { /* next dev */ }
  const enabled = (env.N5_WEB_PREVIEW_ENABLED ?? process.env.N5_WEB_PREVIEW_ENABLED) === "1";
  if (!enabled) return { enabled: false, origin: "https://avc-api.animevocab.workers.dev" };
  const configured = env.N5_API_ORIGIN ?? process.env.N5_API_ORIGIN;
  const origin = typeof configured === "string" ? configured : "https://avc-api.animevocab.workers.dev";
  const u = new URL(origin);
  const local = process.env.NODE_ENV !== "production" && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) && u.protocol === "http:";
  if (!(origin === "https://avc-api.animevocab.workers.dev" || local) || u.username || u.password || u.pathname !== "/" || u.search || u.hash) throw new Error("Invalid N5 upstream configuration");
  return { enabled, origin: u.origin };
}
function fail(code: string, status: number): Response {
  return Response.json({ error: { code, message: code === "unauthorized" ? "Sign in again to continue." : "Course request unavailable. Your saved progress is unchanged." } }, { status, headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
}
async function boundedBody(req: Request | Response, limit = 16_384): Promise<string | undefined> {
  if (!req.body) return undefined;
  const reader = req.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("body_too_large"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  if (size === 0) return undefined;
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export async function gateway(req: Request, parts: string[]): Promise<Response> {
  try {
    const config = await n5Config();
    if (!config.enabled) return fail("not_found", 404);
    if (req.headers.has("Authorization")) return fail("unauthorized", 401);
    const url = new URL(req.url);
    const route = gatewayRoute(parts, req.method, url.searchParams);
    if (!route) return fail("not_found", 404);
    if (req.headers.get("Sec-Fetch-Site") === "cross-site") return fail("origin_not_allowed", 403);
    // Next dev normalizes the URL hostname to localhost. The HTTP Host still
    // identifies the origin the browser used; never trust x-forwarded-host here.
    const host = req.headers.get("Host");
    const expectedOrigin = host ? new URL(`${url.protocol}//${host}`).origin : url.origin;
    if (req.method !== "GET" && req.headers.get("Origin") !== expectedOrigin) return fail("origin_not_allowed", 403);
    const profile = await resolveProfile(req);
    if (!profile) return fail("unauthorized", 401);
    if (req.method === "POST" && req.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") return fail("content_type", 415);
    let payload: string | undefined;
    try { payload = await boundedBody(req); } catch (error) { return fail(error instanceof Error && error.message === "body_too_large" ? "body_too_large" : "invalid_request", error instanceof Error && error.message === "body_too_large" ? 413 : 400); }
    if (req.method === "DELETE" && payload !== undefined) return fail("invalid_request", 400);
    const token = await getExistingSyncToken(profile.id) ?? await getOrCreateSyncToken(profile.id, profile);
    const upstream = await fetch(config.origin + "/v1/n5" + route, {
      method: req.method, headers: { Authorization: `Bearer ${token}`, ...(req.method === "POST" ? { "Content-Type": "application/json" } : {}) },
      body: payload, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    });
    if (![200, 400, 401, 403, 404, 405, 409, 413, 415, 429, 503].includes(upstream.status)) return fail("course_unavailable", 503);
    if (!upstream.headers.get("Content-Type")?.includes("application/json")) return fail("course_unavailable", 503);
    const data = JSON.parse((await boundedBody(upstream, 524_288)) ?? "null");
    if (!data || typeof data !== "object") return fail("course_unavailable", 503);
    if (upstream.status >= 400) {
      const code = data.error?.code;
      if (typeof code !== "string" || !/^[a-z_]{1,80}$/.test(code)) return fail("course_unavailable", 503);
      const error = { code, message: "Course request could not complete. Your answers are preserved.",
        ...(typeof data.error?.details?.questionId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(data.error.details.questionId) ? { details: { questionId: data.error.details.questionId } } : {}) };
      return Response.json({ error }, { status: upstream.status, headers: { "Cache-Control": "no-store", "Vary": "Cookie" } });
    }
    // Only bounded API JSON crosses back; no cookies, redirects or credentials.
    return Response.json(data, { headers: { "Cache-Control": "no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" } });
  } catch { return fail("course_unavailable", 503); }
}
