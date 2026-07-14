import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail, OWNER_AI_LIMIT } from "@/lib/entitlements";
import { getNotebookStore } from "@/lib/notebook-store";
import { runNotebookSummary } from "@/lib/notebook-ai";
import { currentMonth, getCoachConfig, getOpenAiKey, getUsage, incrementUsage } from "@/lib/ai-store";
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

  // Pro is open to everyone: Pro cap for all, unlimited for owners.
  const { model, freeLimit, proLimit } = await getCoachConfig();
  const plan = resolvePlan();
  const limit = isOwnerEmail(profile.email) ? OWNER_AI_LIMIT : aiLimitForPlan(plan, freeLimit, proLimit);
  const month = currentMonth();
  const used = await getUsage(profile.id, month);
  if (used >= limit) {
    return NextResponse.json({ error: "quota_exceeded", usage: { used, limit } }, { status: 429 });
  }

  let summary;
  try {
    summary = await runNotebookSummary(apiKey, model, notebook);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "summary_failed" },
      { status: 502 }
    );
  }

  // Meter write is its own soft-fail: the paid summary already succeeded, so a
  // KV put-limit rejection must not turn it into a 502. Fall back to used + 1.
  let nowUsed = used + 1;
  try {
    nowUsed = await incrementUsage(profile.id, month);
  } catch (err) {
    console.warn("[notebooks/summary] usage meter write failed", err);
  }
  return NextResponse.json({ summary, usage: { used: nowUsed, limit } });
}
