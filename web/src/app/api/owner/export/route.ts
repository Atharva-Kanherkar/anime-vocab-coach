import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { exportFilename, loadOwnerExport } from "@/lib/owner-export";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";

async function handleGET() {
  // Same gate as /owner: a 404 for anyone else, so the route is not confirmed.
  if (!DEV_NO_CLERK) {
    const user = await currentUser().catch(() => null);
    if (!isOwnerEmail(user?.primaryEmailAddress?.emailAddress)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  const now = new Date();
  const data = await loadOwnerExport(now);
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(now)}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET = withApiTelemetry("/api/owner/export", handleGET);
