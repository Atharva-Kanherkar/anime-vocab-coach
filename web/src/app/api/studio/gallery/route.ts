import { NextResponse } from "next/server";
import { listGallery } from "@/lib/studio-store";

export const dynamic = "force-dynamic";

/** The global public gallery — every learner's published manga. No auth, ever. */
export async function GET() {
  const entries = await listGallery();
  return NextResponse.json(
    { entries },
    { headers: { "cache-control": "public, max-age=60" } }
  );
}
