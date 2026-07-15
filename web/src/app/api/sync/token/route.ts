import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateSyncToken } from "@/lib/sync-store";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";
import { effectivePlan, parseEntitlement } from "@/lib/plans";
import type { CloudUserProfile } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Called same-origin by the signed-in /app page (Clerk cookie auth). Mints a
// long-lived bearer token the extension uses to push snapshots in the
// background. The page hands the token to the extension via postMessage.
export async function POST() {
  const user = DEV_NO_CLERK ? null : await currentUser();
  if (!DEV_NO_CLERK && !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let profile: CloudUserProfile;
  if (user) {
    // Stamp the tier + gift expiry onto the token profile so the extension +
    // backend can enforce per-tier caps without re-reading Clerk per request.
    const entitlement = parseEntitlement(user.publicMetadata as Record<string, unknown>);
    profile = {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? null,
      name: user.firstName || user.username || null,
      plan: effectivePlan(entitlement),
      billingInterval: entitlement.billingInterval,
      planExpiresAt: entitlement.planExpiresAt,
    };
  } else {
    profile = {
      ...DEV_PROFILE,
      plan: "free",
      billingInterval: null,
      planExpiresAt: null,
    };
  }

  // Idempotent per user with a TTL — repeated mints from one page load reuse the
  // same token instead of minting a fresh KV-backed credential each time.
  let token: string;
  try {
    token = await getOrCreateSyncToken(profile.id, profile);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync_store_unavailable" },
      { status: 503 }
    );
  }

  // Profile rides along so the extension popup can show who is linked
  // ("Synced as <email>") instead of leaving the account state invisible.
  return NextResponse.json({
    token,
    profile: { email: profile.email, name: profile.name, plan: profile.plan },
  });
}
