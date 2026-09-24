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
  calls: number;
}

/** Most accounts one query names. Past this, the rest are left unchecked. */
export const MAX_PLAN_ACCOUNTS = 100;

/**
 * Plan tags per account on one dataset. null when there is nobody to ask
 * about: an empty OR is not a query.
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
    SUM(_sample_interval) AS calls
  FROM ${dataset}
  WHERE timestamp > NOW() - INTERVAL '${sqlHours(hours)}' HOUR
    AND (${unique.map((id) => `${user} = ${sqlString(id)}`).join(" OR ")})
  GROUP BY userId, plan
  ORDER BY calls DESC
  LIMIT 1000`;
}

export type PlanTagVerdict = "ok" | "mismatch" | "no calls";

export interface PlanTagRow {
  userId: string;
  email?: string;
  bucket: PlanBucket;
  expiresAt: string | null;
  /** What the meters apply today. */
  effective: string;
  tags: { source: PlanTagSource; plan: string; calls: number }[];
  verdict: PlanTagVerdict;
}

/**
 * One row per account. `owner` is a tag the coach routes write for the owner
 * on purpose, so it is never a mismatch.
 */
export function foldPlanTags(
  accounts: ClerkUserRow[],
  rows: { source: PlanTagSource; row: PlanTagQueryRow }[]
): PlanTagRow[] {
  const byUser = new Map<string, PlanTagRow["tags"]>();
  for (const { source, row } of rows) {
    const id = String(row.userId ?? "");
    const tags = byUser.get(id) ?? [];
    tags.push({ source, plan: String(row.plan ?? "") || "unknown", calls: num(row.calls) });
    byUser.set(id, tags);
  }
  const out = accounts.map((a): PlanTagRow => {
    const tags = (byUser.get(a.id) ?? []).sort((x, y) => y.calls - x.calls);
    const wrong = tags.some((t) => t.plan !== a.plan.effective && t.plan !== "owner");
    return {
      userId: a.id,
      email: a.email,
      bucket: a.plan.bucket,
      expiresAt: a.plan.expiresAt,
      effective: a.plan.effective,
      tags,
      verdict: tags.length === 0 ? "no calls" : wrong ? "mismatch" : "ok",
    };
  });
  const rank: Record<PlanTagVerdict, number> = { mismatch: 0, ok: 1, "no calls": 2 };
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
