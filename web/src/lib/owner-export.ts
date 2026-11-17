// One-click export of every usage record the owner can see, as a single JSON.
//
// WHY. /owner is built for reading, not for analysis: its user tables are top-N
// lists (50 by AI calls, 50 by events, 25 by transcription), so most learners
// never get a drill-down, and nothing on the page can be downloaded. This file
// gathers the same sources without those caps:
//
//   Clerk          every signup ever, with plan and activity timestamps
//   KV backups     each learner's cloud backup: per-day study stats since their
//                  first day, word counts, shows and settings. This is the only
//                  per-user record that predates Analytics Engine.
//   KV meters      Listening Mode minutes and AI calls per user per month (short
//                  TTLs, so recent months only)
//   Analytics      raw event, LLM and transcription rows for the last 90 days,
//                  which is everything AE still holds
//
// Analytics Engine deletes rows after 90 days and nothing can bring them back.
// Older activity survives only in the backups' daily stats, so the export says
// that in its `readme` rather than leaving a reader to assume full coverage.

import { clerkClient } from "@clerk/nextjs/server";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { resolveExclusions } from "@/lib/owner-exclusions";
import { listPrefix, planBucket, syncKv, type KvLike, type PlanInfo } from "@/lib/owner-history";
import { stripSecretSettings, type CloudDailyStats, type CloudSyncEnvelope, type WordState } from "@/lib/sync";
import { analyticsCredentials, mapLimit, runQuery, type AnalyticsCredentials } from "@/lib/telemetry-query";
import {
  EVENT_BLOBS,
  EVENT_DATASET,
  EVENT_DOUBLES,
  EXTENSION_DATASET,
  LLM_BLOBS,
  LLM_DATASET,
  LLM_DOUBLES,
  TRANSCRIBE_BLOBS,
  TRANSCRIBE_DATASET,
  TRANSCRIBE_DOUBLES,
} from "@/lib/telemetry-schema";

export const EXPORT_VERSION = 1;

/** Everything AE keeps. */
export const EXPORT_HOURS = 24 * 90;

/**
 * Rows per raw dataset. Newest rows are kept when a dataset is bigger, and the
 * section is marked `truncated`. Sized to keep the Worker well under its memory
 * limit; raise it only with the response size in mind.
 */
export const RAW_ROW_LIMIT = 50_000;

/**
 * KV reads per export. Workers allow 1,000 KV operations per invocation; the
 * rest of the budget covers the list calls. Backups are read first because
 * they are the only all-time record, so a cut lands on the short-lived meters.
 */
export const KV_READ_BUDGET = 900;

const TOP_TITLES = 25;

// ---------------------------------------------------------------- Analytics SQL

/**
 * Columns are selected by position (blob1, double1, ...) and renamed in code,
 * not with SQL aliases, so no field name can collide with an AE keyword.
 */
function rawSql(dataset: string, blobs: readonly string[], doubles: readonly string[], limit: number): string {
  const cols = [
    "timestamp",
    "_sample_interval",
    ...blobs.map((_, i) => `blob${i + 1}`),
    ...doubles.map((_, i) => `double${i + 1}`),
  ];
  const n = Math.max(1, Math.min(RAW_ROW_LIMIT, Math.floor(limit)));
  return `SELECT ${cols.join(", ")}
  FROM ${dataset}
  WHERE timestamp > NOW() - INTERVAL '${EXPORT_HOURS}' HOUR
  ORDER BY timestamp DESC
  LIMIT ${n}`;
}

export const rawEventsSql = (limit = RAW_ROW_LIMIT) => rawSql(EVENT_DATASET, EVENT_BLOBS, EVENT_DOUBLES, limit);
export const rawLlmSql = (limit = RAW_ROW_LIMIT) => rawSql(LLM_DATASET, LLM_BLOBS, LLM_DOUBLES, limit);
export const rawTranscribeSql = (limit = RAW_ROW_LIMIT) =>
  rawSql(TRANSCRIBE_DATASET, TRANSCRIBE_BLOBS, TRANSCRIBE_DOUBLES, limit);

