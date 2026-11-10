import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { currentMonth, getCoachConfig, getOpenAiKey, quotaFor, reserveUsage } from "@/lib/ai-store";
import { normalizeQuizRequest, runEpisodeQuiz } from "@/lib/episode-quiz";
import { EMPTY_USAGE, type TokenUsage } from "@/lib/llm-pricing";
import { recordLlmCall, requestFacts, surfaceOf } from "@/lib/telemetry";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";

/**
 * The end-of-episode quiz. "generate" is open to every plan: it is new value,
 * and the free tier keeps it. "haru" (Haru judging the learner's sentence) is
 * the Pro/Max layer. Both spend one call of the learner's AI allowance, since
 * the learner asked for them.
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
  const normalized = normalizeQuizRequest(body);
  if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
  const quizReq = normalized.req;

  if (quizReq.mode === "haru" && plan === "free" && !owner) {
    return NextResponse.json({ error: "pro_required" }, { status: 403 });
  }

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const { model, reasoningEffort } = await getCoachConfig();
  const limit = await quotaFor(plan, "ai", owner);
  const month = currentMonth();
  const facts = requestFacts(req);
  const telemetryBase = {
    model,
    operation: quizReq.mode === "generate" ? "episode_quiz" : "episode_quiz_haru",
    userId: profile.id,
    plan: owner ? "owner" : plan,
    effort: reasoningEffort,
    country: facts.country,
    surface: surfaceOf(req),
    direction: quizReq.direction,
  };

  const reservation = await reserveUsage(profile.id, month, "ai", limit);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: "ai_quota_exhausted", usage: { used: reservation.used, limit, plan } },
      { status: 429 }
    );
  }

  let tokens: TokenUsage = EMPTY_USAGE;
  let latencyMs = 0;
  try {
    const result = await runEpisodeQuiz(apiKey, model, quizReq, reasoningEffort, (u, ms) => {
      tokens = u;
      latencyMs = ms;
    });
    await recordLlmCall({ ...telemetryBase, status: "ok", usage: tokens, latencyMs });
    return NextResponse.json({ ...result, plan: owner ? "max" : plan, usage: { used: reservation.used, limit, plan } });
  } catch (err) {
    await reservation.refund();
    const detail = err instanceof Error ? err.message : "ai_failed";
    await recordLlmCall({ ...telemetryBase, status: "error", errorCode: detail, usage: tokens, latencyMs });
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}

export const POST = withApiTelemetry("/api/ai/episode-quiz", handlePOST);
