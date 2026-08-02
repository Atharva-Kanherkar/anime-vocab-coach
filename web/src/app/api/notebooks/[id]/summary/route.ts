import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail, OWNER_AI_LIMIT } from "@/lib/entitlements";
import { getNotebookStore } from "@/lib/notebook-store";
import { runNotebookSummary } from "@/lib/notebook-ai";
import { currentMonth, getCoachConfig, getOpenAiKey, reserveUsage } from "@/lib/ai-store";
import { aiLimitForPlan } from "@/lib/ai-coach";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/notebooks/[id]/summary → AI weak-spots + review prompts.
// Metered against the same monthly AI budget as the coach.
export async function POST(req: Request, { params }: Params) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const store = await getNotebookStore(profile.id).catch(() => null);
  if (!store) return NextResponse.json({ error: "notebook_store_unavailable" }, { status: 503 });
  const notebook = store.notebooks.find((n) => n.id === id);
  if (!notebook) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!notebook.entries.length) return NextResponse.json({ error: "empty_notebook" }, { status: 400 });

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  // AI cap is per tier (free/pro/max); owners are effectively unlimited.
  const { model, freeLimit, proLimit, maxLimit } = await getCoachConfig();
  const plan = resolvePlan(profile);
  const limit = isOwnerEmail(profile.email) ? OWNER_AI_LIMIT : aiLimitForPlan(plan, freeLimit, proLimit, maxLimit);
  const month = currentMonth();
  // Claim the slot before paying for the summary; hand it back if the provider
  // never produced one.
  const reservation = await reserveUsage(profile.id, month, "ai", limit);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: "quota_exceeded", usage: { used: reservation.used, limit } },
      { status: 429 }
    );
  }

  let summary;
  try {
    summary = await runNotebookSummary(apiKey, model, notebook);
  } catch (err) {
    await reservation.refund();
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "summary_failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ summary, usage: { used: reservation.used, limit } });
}
