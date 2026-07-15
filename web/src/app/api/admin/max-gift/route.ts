import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isOwnerEmail } from "@/lib/entitlements";
import {
  entitlementToPublicMetadata,
  isPaidSubscription,
  maxGiftEntitlement,
  parseEntitlement,
} from "@/lib/plans";
import { refreshSyncTokenProfile } from "@/lib/sync-store";
import { maxGiftEmailCopy, sendEmail } from "@/lib/email";
import type { CloudUserProfile } from "@/lib/sync";

export const dynamic = "force-dynamic";

type Body = {
  /** If set, only these emails (case-insensitive). */
  emails?: string[];
  /** Required to target every Clerk user — the blast radius must be explicit. */
  all?: boolean;
  /** Preview recipients + skip reasons without sending mail or writing Clerk/KV. */
  dryRun?: boolean;
};

// Keep one invocation well inside the Workers subrequest budget (~4 calls per
// grant) and Resend's ~2 req/s send limit. Granted users are skipped on the
// next run, so re-POSTing the same body continues where the last run stopped.
const MAX_GRANTS_PER_RUN = 50;
const SEND_THROTTLE_MS = 600;

type Candidate = {
  userId: string;
  email: string;
  name: string | null;
  metadata: unknown;
};

function toCandidate(u: {
  id: string;
  primaryEmailAddress?: { emailAddress: string } | null;
  firstName?: string | null;
  username?: string | null;
  publicMetadata?: unknown;
}): Candidate | null {
  const email = u.primaryEmailAddress?.emailAddress;
  if (!email) return null;
  return {
    userId: u.id,
    email,
    name: u.firstName || u.username || null,
    metadata: u.publicMetadata,
  };
}

async function listAllClerkUsers(): Promise<Candidate[]> {
  const client = await clerkClient();
  const out = new Map<string, Candidate>();
  let offset = 0;
  const limit = 100;
  for (;;) {
    const page = await client.users.getUserList({ limit, offset });
    for (const u of page.data) {
      const c = toCandidate(u);
      // Keyed by userId so offset-pagination skew (signups mid-enumeration)
      // can't double-enroll anyone.
      if (c && !out.has(c.userId)) out.set(c.userId, c);
    }
    if (page.data.length < limit) break;
    offset += limit;
  }
  return [...out.values()];
}

async function findUsersByEmails(emails: string[]): Promise<{
  candidates: Candidate[];
  missing: string[];
}> {
  const client = await clerkClient();
  const want = new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const candidates: Candidate[] = [];
  const found = new Set<string>();

  // Clerk supports emailAddress filter (exact). Batch one-by-one for small lists.
  for (const email of want) {
    const page = await client.users.getUserList({ emailAddress: [email], limit: 5 });
    for (const u of page.data) {
      const c = toCandidate(u);
      if (!c) continue;
      const key = c.email.toLowerCase();
      if (!want.has(key) || found.has(key)) continue;
      found.add(key);
      candidates.push(c);
    }
  }

  const missing = [...want].filter((e) => !found.has(e));
  return { candidates, missing };
}

/**
 * Owner-only: grant 3 months of Max to FREE accounts + email them (with a
 * feedback ask). Paid subscribers and already-gifted accounts are skipped, so
 * billing state is never overwritten and a re-run never extends anyone's gift.
 *
 * POST /api/admin/max-gift
 * Body: { emails?: string[], all?: boolean, dryRun?: boolean }
 * Targeting is explicit: pass emails[] OR all:true — anything else is a 400.
 */
