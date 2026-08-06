import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { type Tier } from "@/lib/ai-coach";
import {
  getCoachConfig,
  getOpenAiKey,
  getUsage,
  currentMonth,
  getCachedResult,
  quotaFor,
  reserveUsage,
} from "@/lib/ai-store";
import { normalizeWordPickRequest, pickWordCached, wordPickCacheKey } from "@/lib/word-picker";
import { requestFacts, surfaceOf } from "@/lib/telemetry";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";

async function handlePOST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = isOwnerEmail(profile.email);
  const user = { id: profile.id, plan: resolvePlan(profile) };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const normalized = normalizeWordPickRequest(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  const { req: pickReq } = normalized;

  const apiKey = await getOpenAiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }

  // Metered on the "auto" bucket: the extension fires this per subtitle line
  // without the learner asking, so it must not spend the advertised allowance.
  const { model } = await getCoachConfig();
  const tier: Tier = user.plan;
  const limit = await quotaFor(user.plan, "auto", owner);
  const month = currentMonth();

  const cacheKey = await wordPickCacheKey(pickReq);
  const cached = await getCachedResult(cacheKey);
  if (cached && typeof cached === "object" && cached !== null && "word" in cached) {
    const w = (cached as { word: string }).word;
    if (pickReq.candidates.some((c) => c.word === w)) {
      const used = await getUsage(user.id, month, "auto");
      return NextResponse.json({
        result: { word: w },
        cached: true,
        usage: { used, limit, plan: tier, bucket: "auto" },
      });
    }
  }

  const reservation = await reserveUsage(user.id, month, "auto", limit);
  if (!reservation.ok) {
    return NextResponse.json(
      {
        error: "auto_quota_exhausted",
        usage: { used: reservation.used, limit, plan: tier, bucket: "auto" },
      },
      { status: 429 }
    );
  }

  try {
    const { result } = await pickWordCached(apiKey, model, pickReq, {
      userId: user.id,
      plan: owner ? "owner" : tier,
      country: requestFacts(req).country,
      surface: surfaceOf(req),
      direction: pickReq.direction,
    });
    return NextResponse.json({
      result,
      cached: false,
      usage: { used: reservation.used, limit, plan: tier, bucket: "auto" },
    });
  } catch (err) {
    await reservation.refund();
    const detail = err instanceof Error ? err.message : "pick_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}

export const POST = withApiTelemetry("/api/ai/pick-word", handlePOST);
