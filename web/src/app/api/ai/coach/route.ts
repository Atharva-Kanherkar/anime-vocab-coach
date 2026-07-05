import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  aiLimitForPlan,
  coachCacheKey,
  launchActive,
  normalizeCoachRequest,
  runCoach,
  type Plan,
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

async function resolveUser(): Promise<{ id: string; plan: Plan } | null> {
  const user = await currentUser();
  if (!user) return null;

  // Pro is set via Clerk publicMetadata.plan once a Dodo subscription is linked
  // (webhook wiring is a follow-up). Everyone defaults to the free taste tier.
  const plan: Plan = user.publicMetadata?.plan === "pro" ? "pro" : "free";
  return { id: user.id, plan };
}

export async function POST(req: Request) {
  const user = await resolveUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  const { model, freeLimit, proLimit, launchLimit, launchUntil } = await getCoachConfig();
  // Free launch: while the window is open, every signed-in account gets all
  // features at one capped limit. No Dodo/plan gating. After the window, fall
  // back to per-plan limits.
  const isLaunch = launchActive(launchUntil);
  const tier: Tier = isLaunch ? "launch" : user.plan;
  const limit = isLaunch ? launchLimit : aiLimitForPlan(user.plan, freeLimit, proLimit);
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
