import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { deleteCreation, getCreation, setCreationPublic } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Full creation meta. Owner always; anyone if the creation is public. */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const meta = await getCreation(id);
  if (!meta) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!meta.isPublic) {
    const profile = await resolveProfile(req);
    if (!profile || profile.id !== meta.ownerId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }
  return NextResponse.json({ creation: meta });
}

/** Toggle sharing. Owner only. Body: { public: boolean } */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const meta = await getCreation(id);
  if (!meta || meta.ownerId !== profile.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const isPublic = !!(body as Record<string, unknown>)?.public;
  const updated = await setCreationPublic(meta, isPublic);
  return NextResponse.json({ creation: updated });
}

/** Delete a creation (meta + image + index row). Owner only. */
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const meta = await getCreation(id);
  if (!meta || meta.ownerId !== profile.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await deleteCreation(meta);
  return NextResponse.json({ ok: true });
}
