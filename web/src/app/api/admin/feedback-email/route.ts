import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isOwnerEmail } from "@/lib/entitlements";
import {
  FEEDBACK_CAMPAIGN,
  bulkMailHeaders,
  feedbackEmailCopy,
  sendEmailBatch,
} from "@/lib/email";

export const dynamic = "force-dynamic";

type Body = {
  /** If set, only these addresses (case-insensitive). */
  emails?: string[];
  /** Required to target every Clerk user — the blast radius must be explicit. */
  all?: boolean;
  /** Addresses to skip (case-insensitive), even when `all` is set. */
  exclude?: string[];
  /** Preview the recipient list and the copy without sending anything. */
  dryRun?: boolean;
};

type Recipient = { userId: string; email: string; name: string | null };

/** Addresses that look like throwaway signups. Reported, never auto-skipped:
 * whether they are worth mailing is a judgement call for the sender. */
const DISPOSABLE_HINTS = [
  "einrot.com",
  "throwaway",
  "mailinator",
  "guerrillamail",
  "tempmail",
  "10minutemail",
];

function toRecipient(u: {
  id: string;
  primaryEmailAddress?: { emailAddress: string } | null;
  firstName?: string | null;
  username?: string | null;
}): Recipient | null {
  const email = u.primaryEmailAddress?.emailAddress?.trim();
  if (!email) return null;
  return { userId: u.id, email, name: u.firstName || u.username || null };
}

async function listAllClerkUsers(): Promise<Recipient[]> {
  const client = await clerkClient();
  const out = new Map<string, Recipient>();
  let offset = 0;
  const limit = 100;
  for (;;) {
    const page = await client.users.getUserList({ limit, offset });
    for (const u of page.data) {
      const r = toRecipient(u);
      // Keyed by userId so offset-pagination skew (signups mid-enumeration)
      // cannot double-enroll anyone.
      if (r && !out.has(r.userId)) out.set(r.userId, r);
    }
    if (page.data.length < limit) break;
    offset += limit;
  }
  return [...out.values()];
}

async function findUsersByEmails(
  emails: string[]
): Promise<{ recipients: Recipient[]; missing: string[] }> {
  const client = await clerkClient();
  const want = new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const recipients: Recipient[] = [];
  const found = new Set<string>();

  for (const email of want) {
    const page = await client.users.getUserList({ emailAddress: [email], limit: 5 });
    for (const u of page.data) {
      const r = toRecipient(u);
      if (!r) continue;
      const key = r.email.toLowerCase();
      if (!want.has(key) || found.has(key)) continue;
      found.add(key);
      recipients.push(r);
    }
  }

  return { recipients, missing: [...want].filter((e) => !found.has(e)) };
}

/**
 * Owner-only: email existing accounts asking what they think of the app.
 *
 * Recipients come from Clerk rather than a pasted list, so the send cannot
 * contain a transcription typo and cannot miss users past the first dashboard
 * page. Delivery goes through Resend's batch endpoint (one request per 100
 * recipients) with permissive validation, so one malformed address cannot sink
 * the rest of the batch.
 *
 * POST /api/admin/feedback-email
 * Body: { emails?: string[], all?: boolean, exclude?: string[], dryRun?: boolean }
 * Targeting is explicit: pass emails[] OR all:true, anything else is a 400.
 */
export async function POST(req: Request) {
  // Deliberately NOT resolveProfile: that accepts the extension's long-lived
  // sync-token bearer, and a leaked device credential must never be able to
  // mass-email the userbase. Admin means a live Clerk session for an owner.
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
    // A malformed request must never fall through to a broader audience than
    // intended: fail loudly rather than open.
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

  let candidates: Recipient[];
  let missing: string[] = [];
  try {
    if (hasEmails) {
      const found = await findUsersByEmails(body.emails!);
      candidates = found.recipients;
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

  const excludeSet = new Set(
    (body.exclude ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
  const excluded: string[] = [];
  const recipients: Recipient[] = [];
  const seen = new Set<string>();
  for (const r of candidates) {
    const key = r.email.toLowerCase();
    if (excludeSet.has(key)) {
      excluded.push(r.email);
      continue;
    }
    // Two Clerk accounts can share an address; never mail it twice.
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(r);
  }

  const flagged = recipients
    .filter((r) => DISPOSABLE_HINTS.some((h) => r.email.toLowerCase().includes(h)))
    .map((r) => r.email);

  if (body.dryRun) {
    const preview = feedbackEmailCopy({ name: recipients[0]?.name ?? null });
    return NextResponse.json({
      dryRun: true,
      wouldEmail: recipients.length,
      recipients: recipients.map((r) => r.email),
      excluded,
      looksDisposable: flagged,
      missing,
      subject: preview.subject,
      textPreview: preview.text,
    });
  }

  const headers = bulkMailHeaders();
  const payload = recipients.map((r) => {
    const copy = feedbackEmailCopy({ name: r.name });
    return { to: r.email, subject: copy.subject, text: copy.text, html: copy.html, headers };
  });

  // Campaign-scoped idempotency: re-POSTing the same wave inside Resend's 24h
  // window is a no-op rather than a second copy in everyone's inbox.
  const results = await sendEmailBatch(payload, { idempotencyKeyPrefix: FEEDBACK_CAMPAIGN });
  const failures = results.filter((r) => r.error);

  return NextResponse.json({
    campaign: FEEDBACK_CAMPAIGN,
    emailed: results.length - failures.length,
    failed: failures.length,
    errors: failures.map((f) => ({ email: f.to, error: f.error })),
    excluded,
    looksDisposable: flagged,
    missing,
  });
}
