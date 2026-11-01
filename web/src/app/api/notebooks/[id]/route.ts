import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getNotebookStore } from "@/lib/notebook-store";
import { getLearnStore } from "@/lib/learn-server";
import { LearnError } from "@/lib/learn-store";
import { newLearnOp, type LearnOp } from "../../../../lib/learn-protocol/model";
import {
  clampName,
  entryHasContent,
  makeEntry,
  MAX_ENTRIES_PER_NOTEBOOK,
  type Notebook,
  type NotebookStoreData,
} from "@/lib/notebooks";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function find(store: NotebookStoreData, id: string): Notebook | undefined {
  return store.notebooks.find((n) => n.id === id);
}

// GET /api/notebooks/[id] → full notebook (entries included).
export async function GET(req: Request, { params }: Params) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const store = await getNotebookStore(profile.id);
    const notebook = find(store, id);
    if (!notebook) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ notebook });
  } catch (err) {
    return fail(err);
  }
}

// PATCH /api/notebooks/[id] — one op per call:
//   { op: "rename", name }
//   { op: "addEntry", entry: {...} }
//   { op: "removeEntry", entryId }
export async function PATCH(req: Request, { params }: Params) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const store = await getNotebookStore(profile.id);
    const notebook = find(store, id);
    if (!notebook) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let op: LearnOp;
    switch (body.op) {
      case "rename":
        notebook.name = clampName(body.name);
        op = newLearnOp("notebook",{notebook:{...notebook,entries:[]}});
        break;
      case "addEntry": {
        if (notebook.entries.length >= MAX_ENTRIES_PER_NOTEBOOK) {
          return NextResponse.json({ error: "notebook_full" }, { status: 409 });
        }
        const entry = makeEntry(body.entry, crypto.randomUUID(), new Date().toISOString());
        if (!entryHasContent(entry)) {
          return NextResponse.json({ error: "empty_entry" }, { status: 400 });
        }
        op = newLearnOp("notebook_item",{id,entry});
        break;
      }
      case "removeEntry": {
        const before = notebook.entries.length;
        notebook.entries = notebook.entries.filter((e) => e.id !== body.entryId);
        if (notebook.entries.length === before) {
          return NextResponse.json({ error: "entry_not_found" }, { status: 404 });
        }
        op = newLearnOp("notebook_item_delete",{id,entryId:body.entryId});
        break;
      }
      default:
        return NextResponse.json({ error: "invalid_op" }, { status: 400 });
    }

    notebook.updatedAt = new Date().toISOString();
    await (await getLearnStore(profile.id)).apply([op]);
    const fresh = await getNotebookStore(profile.id);
    return NextResponse.json({ notebook:find(fresh,id) });
  } catch (err) {
    return fail(err);
  }
}

// DELETE /api/notebooks/[id]
export async function DELETE(req: Request, { params }: Params) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const store = await getNotebookStore(profile.id);
    const before = store.notebooks.length;
    store.notebooks = store.notebooks.filter((n) => n.id !== id);
    if (store.notebooks.length === before) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await (await getLearnStore(profile.id)).apply([newLearnOp("notebook_delete",{id})]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

// Rejections keep their status; only unexpected failures read as unavailable.
function fail(err: unknown) {
  if (err instanceof LearnError && err.status < 500)
    return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof Error && /^invalid_/.test(err.message))
    return NextResponse.json({ error: err.message }, { status: 400 });
  return NextResponse.json({ error: msg(err) }, { status: 503 });
}

// Never leak raw internal error text (e.g. KV binding messages) to clients.
function msg(err: unknown): string {
  console.error("[notebooks]", err);
  return "notebook_store_unavailable";
}