/** The extension funnel dataset only defines blob1 (the event name). */
export function extensionFunnelDailySql(): string {
  return `SELECT
    toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day,
    blob1 AS label,
    SUM(_sample_interval) AS events
  FROM ${EXTENSION_DATASET}
  WHERE timestamp > NOW() - INTERVAL '${EXPORT_HOURS}' HOUR
  GROUP BY day, label
  ORDER BY day
  LIMIT ${RAW_ROW_LIMIT}`;
}

export type RawRow = Record<string, string | number>;

/**
 * Rename positional columns to their schema names, oldest row first.
 * `weight` is `_sample_interval`: how many real events one stored row stands
 * for. Sum it, not the row count, whenever AE has sampled.
 */
export function nameRows(
  rows: Record<string, unknown>[],
  blobs: readonly string[],
  doubles: readonly string[]
): RawRow[] {
  return rows
    .map((r) => {
      const out: RawRow = { timestamp: String(r.timestamp ?? ""), weight: Number(r._sample_interval ?? 1) || 1 };
      blobs.forEach((name, i) => {
        out[name] = String(r[`blob${i + 1}`] ?? "");
      });
      doubles.forEach((name, i) => {
        const v = Number(r[`double${i + 1}`]);
        out[name] = Number.isFinite(v) ? v : 0;
      });
      return out;
    })
    .reverse();
}

export interface DatasetExport<T> {
  rows: T[];
  /** The row cap was hit, so the oldest rows in the window are missing. */
  truncated: boolean;
  error?: string;
}

async function rawDataset(
  sql: string,
  blobs: readonly string[],
  doubles: readonly string[],
  creds: AnalyticsCredentials
): Promise<DatasetExport<RawRow>> {
  const res = await runQuery<Record<string, unknown>>(sql, creds);
  if (!res.ok) return { rows: [], truncated: false, error: res.detail ? `${res.reason}: ${res.detail}` : res.reason };
  return { rows: nameRows(res.rows, blobs, doubles), truncated: res.rows.length >= RAW_ROW_LIMIT };
}

// ---------------------------------------------------------------- Backups

export interface BackupSummary {
  lastSyncedAt: string | null;
  revision: number | null;
  words: {
    total: number;
    byState: Partial<Record<WordState, number>>;
    /** JLPT-style level, "unknown" when the word has none. */
    byLevel: Record<string, number>;
    /** Words with an SRS schedule. */
    inReview: number;
    totalLapses: number;
    /** By the month the word was first seen. */
    addedByMonth: Record<string, number>;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
  };
  /** Shows the words were first met in, most words first. */
  topTitles: { title: string; words: number }[];
  /** One row per studied day, for the learner's whole history. */
  daily: CloudDailyStats[];
  cardsShown: number;
  firstCardAt: string | null;
  lastCardAt: string | null;
  /** Extension settings, secrets removed. Shows which features are switched on. */
  settings: Record<string, unknown>;
  pendingWebReviews: number;
}

const iso = (ms: number | null | undefined): string | null =>
  typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;

/** Reduce one cloud backup to what usage analysis needs. Never throws. */
export function summarizeBackup(envelope: CloudSyncEnvelope): BackupSummary {
  const snap = envelope?.snapshot;
  const words = Array.isArray(snap?.words) ? snap.words : [];
  const byState: Partial<Record<WordState, number>> = {};
  const byLevel: Record<string, number> = {};
  const addedByMonth: Record<string, number> = {};
  const titles = new Map<string, number>();
  let inReview = 0;
  let totalLapses = 0;
  let first: string | null = null;
  let last: string | null = null;

  for (const w of words) {
    if (!w) continue;
    byState[w.state] = (byState[w.state] ?? 0) + 1;
    const level = typeof w.level === "number" ? String(w.level) : "unknown";
    byLevel[level] = (byLevel[level] ?? 0) + 1;
    if (w.review) {
      inReview++;
      totalLapses += Number(w.review.lapses) || 0;
    }
    if (w.firstSeenAt) {
      const month = w.firstSeenAt.slice(0, 7);
      addedByMonth[month] = (addedByMonth[month] ?? 0) + 1;
      if (!first || w.firstSeenAt < first) first = w.firstSeenAt;
    }
    if (w.lastSeenAt && (!last || w.lastSeenAt > last)) last = w.lastSeenAt;
    const title = w.source?.title?.trim();
    if (title) titles.set(title, (titles.get(title) ?? 0) + 1);
  }

  const cards = Array.isArray(snap?.cardTimestamps) ? snap.cardTimestamps.filter((t) => Number.isFinite(t)) : [];
  const daily = Array.isArray(snap?.daily) ? [...snap.daily].sort((a, b) => a.day.localeCompare(b.day)) : [];

  return {
    lastSyncedAt: envelope?.lastSyncedAt ?? null,
    revision: typeof envelope?.revision === "number" ? envelope.revision : null,
    words: { total: words.length, byState, byLevel, inReview, totalLapses, addedByMonth, firstSeenAt: first, lastSeenAt: last },
    topTitles: [...titles.entries()]
      .map(([title, n]) => ({ title, words: n }))
      .sort((a, b) => b.words - a.words || a.title.localeCompare(b.title))
      .slice(0, TOP_TITLES),
    daily,
    cardsShown: cards.length,
    firstCardAt: cards.length ? iso(Math.min(...cards)) : null,
    lastCardAt: cards.length ? iso(Math.max(...cards)) : null,
    settings: stripSecretSettings(snap?.settings && typeof snap.settings === "object" ? snap.settings : {}),
    pendingWebReviews: Array.isArray(envelope?.webReviews) ? envelope.webReviews.length : 0,
  };
}

