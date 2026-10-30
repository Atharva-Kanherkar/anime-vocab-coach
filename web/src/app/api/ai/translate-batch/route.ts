import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail, OWNER_AI_LIMIT } from "@/lib/entitlements";
import { addUsage, afterResponse, currentMonth, getCachedResult, getOpenAiKey, getSubsModel, getUsage, putCachedResult } from "@/lib/ai-store";
import { SUB_LINE_LIMITS, batchCacheKey, normalizeBatchRequest, parseBatch, runBatchTranslate } from "@/lib/subs-translate";
import { requestFacts, surfaceOf } from "@/lib/telemetry";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";

const SUBS_CACHE_TTL_SECONDS = 365 * 24 * 3600;

/**
 * A chunk of an episode's subtitle track, translated before it plays. The
 * extension asks for the chunk playing now first, then the ones after it, so
 * the English is waiting when each line comes up. Chunks are cut at fixed
 * places in the track, so every learner watching the episode shares them.
 */
async function handlePOST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = isOwnerEmail(profile.email);
  const plan = resolvePlan(profile);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const normalized = normalizeBatchRequest(body);
  if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
  const batch = normalized.req;

  const cacheKey = await batchCacheKey(batch);
  const cached = parseBatch(await getCachedResult(cacheKey), batch);
  if (cached) return NextResponse.json({ result: cached, cached: true });

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const limit = owner ? OWNER_AI_LIMIT : SUB_LINE_LIMITS[plan];
  const month = currentMonth();
  const abort = new AbortController();
  const translation = runBatchTranslate(apiKey, await getSubsModel(), batch, {
    userId: profile.id,
    plan: owner ? "owner" : plan,
    country: requestFacts(req).country,
    surface: surfaceOf(req),
    direction: "en-ja",
  }, abort.signal);
  const used = await getUsage(profile.id, month, "subs").catch(() => 0);
  if (used >= limit) {
    abort.abort();
    translation.catch(() => {});
    return NextResponse.json({ error: "subs_quota_exhausted", usage: { used, limit, plan } }, { status: 429 });
  }

  try {
    const result = await translation;
    await afterResponse(Promise.all([
      putCachedResult(cacheKey, result, SUBS_CACHE_TTL_SECONDS),
      addUsage(profile.id, month, "subs", batch.lines.length),
    ]));
    return NextResponse.json({ result, cached: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "translate_failed" }, { status: 502 });
  }
}

export const POST = withApiTelemetry("/api/ai/translate-batch", handlePOST);
