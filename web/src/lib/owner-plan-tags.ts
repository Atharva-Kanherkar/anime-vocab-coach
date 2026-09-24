// "Confirm paid users' calls carry their plan" (#163).
//
// Clerk showed 5 Max and 2 Pro while every AI call and every transcription on
// /owner was tagged free. Both writers tag the EFFECTIVE plan (web resolvePlan,
// avc-api effectivePlanFromProfile), which applies gift expiry, so an expired
// gift is correctly free. A stale sync-token profile would not be. This panel
// separates the two: for every account whose metadata names a paid plan, the
// plan it has today next to the plan its calls actually carried.

import type { ClerkUserRow, PlanBucket } from "./owner-history";
import {
  analyticsCredentials,
  num,
  runQuery,
  sqlHours,
  sqlString,
  type AnalyticsCredentials,
} from "./telemetry-query";
import {
  LLM_DATASET,
  TRANSCRIBE_DATASET,
  llmColumn,
  transcribeColumn,
} from "./telemetry-schema";

export type PlanTagSource = "llm" | "transcribe";

export interface PlanTagQueryRow {
  userId: string;
  plan: string;
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  calls: number;
}

/** Most accounts one query names. Past this, the rest are left unchecked. */
export const MAX_PLAN_ACCOUNTS = 100;

/**
 * Plan tags per account and UTC day on one dataset. null when there is nobody
 * to ask about: an empty OR is not a query.
 *
 * By day, not just by tag, because a tag is only wrong against the plan the
 * account had WHEN the call was made. A gift that expired mid-window has
 * correct `max` calls before and correct `free` calls after (#169 review).
 */
export function planTagsSql(source: PlanTagSource, hours: number, ids: readonly string[]): string | null {
  const unique = [...new Set(ids)].filter(Boolean).slice(0, MAX_PLAN_ACCOUNTS);
  if (!unique.length) return null;
  const col = source === "llm" ? llmColumn : transcribeColumn;
  const dataset = source === "llm" ? LLM_DATASET : TRANSCRIBE_DATASET;
  const user = col("userId");
  return `SELECT
    ${user} AS userId,
    ${col("plan")} AS plan,
    toDate(timestamp) AS day,
    SUM(_sample_interval) AS calls
  FROM ${dataset}
  WHERE timestamp > NOW() - INTERVAL '${sqlHours(hours)}' HOUR
    AND (${unique.map((id) => `${user} = ${sqlString(id)}`).join(" OR ")})
  GROUP BY userId, plan, day
  ORDER BY day
  LIMIT 10000`;
}

export type PlanTagVerdict = "ok" | "mismatch" | "unclear" | "no calls";