// ---------------------------------------------------------------- KV meters

const BACKUP_KEY = /^sync:user:(user_[A-Za-z0-9]+):snapshot:v1$/;
const LINK_KEY = /^synctoken:user:(.+):v1$/;
const LISTEN_KEY = /^use:(user_[A-Za-z0-9]+):(\d{4}-\d{2})$/;
const AI_KEY = /^ai:usage:(?:(auto|subs):)?(user_[A-Za-z0-9]+):(\d{4}-\d{2})$/;

export interface MeterKey {
  key: string;
  userId: string;
  month: string;
  meter: "listeningMinutes" | "ai" | "auto" | "subs";
}

/** Which per-user monthly meter a KV key holds, or null. */
export function parseMeterKey(key: string): MeterKey | null {
  const l = LISTEN_KEY.exec(key);
  if (l) return { key, userId: l[1]!, month: l[2]!, meter: "listeningMinutes" };
  const a = AI_KEY.exec(key);
  if (a) return { key, userId: a[2]!, month: a[3]!, meter: (a[1] as "auto" | "subs" | undefined) ?? "ai" };
  return null;
}

// ---------------------------------------------------------------- Users

export interface ExportUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  lastSignInAt: string | null;
  plan: PlanInfo | null;
  /** Owner or test account; the dashboard leaves these out of its counts. */
  excluded: boolean;
  /** Holds a live extension link (30-day sliding TTL). */
  extensionLinked: boolean;
  backup: BackupSummary | null;
  /** `YYYY-MM` -> meter -> value. Listening is minutes, the rest are AI calls. */
  monthly: Record<string, Partial<Record<MeterKey["meter"], number>>>;
}

export interface OwnerExport {
  version: number;
  exportedAt: string;
  readme: string[];
  notes: string[];
  totals: {
    users: number;
    withBackup: number;
    extensionLinked: number;
    excluded: number;
  };
  users: ExportUser[];
  analytics: {
    configured: boolean;
    windowHours: number;
    fields: {
      events: string[];
      llm: string[];
      transcribe: string[];
    };
    events: DatasetExport<RawRow>;
    llm: DatasetExport<RawRow>;
    transcribe: DatasetExport<RawRow>;
    extensionFunnelDaily: DatasetExport<{ day: string; label: string; events: number }>;
  };
}

export const EXPORT_README = [
  "users: every Clerk signup. Accounts with excluded=true are the owner and test accounts.",
  "users[].backup.daily: per-day study stats (met, judged, reviews, watchMin) for the learner's whole history. This is the only per-user activity older than 90 days.",
  "users[].monthly: Listening Mode minutes and AI calls per month, from KV meters that expire after about 40 days.",
  "analytics.*.rows: raw Analytics Engine rows, oldest first. AE deletes rows after 90 days, so nothing older exists there.",
  "analytics.*.rows[].weight: how many real events one stored row stands for. Sum weight rather than counting rows.",
  "Keep each download: Analytics rows older than 90 days are gone from the server for good.",
];

