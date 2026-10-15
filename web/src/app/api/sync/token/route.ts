import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateSyncToken, getSyncTokenProfile } from "@/lib/sync-store";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";
import { effectivePlan, parseEntitlement } from "@/lib/plans";
import type { CloudUserProfile } from "@/lib/sync";

export const dynamic = "force-dynamic";

/** The signed-in browser's profile from its Clerk cookie, or null when signed
 * out. Stamps the tier + gift expiry so the extension and backend can enforce
 * per-tier caps without re-reading Clerk per request. */
async function sessionProfile(): Promise<CloudUserProfile | null> {
  if (DEV_NO_CLERK) {
    return { ...DEV_PROFILE, plan: "free", billingInterval: null, planExpiresAt: null };
  }
  const user = await currentUser();
  if (!user) return null;
  const entitlement = parseEntitlement(user.publicMetadata as Record<string, unknown>);
  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    name: user.firstName || user.username || null,
    plan: effectivePlan(entitlement),
    billingInterval: entitlement.billingInterval,
    planExpiresAt: entitlement.planExpiresAt,
  };
}

// Called same-origin by the signed-in /app page (Clerk cookie auth). Mints a
// long-lived bearer token the extension uses to push snapshots in the
// background. The page hands the token to the extension via postMessage.
export async function POST() {
  const profile = await sessionProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

// Called by the extension's background worker (cookie + bearer) before it
// trusts a token handed over by the page. Any script on animevocab.com can
// postMessage the bridge, so a token arriving that way proves nothing on its
// own: a planted token would link the extension to someone else's account and
// stream this learner's words there. The browser's own session cookie is what
// a page script cannot forge, so the token is accepted only when it belongs to
// the account that cookie is signed in as.
export async function GET(req: Request) {
  const match = (req.headers.get("authorization") || "").match(/^Bearer\s+(avc_st_[A-Za-z0-9]+)$/);
  if (!match) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const profile = await sessionProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let tokenProfile: CloudUserProfile | null;
  try {
    tokenProfile = await getSyncTokenProfile(match[1]);
  } catch {
    return NextResponse.json({ error: "sync_store_unavailable" }, { status: 503 });
  }
  if (!tokenProfile || tokenProfile.id !== profile.id) {
    return NextResponse.json({ error: "token_mismatch" }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    profile: { email: profile.email, name: profile.name, plan: profile.plan },
  });
}
