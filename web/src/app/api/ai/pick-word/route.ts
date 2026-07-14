import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail, OWNER_AI_LIMIT } from "@/lib/entitlements";
import { aiLimitForPlan, type Tier } from "@/lib/ai-coach";
import { getCoachConfig, getOpenAiKey, getUsage, currentMonth, getCachedResult } from "@/lib/ai-store";
import { normalizeWordPickRequest, pickWordCached, wordPickCacheKey } from "@/lib/word-picker";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

  const { model, freeLimit, proLimit, maxLimit } = await getCoachConfig();
  const tier: Tier = user.plan;
  const limit = owner ? OWNER_AI_LIMIT : aiLimitForPlan(user.plan, freeLimit, proLimit, maxLimit);
  const month = currentMonth();

  const cacheKey = await wordPickCacheKey(pickReq);
  const cached = await getCachedResult(cacheKey);
  if (cached && typeof cached === "object" && cached !== null && "word" in cached) {
    const w = (cached as { word: string }).word;
    if (pickReq.candidates.some((c) => c.word === w)) {
      const used = await getUsage(user.id, month);
      return NextResponse.json({
        result: { word: w },
        cached: true,
        usage: { used, limit, plan: tier },
      });
    }
  }

  const used = await getUsage(user.id, month);
  if (used >= limit) {
    return NextResponse.json(
      { error: "ai_quota_exhausted", usage: { used, limit, plan: tier } },
      { status: 429 }
    );
  }

  try {
    const { result } = await pickWordCached(apiKey, model, pickReq, user.id);
    const newUsed = await getUsage(user.id, month);
    return NextResponse.json({
      result,
      cached: false,
      usage: { used: newUsed, limit, plan: tier },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "pick_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
