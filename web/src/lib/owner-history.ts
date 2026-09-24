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
import { effectivePlan, isPaidSubscription, isPlanId, parseEntitlement, type PlanId } from "@/lib/plans";
import { mapLimit } from "@/lib/telemetry-query";

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
  /** Signups with no saved word: never linked, or linked with no card (#163). */
  neverActive: number | null;
  neverLinked: number | null;
  linkedNoCard: number | null;
  /** By where the plan comes from: paid, gift, expired gift, free (#163). */
  usersByPlan: { label: string; value: number }[];
  /** Every signup whose metadata names a paid plan, expired or not (#163). */
  planAccounts: ClerkUserRow[];
  /** Accounts left out of every count here. */
  excludedCount: number;

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
  neverLinked: null,
  linkedNoCard: null,
  usersByPlan: [],
  planAccounts: [],
  excludedCount: 0,
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
async function loadListening(kv: KvLike, exclude: ReadonlySet<string> = new Set()): Promise<{
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
    if (exclude.has(userId)) continue;
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

// ------------------------------------------------------------- Plan buckets

/**
 * Where a user's plan comes from, not just which plan it names (#163).
 *
 * "Users by plan" used to count raw `publicMetadata.plan`, so an expired gift
 * still read as Max while every call that user made was (correctly) tagged
 * free. Buckets are derived from the same effective plan the meters use.
 */
export type PlanBucket =
  | "free"
  | "pro · paid"
  | "max · paid"
  | "pro · gift"
  | "max · gift"
  | "gift expired";

export interface PlanInfo {
  bucket: PlanBucket;
  /** The plan the meters and the telemetry apply today. */
  effective: PlanId;
  /** The plan the metadata names, expired or not. */
  raw: PlanId;
  /** Gift end, ISO; null for paid and free. */
  expiresAt: string | null;
}

export function planBucket(metadata: unknown, now = Date.now()): PlanInfo {
  const meta = (metadata && typeof metadata === "object" ? metadata : {}) as { plan?: unknown };
  const raw: PlanId = isPlanId(meta.plan) ? meta.plan : "free";
  const entitlement = parseEntitlement(metadata);
  const effective = effectivePlan(entitlement, now);
  if (raw === "free") return { bucket: "free", effective, raw, expiresAt: null };
  if (effective === "free") {
    // Expired, or an expiry so malformed that parseEntitlement failed closed.
    return { bucket: "gift expired", effective, raw, expiresAt: entitlement.planExpiresAt };
  }
  if (isPaidSubscription(entitlement)) {
    return { bucket: `${effective} · paid` as PlanBucket, effective, raw, expiresAt: null };
  }
  return { bucket: `${effective} · gift` as PlanBucket, effective, raw, expiresAt: entitlement.planExpiresAt };
}

// ---------------------------------------------------------------- Activity

/** What we know about one signup's use of the product. */
export interface ActivityInput {
  /** Holds a live extension link (`synctoken:user:<id>`). */
  linked: boolean;
  /** Has a cloud backup at all. */
  hasBackup: boolean;
  /** Saved words in that backup; null when the backup was not read. */
  words: number | null;
}

export interface ActivitySummary {
  /** Never linked, or linked and never saved a card. */
  neverActive: number;
  neverLinked: number;
  linkedNoCard: number;
  /** Signups whose backup was not read (cap or error): not counted either way. */
  unknown: number;
}

/**
 * "Never active" is no saved word, not "never signed in" (#163).
 *
 * Clerk's lastActiveAt is set on the first session, so nearly every signup has
 * one and the old definition read 0 while half of them had never linked. A
 * backup is permanent where the link pointer expires after 30 idle days, so a
 * backup counts as having linked once.
 */
export function foldActivity(users: ActivityInput[]): ActivitySummary {
  const out: ActivitySummary = { neverActive: 0, neverLinked: 0, linkedNoCard: 0, unknown: 0 };
  for (const u of users) {
    if (!u.linked && !u.hasBackup) {
      out.neverLinked++;
      continue;
    }
    if (u.hasBackup && u.words === null) {
      out.unknown++;
      continue;
    }
    if (!u.words) out.linkedNoCard++;
  }
  out.neverActive = out.neverLinked + out.linkedNoCard;
  return out;
}

/** One Clerk user, as the history needs them. */
export interface ClerkUserRow {
  id: string;
  createdAt: number;
  lastActiveAt: number | null;
  plan: PlanInfo;
  email?: string;
}

/** Clerk history: every signup, excluded accounts already removed. */
async function loadClerk(exclude: ReadonlySet<string>): Promise<{
  users: ClerkUserRow[] | null;
  emails: Map<string, string>;
  note?: string;
}> {
  const empty = { users: null, emails: new Map<string, string>() };
  if (DEV_NO_CLERK) return { ...empty, note: "Clerk disabled in dev." };

  try {
    const client = await clerkClient();

    // Page through every user. At this scale (tens to low thousands) the whole
    // list is cheap and gives an exact cohort curve rather than a sample.
    const PAGE = 500;
    const MAX_PAGES = 20;
    const all: ClerkUserRow[] = [];
    const emails = new Map<string, string>();
    let truncated = false;
    const now = Date.now();
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await client.users.getUserList({
        limit: PAGE,
        offset: page * PAGE,
        orderBy: "-created_at",
      });
      for (const u of res.data) {
        const email = u.primaryEmailAddress?.emailAddress ?? undefined;
        if (email) emails.set(u.id, email);
        if (exclude.has(u.id)) continue;
        all.push({
          id: u.id,
          createdAt: u.createdAt,
          lastActiveAt: u.lastActiveAt ?? null,
          plan: planBucket(u.publicMetadata, now),
          email,
        });
      }
      if (res.data.length < PAGE) break;
      if (page === MAX_PAGES - 1) truncated = true;
    }

    return {
      users: all,
      emails,
      note: truncated ? "Clerk user list hit the page cap; cohort counts are a lower bound." : undefined,
    };
  } catch (err) {
    return {
      ...empty,
      note: `Clerk history unavailable: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

/** Signup curve, plan mix and 30-day activity from the Clerk rows. */
export function foldClerk(users: ClerkUserRow[], now = Date.now()): {
  signupsByMonth: SignupPoint[];
  activeLast30: number;
  usersByPlan: { label: string; value: number }[];
} {
  const byMonth = new Map<string, number>();
  const byPlan = new Map<string, number>();
  const cutoff = now - 30 * MS_PER_DAY;
  let activeLast30 = 0;
  for (const u of users) {
    const month = new Date(u.createdAt).toISOString().slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    byPlan.set(u.plan.bucket, (byPlan.get(u.plan.bucket) ?? 0) + 1);
    if (u.lastActiveAt && u.lastActiveAt >= cutoff) activeLast30++;
  }
  return {
    signupsByMonth: [...byMonth.entries()]
      .map(([month, signups]) => ({ month, signups }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    activeLast30,
    usersByPlan: [...byPlan.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  };
}

/** Backups read for "never active", at most. Past this the count is a lower bound. */
export const MAX_BACKUP_READS = 500;
const BACKUP_RE = /^sync:user:(user_[A-Za-z0-9]+):snapshot:v1$/;
const LINK_RE = /^synctoken:user:(.+)$/;

/** Saved words in one backup, or null when it cannot be read. */
async function backupWords(kv: KvLike, userId: string): Promise<number | null> {
  try {
    const raw = await kv.get(`sync:user:${userId}:snapshot:v1`);
    if (!raw) return 0;
    const env = JSON.parse(raw) as { snapshot?: { words?: unknown[] } };
    return Array.isArray(env.snapshot?.words) ? env.snapshot!.words!.length : 0;
  } catch {
    return null;
  }
}

/**
 * Load the all-time view.
 *
 * Clerk and KV are independent: one failing still leaves the other's panels
 * populated, and `notes` explains any gap rather than rendering a silent zero.
 * Accounts in `exclude` (the owner and test accounts, #163) are left out of
 * every count here, the same as on the Analytics Engine panels.
 */
export async function loadOwnerHistory(
  opts: { exclude?: readonly string[] } = {}
): Promise<OwnerHistory> {
  const notes: string[] = [];
  const exclude = new Set(opts.exclude ?? []);

  const [clerk, kv] = await Promise.all([loadClerk(exclude), syncKv()]);
  if (clerk.note) notes.push(clerk.note);

  let listening = { byMonth: [] as MonthlyListening[], top: [] as ListeningUserTotal[], total: 0, truncated: false };
  let linkedIds: Set<string> | null = null;
  let backupIds: Set<string> | null = null;

  if (!kv) {
    notes.push("KV binding AVC_SYNC_KV not available, so listening history is hidden.");
  } else {
    try {
      listening = await loadListening(kv, exclude);
    } catch (err) {
      notes.push(`Listening history failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    try {
      // One pointer key per user, 30-day sliding TTL: a live extension link.
      const linked = await listPrefix(kv, "synctoken:user:");
      linkedIds = new Set(
        linked.names
          .map((n) => LINK_RE.exec(n)?.[1])
          .filter((id): id is string => !!id && !exclude.has(id))
      );
      if (linked.truncated) {
        notes.push("Linked-user listing hit the page cap; the count is a lower bound.");
      }
    } catch (err) {
      notes.push(`Linked-user count failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    try {
      const backups = await listPrefix(kv, "sync:user:");
      backupIds = new Set(
        backups.names
          .map((n) => BACKUP_RE.exec(n)?.[1])
          .filter((id): id is string => !!id && !exclude.has(id))
      );
      if (backups.truncated) notes.push("Backup listing hit the page cap; never active is a lower bound.");
    } catch (err) {
      notes.push(`Backup listing failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  if (listening.truncated) {
    notes.push("Listening-usage listing hit the page cap; minutes are a lower bound.");
  }

  const users = clerk.users;
  const folded = users ? foldClerk(users) : null;

  // Never active needs both halves: the signups (Clerk) and their link and
  // backup (KV). Without either it is unknown, never a 0.
  let activity: ActivitySummary | null = null;
  if (users && kv && linkedIds && backupIds) {
    const toRead = users.filter((u) => backupIds!.has(u.id)).slice(0, MAX_BACKUP_READS);
    const words = new Map<string, number | null>();
    await mapLimit(toRead, 8, async (u) => {
      words.set(u.id, await backupWords(kv, u.id));
    });
    activity = foldActivity(
      users.map((u) => ({
        linked: linkedIds!.has(u.id),
        hasBackup: backupIds!.has(u.id),
        words: backupIds!.has(u.id) ? (words.has(u.id) ? words.get(u.id)! : null) : 0,
      }))
    );
    if (activity.unknown > 0) {
      notes.push(
        `${activity.unknown} backup${activity.unknown === 1 ? "" : "s"} could not be read; never active is a lower bound.`
      );
    }
  } else if (users) {
    notes.push("Never active needs KV (links and backups) and is hidden.");
  }

  const topListeners = listening.top.map((t) => ({ ...t, email: clerk.emails.get(t.userId) }));
  const totalUsers = users ? users.length : null;
  const linkedUsers = linkedIds ? linkedIds.size : null;

  return {
    available: totalUsers !== null || listening.byMonth.length > 0 || linkedUsers !== null,
    notes,
    totalUsers,
    signupsByMonth: folded?.signupsByMonth ?? [],
    activeLast30: folded?.activeLast30 ?? null,
    neverActive: activity?.neverActive ?? null,
    neverLinked: activity?.neverLinked ?? null,
    linkedNoCard: activity?.linkedNoCard ?? null,
    usersByPlan: folded?.usersByPlan ?? [],
    planAccounts: (users ?? []).filter((u) => u.plan.raw !== "free"),
    excludedCount: exclude.size,
    listeningByMonth: listening.byMonth,
    topListeners,
    totalListeningMinutes: listening.total,
    linkedUsers,
    activationRate:
      totalUsers && totalUsers > 0 && linkedUsers !== null ? linkedUsers / totalUsers : null,
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
