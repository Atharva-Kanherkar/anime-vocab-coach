// All-time observability for /owner, from sources that predate Analytics Engine.
//
// WHY THIS FILE EXISTS. The AE datasets began on 2026-08-06, when the dashboard
// shipped. AE also has a retention horizon. That makes every AE-only panel a
// window, not a history, and reading one as a history produces confidently
// wrong conclusions: an August-only read of this product showed 15 users and
// ~7% retention, when Clerk held 30+ signups and KV held a whole July cohort
// that AE had never seen. Three of those users had 6 or 7 active days.
//
// Two durable sources survive the AE horizon:
//
//   Clerk  — every signup ever, with createdAt and lastActiveAt. This is the
//            authoritative user count and the only source of a real cohort
//            curve.
//   KV     — `use:<userId>:<month>` holds Listening Mode minutes per user per
//            month and is written by the avc-api Worker. It is the only record
//            of transcription usage before avc_transcribe existed, and it goes
//            back further than AE does.
//
// Everything here is best-effort. A history panel that throws takes down the
// live panels next to it, which is a bad trade for a nice-to-have.

import { clerkClient } from "@clerk/nextjs/server";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

/**
 * KV list page size. `use:` and `synctoken:user:` are both small (one key per
 * user, or per user-month), so a single page covers them today with room to
 * spare. The cursor loop below is still bounded: an unbounded list over a
 * namespace that also holds ~15k sync-token keys is how a dashboard render
 * turns into a timeout.
 */
const KV_PAGE = 1000;
const KV_MAX_PAGES = 4;

export interface MonthlyListening {
  /** `YYYY-MM`. */
  month: string;
  users: number;
  minutes: number;
}

export interface ListeningUserTotal {
  userId: string;
  minutes: number;
  months: number;
  email?: string;
}

export interface SignupPoint {
  /** `YYYY-MM`. */
  month: string;
  signups: number;
}

export interface OwnerHistory {
  /** False when neither Clerk nor KV could be reached; the panel says so. */
  available: boolean;
  notes: string[];

  // ---- Clerk (all time) ----
  totalUsers: number | null;
  signupsByMonth: SignupPoint[];
  /** Users whose lastActiveAt is within 30 days of now. */
  activeLast30: number | null;
  /** Users who have never been active since signing up. */
  neverActive: number | null;
  usersByPlan: { label: string; value: number }[];

  // ---- KV (all time, pre-AE) ----
  listeningByMonth: MonthlyListening[];
  topListeners: ListeningUserTotal[];
  totalListeningMinutes: number;
  /** Users holding a live extension link (`synctoken:user:*`, 30d sliding TTL). */
  linkedUsers: number | null;

  /** Signups that got as far as linking the extension, 0..1. */
  activationRate: number | null;
  /** True when a KV listing hit the page cap, so counts are lower bounds. */
  truncated: boolean;
}

export const EMPTY_HISTORY: OwnerHistory = {
  available: false,
  notes: [],
  totalUsers: null,
  signupsByMonth: [],
  activeLast30: null,
  neverActive: null,
  usersByPlan: [],
  listeningByMonth: [],
  topListeners: [],
  totalListeningMinutes: 0,
  linkedUsers: null,
  activationRate: null,
  truncated: false,
};

/** The KV namespace shared by the web and avc-api Workers. */
interface KvLike {
  list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
  get(key: string): Promise<string | null>;
}

async function syncKv(): Promise<KvLike | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = (await getCloudflareContext({ async: true })) as {
      env: { AVC_SYNC_KV?: KvLike };
    };
    return env.AVC_SYNC_KV ?? null;
  } catch {
    return null;
  }
}

/** List one prefix, bounded. Returns the names plus whether we stopped early. */
async function listPrefix(
  kv: KvLike,
  prefix: string
): Promise<{ names: string[]; truncated: boolean }> {
  const names: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < KV_MAX_PAGES; page++) {
    const res = await kv.list({ prefix, limit: KV_PAGE, cursor });
    names.push(...res.keys.map((k) => k.name));
    if (res.list_complete) return { names, truncated: false };
    cursor = res.cursor;
  }
  // Never report a capped listing as a complete count.
  return { names, truncated: true };
}

const MONTH_RE = /^use:(user_[A-Za-z0-9]+):(\d{4}-\d{2})$/;

/**
 * Listening Mode history from KV.
 *
 * Values are fractional minutes written by backend/src/usage.ts. Keys carry a
 * 40-day TTL, so this is "recent history" rather than all of time; it still
 * reaches a month or two further back than AE does, which is the point.
 */