export async function POST(req: Request) {
  // Deliberately NOT resolveProfile: that accepts the extension's long-lived
  // sync-token bearer, and a leaked device credential must never be able to
  // mass-rewrite entitlements or mass-email the userbase. Admin = live Clerk
  // session for an owner, nothing else.
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
    // A truncated or malformed request must never fall through to a broader
    // audience than intended — fail loudly instead of open.
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const hasEmails = Array.isArray(body.emails) && body.emails.length > 0;
  if (body.emails !== undefined && !hasEmails) {
    return NextResponse.json({ error: "invalid_emails" }, { status: 400 });
  }
  if (!hasEmails && body.all !== true) {
    return NextResponse.json(
      {
        error: "missing_target",
        hint: "Pass emails: string[] or all: true (blast radius must be explicit).",
      },
      { status: 400 }
    );
  }

  const dryRun = !!body.dryRun;
  const entitlement = maxGiftEntitlement();

  let candidates: Candidate[];
  let missing: string[] = [];
  try {
    if (hasEmails) {
      const found = await findUsersByEmails(body.emails!);
      candidates = found.candidates;
      missing = found.missing;
    } else {
      candidates = await listAllClerkUsers();
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "clerk_list_failed" },
      { status: 502 }
    );
  }

  // Never touch billing state: an active paid sub keeps exactly what it pays
  // for, and a previous gift (active OR expired) is never re-extended.
  const skippedPaid: string[] = [];
  const skippedGifted: string[] = [];
  const eligible: Candidate[] = [];
  for (const c of candidates) {
    const current = parseEntitlement(c.metadata);
    if (isPaidSubscription(current)) skippedPaid.push(c.email);
    else if (current.plan !== "free") skippedGifted.push(c.email);
    else eligible.push(c);
  }

  const batch = eligible.slice(0, MAX_GRANTS_PER_RUN);
  const remaining = eligible.length - batch.length;

  if (dryRun) {
    const copy = maxGiftEmailCopy({ name: null, expiresAt: entitlement.planExpiresAt! });
    return NextResponse.json({
      dryRun: true,
      wouldGrant: batch.length,
      remaining,
      skippedPaid: skippedPaid.length,
      skippedGifted: skippedGifted.length,
      missing,
      sample: batch.slice(0, 5).map((r) => ({ email: r.email, name: r.name })),
      subject: copy.subject,
      expiresAt: entitlement.planExpiresAt,
    });
  }

  const client = await clerkClient();
  const granted: string[] = [];
  const emailed: string[] = [];
  const errors: { email: string; step: string; error: string }[] = [];

  for (const r of batch) {
    try {
      await client.users.updateUserMetadata(r.userId, {
        publicMetadata: entitlementToPublicMetadata(entitlement),
      });
      granted.push(r.email);
    } catch (err) {
      errors.push({
        email: r.email,
        step: "grant",
        error: err instanceof Error ? err.message : "grant_failed",
      });
      continue;
    }

    // Push the new plan onto the user's existing sync token so extension-only
    // users get Max caps immediately — the email says "keep using the app /
    // extension as you are", and the backend meters off the token profile.
    // Best-effort: a KV hiccup here self-heals on the user's next token mint.
    try {
      const profile: CloudUserProfile = {
        id: r.userId,
        email: r.email,
        name: r.name,
        plan: entitlement.plan,
        billingInterval: entitlement.billingInterval,
        planExpiresAt: entitlement.planExpiresAt,
      };
      await refreshSyncTokenProfile(r.userId, profile);
    } catch (err) {
      errors.push({
        email: r.email,
        step: "token_refresh",
        error: err instanceof Error ? err.message : "token_refresh_failed",
      });
    }

    const personalized = maxGiftEmailCopy({
      name: r.name,
      expiresAt: entitlement.planExpiresAt!,
    });
    const send = await sendEmail({
      to: r.email,
      subject: personalized.subject,
      text: personalized.text,
      html: personalized.html,
      idempotencyKey: `max-gift-2026-07/${r.userId}`,
    });
    if (send.error) {
      errors.push({ email: r.email, step: "email", error: send.error });
    } else {
      emailed.push(r.email);
    }

    // Stay under Resend's ~2 req/s send limit.
    await new Promise((resolve) => setTimeout(resolve, SEND_THROTTLE_MS));
  }

  return NextResponse.json({
    granted: granted.length,
    emailed: emailed.length,
    remaining,
    skippedPaid: skippedPaid.length,
    skippedGifted: skippedGifted.length,
    missing,
    errors,
    expiresAt: entitlement.planExpiresAt,
  });
}