export interface PlanTagRow {
  userId: string;
  email?: string;
  bucket: PlanBucket;
  expiresAt: string | null;
  /** What the meters apply today. */
  effective: string;
  /** Totals per source and tag across the window. */
  tags: { source: PlanTagSource; plan: string; calls: number }[];
  /** Calls on days the plan may have changed, so not judged either way. */
  unjudgedCalls: number;
  /** The judged tags that did not match the plan of their day. */
  wrong: { source: PlanTagSource; plan: string; expected: string; calls: number }[];
  verdict: PlanTagVerdict;
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The plan an account had on a UTC day, or null when that cannot be known.
 *
 * - Nothing is known on or before the day of Clerk's last write to the user:
 *   the plan may have changed that day or earlier. updatedAt only moves
 *   forward, so it can make days unjudged but never a wrong call judged.
 * - After it: the metadata plan until a gift's expiry day, free after. The
 *   expiry day itself is split and left unjudged. A malformed expiry is free
 *   throughout, since that is how the meters apply it.
 */
export function expectedPlanOn(account: ClerkUserRow, day: string): string | null {
  if (!account.updatedAt || day <= dayOf(account.updatedAt)) return null;
  const { raw, bucket, expiresAt } = account.plan;
  if (bucket === "gift expired" && !expiresAt) return "free";
  if (expiresAt) {
    const end = expiresAt.slice(0, 10);
    if (day === end) return null;
    return day < end ? raw : "free";
  }
  return raw;
}

/**
 * One row per account. `owner` is a tag the coach routes write for the owner
 * on purpose, so it is never wrong.
 */
export function foldPlanTags(
  accounts: ClerkUserRow[],
  rows: { source: PlanTagSource; row: PlanTagQueryRow }[]
): PlanTagRow[] {
  const byUser = new Map<string, { source: PlanTagSource; row: PlanTagQueryRow }[]>();
  for (const r of rows) {
    const id = String(r.row.userId ?? "");
    byUser.set(id, [...(byUser.get(id) ?? []), r]);
  }

  const out = accounts.map((a): PlanTagRow => {
    const totals = new Map<string, { source: PlanTagSource; plan: string; calls: number }>();
    const wrong = new Map<string, PlanTagRow["wrong"][number]>();
    let judgedOk = 0;
    let unjudged = 0;
    for (const { source, row } of byUser.get(a.id) ?? []) {
      const plan = String(row.plan ?? "") || "unknown";
      const calls = num(row.calls);
      const key = `${source}:${plan}`;
      const t = totals.get(key) ?? { source, plan, calls: 0 };
      t.calls += calls;
      totals.set(key, t);

      if (plan === "owner") {
        judgedOk += calls;
        continue;
      }
      const expected = expectedPlanOn(a, String(row.day ?? ""));
      if (expected === null) unjudged += calls;
      else if (expected === plan) judgedOk += calls;
      else {
        const wkey = `${key}:${expected}`;
        const w = wrong.get(wkey) ?? { source, plan, expected, calls: 0 };
        w.calls += calls;
        wrong.set(wkey, w);
      }
    }
    const tags = [...totals.values()].sort((x, y) => y.calls - x.calls);
    const verdict: PlanTagVerdict =
      tags.length === 0 ? "no calls" : wrong.size ? "mismatch" : judgedOk > 0 ? "ok" : "unclear";
    return {
      userId: a.id,
      email: a.email,
      bucket: a.plan.bucket,
      expiresAt: a.plan.expiresAt,
      effective: a.plan.effective,
      tags,
      unjudgedCalls: unjudged,
      wrong: [...wrong.values()].sort((x, y) => y.calls - x.calls),
      verdict,
    };
  });
  const rank: Record<PlanTagVerdict, number> = { mismatch: 0, ok: 1, unclear: 2, "no calls": 3 };
  const calls = (r: PlanTagRow) => r.tags.reduce((s, t) => s + t.calls, 0);
  return out.sort((a, b) => rank[a.verdict] - rank[b.verdict] || calls(b) - calls(a));
}

export interface PlanTagCheck {
  rows: PlanTagRow[];
  /** Query labels that failed, for the page's query-error line. */
  failed: string[];
  /** Accounts left unchecked because there were more than MAX_PLAN_ACCOUNTS. */
  skipped: number;
}

/** Run the two queries (none when there is nobody to check) and fold them. */
export async function loadPlanTags(
  hours: number,
  accounts: ClerkUserRow[],
  creds?: AnalyticsCredentials | null
): Promise<PlanTagCheck> {
  const checked = accounts.slice(0, MAX_PLAN_ACCOUNTS);
  const ids = checked.map((a) => a.id);
  const empty: PlanTagCheck = { rows: foldPlanTags(checked, []), failed: [], skipped: accounts.length - checked.length };
  if (!ids.length) return empty;
  const c = creds === undefined ? await analyticsCredentials() : creds;
  if (!c) return empty;

  const failed: string[] = [];
  const found: { source: PlanTagSource; row: PlanTagQueryRow }[] = [];
  for (const source of ["llm", "transcribe"] as const) {
    const sql = planTagsSql(source, hours, ids);
    if (!sql) continue;
    const out = await runQuery<PlanTagQueryRow>(sql, c);
    if (!out.ok) {
      failed.push(`plan tags (${source})`);
      continue;
    }
    for (const row of out.rows) found.push({ source, row });
  }
  return { rows: foldPlanTags(checked, found), failed, skipped: empty.skipped };
}
