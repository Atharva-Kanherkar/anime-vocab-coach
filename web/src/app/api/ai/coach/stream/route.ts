import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail, OWNER_AI_LIMIT } from "@/lib/entitlements";
import {
  aiLimitForPlan,
  normalizeCoachRequest,
  streamChatCoach,
  type Tier,
} from "@/lib/ai-coach";
import {
  currentMonth,
  getCoachConfig,
  getOpenAiKey,
  getUsage,
  incrementUsage,
} from "@/lib/ai-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const owner = isOwnerEmail(profile.email);
  const user = { id: profile.id, plan: resolvePlan() };

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

  const { model, freeLimit, proLimit } = await getCoachConfig();
  const tier: Tier = user.plan;
  const limit = owner ? OWNER_AI_LIMIT : aiLimitForPlan(user.plan, freeLimit, proLimit);
  const month = currentMonth();

  const used = await getUsage(user.id, month);
  if (used >= limit) {
    return new Response(JSON.stringify({ error: "ai_quota_exhausted" }), { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        let full = "";
        for await (const delta of streamChatCoach(apiKey, model, coachReq)) {
          full += delta;
          send({ delta });
        }
        if (!full.trim()) throw new Error("openai_empty");
        // Usage metering must not fail the reply. KV put limits (or transient
        // write errors) used to stream a good answer then emit {error}, and the
        // extension replaced the bubble with "AI unavailable. Try again."
        try {
          await incrementUsage(user.id, month);
        } catch (meterErr) {
          console.warn("[ai/coach/stream] usage meter write failed", meterErr);
        }
        send({ done: true });
      } catch (err) {
        const detail = err instanceof Error ? err.message : "ai_failed";
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
