import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getCreation, getPanelImage, putPanelImage } from "@/lib/studio-store";
import { MAX_PANEL_B64_LEN } from "@/lib/studio";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; i: string }> };

function parseIndex(raw: string, panelCount: number): number | null {
  const i = Number(raw);
  return Number.isInteger(i) && i >= 0 && i < panelCount ? i : null;
}

/** Serve one panel PNG. Owner always; anyone if the creation is public. */
export async function GET(req: Request, { params }: Params) {
  const { id, i } = await params;
  const meta = await getCreation(id);
  if (!meta) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const idx = parseIndex(i, meta.panels.length);
  if (idx === null) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!meta.isPublic) {
    const profile = await resolveProfile(req);
    if (!profile || profile.id !== meta.ownerId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  const b64 = await getPanelImage(id, idx);
  if (!b64) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": "image/png",
      "cache-control": meta.isPublic ? "public, max-age=3600" : "private, max-age=300",
    },
  });
}

/** Upload one panel PNG. Owner only. Body: { image: dataURL | base64 } */
export async function PUT(req: Request, { params }: Params) {
  const { id, i } = await params;
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const meta = await getCreation(id);
  if (!meta || meta.ownerId !== profile.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const idx = parseIndex(i, meta.panels.length);
  if (idx === null) return NextResponse.json({ error: "bad_index" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = (body as Record<string, unknown>)?.image;
  if (typeof raw !== "string" || !raw) {
    return NextResponse.json({ error: "no_image" }, { status: 400 });
  }
  const b64 = raw.replace(/^data:image\/\w+;base64,/, "");
  if (b64.length > MAX_PANEL_B64_LEN || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) {
    return NextResponse.json({ error: "bad_image" }, { status: 400 });
  }

  await putPanelImage(id, idx, b64);
  return NextResponse.json({ ok: true });
}
