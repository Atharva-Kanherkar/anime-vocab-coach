import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail, OWNER_AI_LIMIT } from "@/lib/entitlements";
import { currentMonth, getCachedResult, getOpenAiKey, getSubsModel, putCachedResult, reserveUsage } from "@/lib/ai-store";
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

  const limit = owner ? OWNER_AI_LIMIT : SUB_LINE_LIMITS[plan];
  let refund = async () => {};
  try {
    const reservation = await reserveUsage(profile.id, currentMonth(), "subs", limit);
    if (!reservation.ok) {
      return NextResponse.json({ error: "subs_quota_exhausted", usage: { used: reservation.used, limit, plan } }, { status: 429 });
    }
    refund = reservation.refund;
  } catch (err) {
    // The meter is abuse protection, not the product: a KV hiccup must not
    // take the learner's subtitles away mid-episode.
    console.warn("[subs] usage meter unavailable", err);
  }

  try {
    const result = await runSubTranslate(apiKey, await getSubsModel(), subReq, {
      userId: profile.id,
      plan: owner ? "owner" : plan,
      country: requestFacts(req).country,
      surface: surfaceOf(req),
      direction: "en-ja",
    });
    try {
      await putCachedResult(cacheKey, result, SUBS_CACHE_TTL_SECONDS);
    } catch (err) {
      console.warn("[subs] cache write failed", err);
    }
    return NextResponse.json({ result, cached: false });
  } catch (err) {
    await refund().catch(() => {});
    return NextResponse.json({ error: err instanceof Error ? err.message : "translate_failed" }, { status: 502 });
  }
}

export const POST = withApiTelemetry("/api/ai/translate", handlePOST);
