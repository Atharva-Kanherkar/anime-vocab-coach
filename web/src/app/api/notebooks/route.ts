import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getNotebookStore, putNotebookStore } from "@/lib/notebook-store";
import { clampName, toSummary, MAX_NOTEBOOKS, type Notebook } from "@/lib/notebooks";

export const dynamic = "force-dynamic";

// GET /api/notebooks → list the caller's notebooks (summaries only).
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const store = await getNotebookStore(profile.id);
    return NextResponse.json({ notebooks: store.notebooks.map(toSummary) });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 503 });
  }
}

// POST /api/notebooks { name } → create a notebook, return its summary.
export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const store = await getNotebookStore(profile.id);
    if (store.notebooks.length >= MAX_NOTEBOOKS) {
      return NextResponse.json({ error: "too_many_notebooks" }, { status: 409 });
    }
    const now = new Date().toISOString();
    const notebook: Notebook = {
      id: crypto.randomUUID(),
      name: clampName(body.name),
      createdAt: now,
      updatedAt: now,
      entries: [],
    };
    store.notebooks.unshift(notebook);
    await putNotebookStore(profile.id, store);
    return NextResponse.json({ notebook: toSummary(notebook) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 503 });
  }
}

// Never leak raw internal error text (e.g. KV binding messages) to clients.
function msg(err: unknown): string {
  console.error("[notebooks]", err);
  return "notebook_store_unavailable";
}
