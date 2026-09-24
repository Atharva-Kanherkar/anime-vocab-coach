// Whose traffic /owner leaves out by default (#163).
//
// The owner was 45% of all listening and made 495 AI calls. A dashboard that
// counts them is describing the owner, and every pricing decision read off it
// inherits that. So /owner excludes the owner and any test accounts unless
// asked not to (`?all=1`), and always says which it is doing.
//
// The list is:
//   OWNER_EMAILS             the owners (entitlements.ts)
//   OWNER_EXCLUDE_EMAILS     comma-separated test accounts, by email
//   OWNER_EXCLUDE_USER_IDS   comma-separated Clerk ids, for accounts with no
//                            email to match or a lookup that keeps failing
// Emails become Clerk ids with one lookup per page render.

import { clerkClient } from "@clerk/nextjs/server";
import { DEV_NO_CLERK, DEV_PROFILE } from "./dev-auth";
import { OWNER_EMAILS } from "./entitlements";
import type { UserScope } from "./telemetry-query";

/** More than this and a list is a mistake, not a set of test accounts. */
export const MAX_EXCLUDED = 50;

const CLERK_ID = /^user_[A-Za-z0-9]{1,64}$/;
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

export interface Exclusions {
  /** Clerk ids left out of every aggregate. */
  ids: string[];
  /** The emails behind them, where known, for the page to name. */
  emails: string[];
  /** Set when the owner accounts could not be resolved. */
  note?: string;
}

function splitList(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Owner emails plus OWNER_EXCLUDE_EMAILS, lowercased, deduplicated, junk dropped. */
export function excludedEmailList(extra = process.env.OWNER_EXCLUDE_EMAILS): string[] {
  const all = [...OWNER_EMAILS, ...splitList(extra)].map((e) => e.toLowerCase());
  return [...new Set(all.filter((e) => EMAIL.test(e)))].slice(0, MAX_EXCLUDED);
}

/** OWNER_EXCLUDE_USER_IDS, validated as Clerk ids, deduplicated, capped. */
export function excludedIdList(raw = process.env.OWNER_EXCLUDE_USER_IDS): string[] {
  return [...new Set(splitList(raw).filter((id) => CLERK_ID.test(id)))].slice(0, MAX_EXCLUDED);
}

type FindUsers = (emails: string[]) => Promise<{ id: string; email: string | null }[]>;

const clerkFind: FindUsers = async (emails) => {
  const client = await clerkClient();
  const res = await client.users.getUserList({ emailAddress: emails, limit: MAX_EXCLUDED });
  return res.data.map((u) => ({ id: u.id, email: u.primaryEmailAddress?.emailAddress ?? null }));
};

/**
 * Resolve the excluded accounts to ids.
 *
 * A failed lookup keeps the env ids and says so: the page must never quietly
 * go back to counting the owner while claiming it does not.
 */
export async function resolveExclusions(
  find: FindUsers = clerkFind,
  devBypass = DEV_NO_CLERK
): Promise<Exclusions> {
  const envIds = excludedIdList();
  if (devBypass) {
    return { ids: [DEV_PROFILE.id, ...envIds], emails: [DEV_PROFILE.email] };
  }
  const emails = excludedEmailList();
  try {
    const found = emails.length ? await find(emails) : [];
    const ids = [...new Set([...found.map((u) => u.id).filter((id) => CLERK_ID.test(id)), ...envIds])];
    return {
      ids: ids.slice(0, MAX_EXCLUDED),
      emails: found.map((u) => u.email).filter((e): e is string => !!e),
    };
  } catch (err) {
    return {
      ids: envIds,
      emails: [],
      note: `Could not look up the owner accounts (${
        err instanceof Error ? err.message : "unknown error"
      }), so these numbers may include them.`,
    };
  }
}

/** The scope a page render reads with. The drill-down never excludes. */
export function ownerScope(opts: {
  focusUser?: string;
  includeUs: boolean;
  exclusions: Exclusions;
}): UserScope {
  if (opts.focusUser) return opts.focusUser;
  return { exclude: opts.includeUs ? [] : opts.exclusions.ids };
}

/** `?all=1` (or true from the insights request) means include everyone. */
export function includeUsParam(raw: unknown): boolean {
  return raw === true || raw === "1" || raw === "true";
}
