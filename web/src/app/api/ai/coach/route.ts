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
  putCachedResult,
  reserveUsage,
} from "@/lib/ai-store";
import { EMPTY_USAGE, type TokenUsage } from "@/lib/llm-pricing";
import { recordLlmCall, requestFacts, surfaceOf } from "@/lib/telemetry";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";

async function handlePOST(req: Request) {
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
  const { model, reasoningEffort, freeLimit, proLimit, maxLimit } = await getCoachConfig();
  const tier: Tier = user.plan;
  const limit = owner ? OWNER_AI_LIMIT : aiLimitForPlan(user.plan, freeLimit, proLimit, maxLimit);
  const month = currentMonth();

  const facts = requestFacts(req);
  const telemetryBase = {
    model,
    operation: coachReq.mode,
    userId: user.id,
    plan: owner ? "owner" : tier,
    effort: reasoningEffort,
    country: facts.country,
    surface: surfaceOf(req),
    direction: coachReq.direction,
  };

  // Cache hit: free to serve, does not consume quota. Chat is never cached.
  if (coachReq.mode !== "chat") {
    const cacheKey = await coachCacheKey(coachReq);
    const cached = await getCachedResult(cacheKey);
    if (cached) {
      const used = await getUsage(user.id, month);
      // Logged too: the cache hit rate is what keeps the OpenAI bill down, so
      // it has to be visible next to the calls that actually cost money.
      await recordLlmCall({ ...telemetryBase, status: "cached", costUsd: 0 });
      return NextResponse.json({
        result: cached,
        cached: true,
        usage: { used, limit, plan: tier },
      });
    }
  }

  // Claim the call before spending on it: checking and then incrementing after
  // the provider returned let every request that arrived in the meantime read
  // the same pre-spend count and sail past the cap.
  const reservation = await reserveUsage(user.id, month, "ai", limit);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: "ai_quota_exhausted", usage: { used: reservation.used, limit, plan: tier } },
      { status: 429 }
    );
  }

  let result;
  let tokens: TokenUsage = EMPTY_USAGE;
  let latencyMs = 0;
  const onUsage = (u: TokenUsage, ms: number) => {
    tokens = u;
    latencyMs = ms;
  };
  try {
    result = await runCoach(apiKey, model, coachReq, reasoningEffort, onUsage);
  } catch (err) {
    await reservation.refund();
    const detail = err instanceof Error ? err.message : "ai_failed";
    await recordLlmCall({
      ...telemetryBase,
      status: "error",
      errorCode: detail,
      usage: tokens,
      latencyMs,
    });
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  await recordLlmCall({ ...telemetryBase, status: "ok", usage: tokens, latencyMs });

  if (coachReq.mode !== "chat") {
    const cacheKey = await coachCacheKey(coachReq);
    try {
      await putCachedResult(cacheKey, result);
    } catch (cacheErr) {
      console.warn("[ai/coach] cache write failed", cacheErr);
    }
  }

  return NextResponse.json({
    result,
    cached: false,
    usage: { used: reservation.used, limit, plan: tier },
  });
}

export const POST = withApiTelemetry("/api/ai/coach", handlePOST);
