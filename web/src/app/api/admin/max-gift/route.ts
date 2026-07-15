import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { putUserEntitlement } from "@/lib/entitlement-store";
import {
  entitlementToPublicMetadata,
  maxGiftEntitlement,
} from "@/lib/plans";
import { maxGiftEmailCopy, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type Body = {
  /** If set, only these emails (case-insensitive). Otherwise all Clerk users. */
  emails?: string[];
  /** Grant + return preview counts without sending mail or writing Clerk/KV. */
  dryRun?: boolean;
};

type Recipient = {
  userId: string;
  email: string;
  name: string | null;
};

async function listAllClerkUsers(): Promise<Recipient[]> {
  const client = await clerkClient();
  const out: Recipient[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const page = await client.users.getUserList({ limit, offset });
    for (const u of page.data) {
      const email = u.primaryEmailAddress?.emailAddress;
      if (!email) continue;
      out.push({
        userId: u.id,
        email,
        name: u.firstName || u.username || null,
      });
    }
    if (page.data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function findUsersByEmails(emails: string[]): Promise<{
  recipients: Recipient[];
  missing: string[];
}> {
  const client = await clerkClient();
  const want = new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const recipients: Recipient[] = [];
  const found = new Set<string>();

  // Clerk supports emailAddress filter (exact). Batch one-by-one for small lists.
  for (const email of want) {
    const page = await client.users.getUserList({ emailAddress: [email], limit: 5 });
    for (const u of page.data) {
      const primary = u.primaryEmailAddress?.emailAddress;
      if (!primary) continue;
      const key = primary.toLowerCase();
      if (!want.has(key) || found.has(key)) continue;
      found.add(key);
      recipients.push({
        userId: u.id,
        email: primary,
        name: u.firstName || u.username || null,
      });
    }
  }

  const missing = [...want].filter((e) => !found.has(e));
  return { recipients, missing };
}

/**
 * Owner-only: grant 3 months of Max + email users (with a feedback ask).
 *
 * POST /api/admin/max-gift
 * Body: { emails?: string[], dryRun?: boolean }
 */
export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!isOwnerEmail(profile?.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const dryRun = !!body.dryRun;
  const entitlement = maxGiftEntitlement();
  const copy = maxGiftEmailCopy({ name: null, expiresAt: entitlement.planExpiresAt! });

  let recipients: Recipient[];
  let missing: string[] = [];
  try {
    if (Array.isArray(body.emails) && body.emails.length > 0) {
      const found = await findUsersByEmails(body.emails);
      recipients = found.recipients;
      missing = found.missing;
    } else {
      recipients = await listAllClerkUsers();
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "clerk_list_failed" },
      { status: 502 }
    );
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldGrant: recipients.length,
      wouldEmail: recipients.length,
      missing,
      sample: recipients.slice(0, 5).map((r) => ({ email: r.email, name: r.name })),
      subject: copy.subject,
      expiresAt: entitlement.planExpiresAt,
    });
  }

  const client = await clerkClient();
  const granted: string[] = [];
  const emailed: string[] = [];
  const errors: { email: string; step: string; error: string }[] = [];

  for (const r of recipients) {
    try {
      await client.users.updateUserMetadata(r.userId, {
        publicMetadata: entitlementToPublicMetadata(entitlement),
      });
      await putUserEntitlement(r.userId, entitlement);
      granted.push(r.email);
    } catch (err) {
      errors.push({
        email: r.email,
        step: "grant",
        error: err instanceof Error ? err.message : "grant_failed",
      });
      continue;
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
  }

  return NextResponse.json({
    granted: granted.length,
    emailed: emailed.length,
    missing,
    errors,
    expiresAt: entitlement.planExpiresAt,
  });
}
