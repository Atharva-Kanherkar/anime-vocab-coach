import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { putSyncToken } from "@/lib/sync-store";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

// Called same-origin by the signed-in /app page (Clerk cookie auth). Mints a
// long-lived bearer token the extension uses to push snapshots in the
// background. The page hands the token to the extension via postMessage.
export async function POST() {
  const user = DEV_NO_CLERK ? null : await currentUser();
  if (!DEV_NO_CLERK && !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        name: user.firstName || user.username || null,
      }
    : { ...DEV_PROFILE };
  const token = "avc_st_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  try {
    await putSyncToken(token, profile);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync_store_unavailable" },
      { status: 503 }
    );
  }

  return NextResponse.json({ token });
}