async function loadListening(kv: KvLike): Promise<{
  byMonth: MonthlyListening[];
  top: ListeningUserTotal[];
  total: number;
  truncated: boolean;
}> {
  const { names, truncated } = await listPrefix(kv, "use:");

  const months = new Map<string, { users: Set<string>; minutes: number }>();
  const users = new Map<string, { minutes: number; months: Set<string> }>();
  let total = 0;

  // Reads are sequential-ish in small batches: one KV get per key is fine at
  // this scale (tens of keys) and avoids a burst against the namespace.
  for (const name of names) {
    const m = MONTH_RE.exec(name);
    if (!m) continue;
    const [, userId, month] = m as unknown as [string, string, string];
    const raw = await kv.get(name);
    const minutes = Number.parseFloat(raw || "0");
    if (!Number.isFinite(minutes) || minutes <= 0) continue;

    total += minutes;
    const mo = months.get(month) ?? { users: new Set<string>(), minutes: 0 };
    mo.users.add(userId);
    mo.minutes += minutes;
    months.set(month, mo);

    const u = users.get(userId) ?? { minutes: 0, months: new Set<string>() };
    u.minutes += minutes;
    u.months.add(month);
    users.set(userId, u);
  }

  return {
    byMonth: [...months.entries()]
      .map(([month, v]) => ({ month, users: v.users.size, minutes: v.minutes }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    top: [...users.entries()]
      .map(([userId, v]) => ({ userId, minutes: v.minutes, months: v.months.size }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 15),
    total,
    truncated,
  };
}

const MS_PER_DAY = 86_400_000;

/** Clerk history: signup curve, plan mix, and how many ever came back. */
async function loadClerk(): Promise<{
  totalUsers: number | null;
  signupsByMonth: SignupPoint[];
  activeLast30: number | null;
  neverActive: number | null;
  usersByPlan: { label: string; value: number }[];
  emails: Map<string, string>;
  note?: string;
}> {
  const empty = {
    totalUsers: null,
    signupsByMonth: [],
    activeLast30: null,
    neverActive: null,
    usersByPlan: [],
    emails: new Map<string, string>(),
  };
  if (DEV_NO_CLERK) return { ...empty, note: "Clerk disabled in dev." };

  try {
    const client = await clerkClient();
    const total = await client.users.getCount();

    // Page through every user. At this scale (tens to low thousands) the whole
    // list is cheap and gives an exact cohort curve rather than a sample.
    const PAGE = 500;
    const MAX_PAGES = 20;
    const all: {
      id: string;
      createdAt: number;
      lastActiveAt: number | null;
      plan: string;
      email?: string;
    }[] = [];
    let truncated = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await client.users.getUserList({
        limit: PAGE,
        offset: page * PAGE,
        orderBy: "-created_at",
      });
      for (const u of res.data) {
        const meta = (u.publicMetadata ?? {}) as { plan?: unknown };
        all.push({
          id: u.id,
          createdAt: u.createdAt,
          lastActiveAt: u.lastActiveAt ?? null,
          plan: typeof meta.plan === "string" && meta.plan ? meta.plan : "free",
          email: u.primaryEmailAddress?.emailAddress ?? undefined,
        });
      }
      if (res.data.length < PAGE) break;
      if (page === MAX_PAGES - 1) truncated = true;
    }

    const byMonth = new Map<string, number>();
    const byPlan = new Map<string, number>();
    const cutoff = Date.now() - 30 * MS_PER_DAY;
    let activeLast30 = 0;
    let neverActive = 0;

    for (const u of all) {
      const month = new Date(u.createdAt).toISOString().slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
      byPlan.set(u.plan, (byPlan.get(u.plan) ?? 0) + 1);
      if (u.lastActiveAt && u.lastActiveAt >= cutoff) activeLast30++;
      // Clerk sets lastActiveAt on first session, so a null here really does
      // mean the account was created and never used.
      if (!u.lastActiveAt) neverActive++;
    }

    return {
      totalUsers: total,
      signupsByMonth: [...byMonth.entries()]
        .map(([month, signups]) => ({ month, signups }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      activeLast30,
      neverActive,
      usersByPlan: [...byPlan.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
      emails: new Map(all.filter((u) => u.email).map((u) => [u.id, u.email!])),
      note: truncated ? "Clerk user list hit the page cap; cohort counts are a lower bound." : undefined,
    };
  } catch (err) {
    return {
      ...empty,
      note: `Clerk history unavailable: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

/**
 * Load the all-time view.
 *
 * Clerk and KV are independent: one failing still leaves the other's panels
 * populated, and `notes` explains any gap rather than rendering a silent zero.
 */
export async function loadOwnerHistory(): Promise<OwnerHistory> {
  const notes: string[] = [];

  const [clerk, kv] = await Promise.all([loadClerk(), syncKv()]);
  if (clerk.note) notes.push(clerk.note);

  let listening = { byMonth: [] as MonthlyListening[], top: [] as ListeningUserTotal[], total: 0, truncated: false };
  let linkedUsers: number | null = null;

  if (!kv) {
    notes.push("KV binding AVC_SYNC_KV not available, so listening history is hidden.");
  } else {
    try {
      listening = await loadListening(kv);
    } catch (err) {
      notes.push(`Listening history failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    try {
      // One pointer key per user, 30-day sliding TTL: a live extension link.
      const linked = await listPrefix(kv, "synctoken:user:");
      linkedUsers = linked.names.length;
      if (linked.truncated) {
        notes.push("Linked-user listing hit the page cap; the count is a lower bound.");
      }
    } catch (err) {
      notes.push(`Linked-user count failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  if (listening.truncated) {
    notes.push("Listening-usage listing hit the page cap; minutes are a lower bound.");
  }

  const topListeners = listening.top.map((t) => ({ ...t, email: clerk.emails.get(t.userId) }));

  return {
    available: clerk.totalUsers !== null || listening.byMonth.length > 0 || linkedUsers !== null,
    notes,
    totalUsers: clerk.totalUsers,
    signupsByMonth: clerk.signupsByMonth,
    activeLast30: clerk.activeLast30,
    neverActive: clerk.neverActive,
    usersByPlan: clerk.usersByPlan,
    listeningByMonth: listening.byMonth,
    topListeners,
    totalListeningMinutes: listening.total,
    linkedUsers,
    activationRate:
      clerk.totalUsers && clerk.totalUsers > 0 && linkedUsers !== null
        ? linkedUsers / clerk.totalUsers
        : null,
    truncated: listening.truncated,
  };
}

/** Minutes as `1h 04m` / `47m` / `12s`, for panels that show listening time. */
export function fmtMinutes(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return "0m";
  if (mins < 1) return `${Math.round(mins * 60)}s`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
