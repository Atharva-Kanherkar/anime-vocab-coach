import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail, OWNER_AI_LIMIT } from "@/lib/entitlements";
import {
  aiLimitForPlan,
  normalizeCoachRequest,
  streamChatCoach,
  type Tier,
} from "@/lib/ai-coach";
import { currentMonth, getCoachConfig, getOpenAiKey, reserveUsage } from "@/lib/ai-store";
import { EMPTY_USAGE, type TokenUsage } from "@/lib/llm-pricing";
import { recordLlmCall, requestFacts, surfaceOf } from "@/lib/telemetry";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handlePOST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const owner = isOwnerEmail(profile.email);
  const user = { id: profile.id, plan: resolvePlan(profile) };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const normalized = normalizeCoachRequest(body);
  if ("error" in normalized) {
    return new Response(JSON.stringify({ error: normalized.error }), { status: 400 });
  }
  const { req: coachReq } = normalized;
  if (coachReq.mode !== "chat") {
    return new Response(JSON.stringify({ error: "stream_chat_only" }), { status: 400 });
  }

  const apiKey = await getOpenAiKey();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ai_not_configured" }), { status: 503 });
  }

  const { model, reasoningEffort, freeLimit, proLimit, maxLimit } = await getCoachConfig();
  const tier: Tier = user.plan;
  const limit = owner ? OWNER_AI_LIMIT : aiLimitForPlan(user.plan, freeLimit, proLimit, maxLimit);
  const month = currentMonth();

  // Reserve up front, same as the non-streaming route, and give the call back
  // if the stream produces nothing.
  const reservation = await reserveUsage(user.id, month, "ai", limit);
  if (!reservation.ok) {
    // Same shape as the non-streaming coach route: the client shouldn't have to
    // special-case which endpoint refused it to know where the learner stands.
    return new Response(
      JSON.stringify({
        error: "ai_quota_exhausted",
        usage: { used: reservation.used, limit, plan: tier },
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const facts = requestFacts(req);
  const telemetryBase = {
    model,
    operation: "chat_stream",
    userId: user.id,
    plan: owner ? "owner" : tier,
    effort: reasoningEffort,
    country: facts.country,
    surface: surfaceOf(req),
    direction: coachReq.direction,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      let streamed = false;
      let tokens: TokenUsage = EMPTY_USAGE;
      let latencyMs = 0;
      const onUsage = (u: TokenUsage, ms: number) => {
        tokens = u;
        latencyMs = ms;
      };
      try {
        let full = "";
        for await (const delta of streamChatCoach(
          apiKey,
          model,
          coachReq,
          reasoningEffort,
          onUsage
        )) {
          full += delta;
          if (delta) streamed = true;
          send({ delta });
        }
        if (!full.trim()) throw new Error("openai_empty");
        send({ done: true });
        await recordLlmCall({ ...telemetryBase, status: "ok", usage: tokens, latencyMs });
      } catch (err) {
        // Nothing usable came back, so the learner shouldn't be charged. If
        // tokens DID stream before the failure the call really happened, so the
        // reservation stands — the client keeps the partial answer either way.
        if (!streamed) await reservation.refund();
        const detail = err instanceof Error ? err.message : "ai_failed";
        // Tokens generated before the failure are still billed by OpenAI, so
        // they are recorded against the error rather than dropped.
        await recordLlmCall({
          ...telemetryBase,
          status: "error",
          errorCode: detail,
          usage: tokens,
          latencyMs,
        });
        send({ error: detail });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export const POST = withApiTelemetry("/api/ai/coach/stream", handlePOST);
