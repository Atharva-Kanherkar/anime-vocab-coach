import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail, OWNER_AI_LIMIT } from "@/lib/entitlements";
import {
  aiLimitForPlan,
  coachCacheKey,
  normalizeCoachRequest,
  runCoach,
  type Tier,
} from "@/lib/ai-coach";
import {
  currentMonth,
  getCachedResult,
  getCoachConfig,
  getOpenAiKey,
  getUsage,
  incrementUsage,
  putCachedResult,
} from "@/lib/ai-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Accept a signed-in web session, the dev bypass, OR the extension's sync
  // token (Authorization: Bearer) — so the overlay card can call the coach.
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

  const normalized = normalizeCoachRequest(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  const { req: coachReq } = normalized;

  const apiKey = await getOpenAiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }

  // AI cap is per tier (free/pro/max), read from the buyer's Clerk plan; owners
  // are effectively unlimited.
  const { model, freeLimit, proLimit, maxLimit } = await getCoachConfig();
  const tier: Tier = user.plan;
  const limit = owner ? OWNER_AI_LIMIT : aiLimitForPlan(user.plan, freeLimit, proLimit, maxLimit);
  const month = currentMonth();

  // Cache hit: free to serve, does not consume quota. Chat is never cached.
  if (coachReq.mode !== "chat") {
    const cacheKey = await coachCacheKey(coachReq);
    const cached = await getCachedResult(cacheKey);
    if (cached) {
      const used = await getUsage(user.id, month);
      return NextResponse.json({
        result: cached,
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

  let result;
  try {
    result = await runCoach(apiKey, model, coachReq);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "ai_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  if (coachReq.mode !== "chat") {
    const cacheKey = await coachCacheKey(coachReq);
    try {
      await putCachedResult(cacheKey, result);
    } catch (cacheErr) {
      console.warn("[ai/coach] cache write failed", cacheErr);
    }
  }
  let newUsed = used + 1;
  try {
    newUsed = await incrementUsage(user.id, month);
  } catch (meterErr) {
    console.warn("[ai/coach] usage meter write failed", meterErr);
  }

  return NextResponse.json({
    result,
    cached: false,
    usage: { used: newUsed, limit, plan: tier },
  });
}
