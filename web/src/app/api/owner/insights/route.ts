import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { loadOwnerDashboard, resolveWindow } from "@/lib/owner-dashboard";
import { loadOwnerHistory } from "@/lib/owner-history";
import { buildInsightsDigest, runOwnerInsights } from "@/lib/owner-insights";
import { getCoachConfig, getOpenAiKey } from "@/lib/ai-store";
import { EMPTY_USAGE, type TokenUsage } from "@/lib/llm-pricing";
import { recordLlmCall, requestFacts, surfaceOf } from "@/lib/telemetry";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";

async function handlePOST(req: Request) {
  // Same gate as the /owner page itself, including the notFound()-shaped
  // response: a stranger probing this route should see the same "does not
  // exist" a stranger probing /owner sees, not a 401 that confirms it's real.
  let ownerId: string = DEV_PROFILE.id;
  if (!DEV_NO_CLERK) {
    const user = await currentUser().catch(() => null);
    if (!isOwnerEmail(user?.primaryEmailAddress?.emailAddress)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    ownerId = user!.id;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { hours: rawHours, user: rawUser } = (body ?? {}) as { hours?: unknown; user?: unknown };
  const win = resolveWindow(rawHours === undefined || rawHours === null ? undefined : String(rawHours));
  const focusUser = typeof rawUser === "string" && rawUser.trim() ? rawUser.trim() : undefined;

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  // Reload rather than trust a client-sent snapshot: this reproduces exactly
  // what the page itself would render for this window/user, from the same
  // function, so "insights on what I can see" is literally true rather than
  // a client-serialized copy that could drift or be tampered with.
  const [data, history] = await Promise.all([
    loadOwnerDashboard(win.hours, focusUser),
    focusUser ? Promise.resolve(null) : loadOwnerHistory(),
  ]);

  if (!data.configured) {
    return NextResponse.json({ error: "analytics_not_configured" }, { status: 503 });
  }

  const digest = buildInsightsDigest(win, data, history, focusUser);
  const { model } = await getCoachConfig();
  const facts = requestFacts(req);

  let tokens: TokenUsage = EMPTY_USAGE;
  let latencyMs = 0;
  const onUsage = (u: TokenUsage, ms: number) => {
    tokens = u;
    latencyMs = ms;
  };
  const telemetryBase = {
    model,
    operation: "owner_insights",
    userId: ownerId,
    plan: "owner",
    surface: surfaceOf(req),
    country: facts.country,
  };

  try {
    const insights = await runOwnerInsights(apiKey, model, digest, onUsage);
    await recordLlmCall({ ...telemetryBase, status: "ok", usage: tokens, latencyMs });
    return NextResponse.json({ insights, window: win.label });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "ai_failed";
    await recordLlmCall({ ...telemetryBase, status: "error", errorCode: detail, usage: tokens, latencyMs });
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}

export const POST = withApiTelemetry("/api/owner/insights", handlePOST);
