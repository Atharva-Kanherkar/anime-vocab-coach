import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getCreation, getCreationImage } from "@/lib/word-manga-store";

export const dynamic = "force-dynamic";

/** Serve the generated page PNG. Owner always; anyone if public (so shared
 * /m/<id> pages and their og:image work signed-out). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = await getCreation(id);
  if (!meta) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!meta.isPublic) {
    const profile = await resolveProfile(req);
    if (!profile || profile.id !== meta.ownerId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  const b64 = await getCreationImage(id);
  if (!b64) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": "image/png",
      "cache-control": meta.isPublic ? "public, max-age=3600" : "private, max-age=300",
    },
  });
}