interface ClerkRow {
  id: string;
  email: string | null;
  createdAt: number | null;
  lastActiveAt: number | null;
  lastSignInAt: number | null;
  publicMetadata: unknown;
}

async function loadClerkUsers(): Promise<{ users: ClerkRow[]; note?: string }> {
  if (DEV_NO_CLERK) return { users: [], note: "Clerk disabled in dev." };
  const PAGE = 500;
  const MAX_PAGES = 20;
  const users: ClerkRow[] = [];
  try {
    const client = await clerkClient();
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await client.users.getUserList({ limit: PAGE, offset: page * PAGE, orderBy: "created_at" });
      for (const u of res.data) {
        users.push({
          id: u.id,
          email: u.primaryEmailAddress?.emailAddress ?? null,
          createdAt: u.createdAt ?? null,
          lastActiveAt: u.lastActiveAt ?? null,
          lastSignInAt: u.lastSignInAt ?? null,
          publicMetadata: u.publicMetadata,
        });
      }
      if (res.data.length < PAGE) return { users };
    }
    return { users, note: `Clerk listing stopped at ${users.length} users (page cap).` };
  } catch (err) {
    return { users, note: `Clerk unavailable: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

function emptyUser(id: string, excluded: boolean): ExportUser {
  return {
    id,
    email: null,
    createdAt: null,
    lastActiveAt: null,
    lastSignInAt: null,
    plan: null,
    excluded,
    extensionLinked: false,
    backup: null,
    monthly: {},
  };
}

/** Load everything. Each source fails on its own and leaves a note. */
export async function loadOwnerExport(now = new Date()): Promise<OwnerExport> {
  const notes: string[] = [];
  const [clerk, kv, exclusions, creds] = await Promise.all([
    loadClerkUsers(),
    syncKv(),
    resolveExclusions().catch(() => ({ ids: [] as string[], emails: [] as string[], note: "Exclusions unavailable." })),
    analyticsCredentials(),
  ]);
  if (clerk.note) notes.push(clerk.note);
  if (exclusions.note) notes.push(exclusions.note);
  const excluded = new Set(exclusions.ids);

  const users = new Map<string, ExportUser>();
  const userFor = (id: string) => {
    let u = users.get(id);
    if (!u) {
      u = emptyUser(id, excluded.has(id));
      users.set(id, u);
    }
    return u;
  };

  for (const c of clerk.users) {
    const u = userFor(c.id);
    u.email = c.email;
    u.createdAt = iso(c.createdAt);
    u.lastActiveAt = iso(c.lastActiveAt);
    u.lastSignInAt = iso(c.lastSignInAt);
    u.plan = planBucket(c.publicMetadata, now.getTime());
  }

  if (!kv) {
    notes.push("KV binding AVC_SYNC_KV not available: backups, links and monthly meters are missing.");
  } else {
    await loadKv(kv, userFor, notes);
  }

  const analytics = await loadAnalytics(creds, notes);
  const list = [...users.values()].sort((a, b) => (a.createdAt ?? "~").localeCompare(b.createdAt ?? "~"));

  return {
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    readme: EXPORT_README,
    notes,
    totals: {
      users: list.length,
      withBackup: list.filter((u) => u.backup).length,
      extensionLinked: list.filter((u) => u.extensionLinked).length,
      excluded: list.filter((u) => u.excluded).length,
    },
    users: list,
    analytics,
  };
}

async function safeList(kv: KvLike, prefix: string, notes: string[]): Promise<string[]> {
  try {
    const { names, truncated } = await listPrefix(kv, prefix);
    if (truncated) notes.push(`KV listing of "${prefix}" hit the page cap; some keys are missing.`);
    return names;
  } catch (err) {
    notes.push(`KV listing of "${prefix}" failed: ${err instanceof Error ? err.message : "unknown error"}`);
    return [];
  }
}

async function loadKv(kv: KvLike, userFor: (id: string) => ExportUser, notes: string[]): Promise<void> {
  const [backupKeys, linkKeys, listenKeys, aiKeys] = await Promise.all([
    safeList(kv, "sync:user:", notes),
    safeList(kv, "synctoken:user:", notes),
    safeList(kv, "use:", notes),
    safeList(kv, "ai:usage:", notes),
  ]);

  for (const k of linkKeys) {
    const id = LINK_KEY.exec(k)?.[1];
    if (id) userFor(id).extensionLinked = true;
  }

  let budget = KV_READ_BUDGET;
  const backupIds = backupKeys.map((k) => BACKUP_KEY.exec(k)?.[1]).filter((id): id is string => !!id);
  const backupsToRead = backupIds.slice(0, budget);
  budget -= backupsToRead.length;
  if (backupsToRead.length < backupIds.length) {
    notes.push(`Read ${backupsToRead.length} of ${backupIds.length} backups (KV read budget).`);
  }

  let unreadable = 0;
  await mapLimit(backupsToRead, 8, async (id) => {
    try {
      const raw = await kv.get(`sync:user:${id}:snapshot:v1`);
      if (raw) userFor(id).backup = summarizeBackup(JSON.parse(raw) as CloudSyncEnvelope);
    } catch {
      unreadable++;
    }
  });
  if (unreadable) notes.push(`${unreadable} backup${unreadable === 1 ? "" : "s"} could not be read.`);

  const meters = [...listenKeys, ...aiKeys].map(parseMeterKey).filter((m): m is MeterKey => !!m);
  const metersToRead = meters.slice(0, Math.max(0, budget));
  if (metersToRead.length < meters.length) {
    notes.push(`Read ${metersToRead.length} of ${meters.length} monthly meters (KV read budget).`);
  }
  await mapLimit(metersToRead, 8, async (m) => {
    try {
      const v = Number.parseFloat((await kv.get(m.key)) || "0");
      if (!Number.isFinite(v) || v <= 0) return;
      const month = (userFor(m.userId).monthly[m.month] ??= {});
      month[m.meter] = (month[m.meter] ?? 0) + v;
    } catch {
      // One unreadable meter is not worth failing the export over.
    }
  });
}

async function loadAnalytics(creds: AnalyticsCredentials | null, notes: string[]): Promise<OwnerExport["analytics"]> {
  const empty = { rows: [], truncated: false };
  const base = {
    windowHours: EXPORT_HOURS,
    fields: {
      events: ["timestamp", "weight", ...EVENT_BLOBS, ...EVENT_DOUBLES],
      llm: ["timestamp", "weight", ...LLM_BLOBS, ...LLM_DOUBLES],
      transcribe: ["timestamp", "weight", ...TRANSCRIBE_BLOBS, ...TRANSCRIBE_DOUBLES],
    },
  };
  if (!creds) {
    notes.push("Analytics Engine credentials are not configured: the analytics section is empty.");
    return { ...base, configured: false, events: empty, llm: empty, transcribe: empty, extensionFunnelDaily: empty };
  }

  // Sequential: the SQL API rate-limits per account.
  const events = await rawDataset(rawEventsSql(), EVENT_BLOBS, EVENT_DOUBLES, creds);
  const llm = await rawDataset(rawLlmSql(), LLM_BLOBS, LLM_DOUBLES, creds);
  const transcribe = await rawDataset(rawTranscribeSql(), TRANSCRIBE_BLOBS, TRANSCRIBE_DOUBLES, creds);
  const funnelRes = await runQuery<{ day: unknown; label: unknown; events: unknown }>(extensionFunnelDailySql(), creds);
  const extensionFunnelDaily: OwnerExport["analytics"]["extensionFunnelDaily"] = funnelRes.ok
    ? {
        rows: funnelRes.rows.map((r) => ({ day: String(r.day ?? ""), label: String(r.label ?? ""), events: Number(r.events) || 0 })),
        truncated: funnelRes.rows.length >= RAW_ROW_LIMIT,
      }
    : { rows: [], truncated: false, error: funnelRes.reason };

  for (const [name, d] of Object.entries({ events, llm, transcribe, extensionFunnelDaily })) {
    if (d.error) notes.push(`Analytics ${name} query failed: ${d.error}`);
    if (d.truncated) notes.push(`Analytics ${name} hit ${RAW_ROW_LIMIT} rows; the oldest rows are missing.`);
  }

  return { ...base, configured: true, events, llm, transcribe, extensionFunnelDaily };
}

/** `animevocab-usage-2026-11-17.json` */
export function exportFilename(now = new Date()): string {
  return `animevocab-usage-${now.toISOString().slice(0, 10)}.json`;
}
