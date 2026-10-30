import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail, OWNER_AI_LIMIT } from "@/lib/entitlements";
import { afterResponse, currentMonth, getCachedResult, getOpenAiKey, getSubsModel, getUsage, incrementUsage, putCachedResult } from "@/lib/ai-store";
import {
  SUB_LINE_LIMITS,
  normalizeSubRequest,
  parseSubTranslation,
  runSubTranslate,
  subCacheKey,
} from "@/lib/subs-translate";
import { requestFacts, surfaceOf } from "@/lib/telemetry";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";

/** A year: a line of dialogue does not change meaning. */
const SUBS_CACHE_TTL_SECONDS = 365 * 24 * 3600;

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
  const normalized = normalizeSubRequest(body);
  if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
  const subReq = normalized.req;

  const cacheKey = await subCacheKey(subReq);
  const cached = parseSubTranslation(await getCachedResult(cacheKey), subReq);
  if (cached) return NextResponse.json({ result: cached, cached: true });

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  // Latency is the product here: only the model call waits. The quota is read
  // alongside it, and the count and the cache are written after the response.
  const limit = owner ? OWNER_AI_LIMIT : SUB_LINE_LIMITS[plan];
  const month = currentMonth();
  const abort = new AbortController();
  const translation = runSubTranslate(apiKey, await getSubsModel(), subReq, {
    userId: profile.id,
    plan: owner ? "owner" : plan,
    country: requestFacts(req).country,
    surface: surfaceOf(req),
    direction: "en-ja",
  }, abort.signal);
  // A KV hiccup must not take the learner's subtitles away mid-episode: the
  // meter is abuse protection, not the product.
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
      incrementUsage(profile.id, month, "subs"),
    ]));
    return NextResponse.json({ result, cached: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "translate_failed" }, { status: 502 });
  }
}

export const POST = withApiTelemetry("/api/ai/translate", handlePOST);
