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
  const user = { id: profile.id, plan: resolvePlan() };

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

  // Pro is open to everyone: non-owners get the Pro monthly cap, owners are
  // effectively unlimited. (The old free-launch window is gone — it capped
  // everyone LOWER than Pro, which contradicts "Pro for everyone".)
  const { model, freeLimit, proLimit } = await getCoachConfig();
  const tier: Tier = user.plan; // "pro" for everyone
  const limit = owner ? OWNER_AI_LIMIT : aiLimitForPlan(user.plan, freeLimit, proLimit);
  const month = currentMonth();

  // Cache hit: free to serve, does not consume quota.
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

  await putCachedResult(cacheKey, result);
  const newUsed = await incrementUsage(user.id, month);

  return NextResponse.json({
    result,
    cached: false,
    usage: { used: newUsed, limit, plan: tier },
  });
}
