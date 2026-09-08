import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isOwnerEmail } from "@/lib/entitlements";
import {
  entitlementToPublicMetadata,
  giftEntitlement,
  isPaidSubscription,
  isPlanId,
  parseEntitlement,
} from "@/lib/plans";
import { refreshSyncTokenProfile } from "@/lib/sync-store";
import type { CloudUserProfile } from "@/lib/sync";

export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  plan?: string;
  months?: number;
  dryRun?: boolean;
};

/**
 * Owner-only: gift ONE named account a paid plan for a fixed number of
 * months (e.g. the 6-month Pro reward for replying to the feedback email).
 * Deliberately single-target and requires every field explicitly, unlike
 * max-gift's `all: true` blast — a one-off reward must never be able to
 * widen into a mass grant because a field was left out.
 *
 * POST /api/admin/grant-plan
 * Body: { email: string, plan: "pro" | "max", months: number, dryRun?: boolean }
 */
export async function POST(req: Request) {
  // Deliberately NOT resolveProfile: that accepts the extension's long-lived
  // sync-token bearer, and a leaked device credential must never be able to
  // grant itself (or anyone) a paid plan. Admin means a live Clerk session
  // for an owner, nothing else.
  let owner: Awaited<ReturnType<typeof currentUser>> = null;
  try {
    owner = await currentUser();
  } catch {
    owner = null;
  }
  if (!isOwnerEmail(owner?.primaryEmailAddress?.emailAddress)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }
  if (!isPlanId(body.plan) || body.plan === "free") {
    return NextResponse.json(
      { error: "invalid_plan", hint: 'plan must be "pro" or "max"' },
      { status: 400 }
    );
  }
  if (typeof body.months !== "number" || !Number.isFinite(body.months) || body.months <= 0) {
    return NextResponse.json({ error: "invalid_months" }, { status: 400 });
  }

  const client = await clerkClient();
  const page = await client.users.getUserList({ emailAddress: [email], limit: 5 });
  const match = page.data.find(
    (u) => u.primaryEmailAddress?.emailAddress?.trim().toLowerCase() === email
  );
  if (!match) {
    return NextResponse.json({ error: "user_not_found", email }, { status: 404 });
  }

  // Never overwrite an active paid subscription with a gift.
  const current = parseEntitlement(match.publicMetadata);
  if (isPaidSubscription(current)) {
    return NextResponse.json({ error: "already_paid_subscriber", email, current }, { status: 409 });
  }

  const entitlement = giftEntitlement(body.plan, body.months);
  const name = match.firstName || match.username || null;

  if (body.dryRun) {
    return NextResponse.json({ dryRun: true, email, name, current, wouldGrant: entitlement });
  }

  await client.users.updateUserMetadata(match.id, {
    publicMetadata: entitlementToPublicMetadata(entitlement),
  });

  // Push the new plan onto the user's existing sync token so extension-only
  // usage gets the gift immediately. Best-effort: a KV hiccup here self-heals
  // on the user's next token mint.
  try {
    const profile: CloudUserProfile = {
      id: match.id,
      email,
      name,
      plan: entitlement.plan,
      billingInterval: entitlement.billingInterval,
      planExpiresAt: entitlement.planExpiresAt,
    };
    await refreshSyncTokenProfile(match.id, profile);
  } catch {
    // Self-heals on next token mint.
  }

  return NextResponse.json({ email, name, granted: entitlement });
}
