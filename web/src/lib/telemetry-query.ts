// Read path for the /owner dashboard: Cloudflare's Analytics Engine SQL API.
//
// AE has no binding for reads — queries go over HTTPS with an account-scoped
// API token (Account Analytics: Read). Missing credentials are a first-class
// state, not an error: the dashboard renders with setup instructions instead
// of a stack trace.
//
// SAMPLING. AE may sample writes under load and reports the weight of each
// stored row in `_sample_interval`. A plain COUNT(*) therefore UNDER-REPORTS,
// and a plain SUM(cost) under-reports spend. Every aggregate below is weighted
// (`SUM(_sample_interval)` for counts, `SUM(x * _sample_interval)` for totals)
// so the numbers stay true if sampling ever kicks in. Averages divide two
// weighted sums, which is correct for the same reason.

import { LEARNING_LOOP_EVENTS } from "./track-events";
import {
  EVENT_BLOBS,
  EVENT_DATASET,
  EVENT_DOUBLES,
  EXTENSION_DATASET,
  LLM_BLOBS,
  LLM_DATASET,
  LLM_DOUBLES,
  TRANSCRIBE_DATASET,
  eventColumn,
  llmColumn,
  transcribeColumn,
} from "./telemetry-schema";

export interface AnalyticsCredentials {
  accountId: string;
  apiToken: string;
}

export type QueryFailure = "not_configured" | "unauthorized" | "rate_limited" | "query_failed";

export type QueryOutcome<T> =
  | { ok: true; rows: T[] }
  | { ok: false; reason: QueryFailure; detail?: string };

/**
 * Concurrency cap for dashboard queries.
 *
 * The SQL API rate-limits per account, and one dashboard render used to fan
 * out every panel at once — which tripped 429 on most of them and produced a
 * page of errors instead of data. Panels are worth more sequentially than
 * simultaneously and wrong.
 */
export const QUERY_CONCURRENCY = 2;

/** Run tasks with a bounded number in flight, preserving input order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SQL_API = "https://api.cloudflare.com/client/v4/accounts";

/**
 * Read the SQL-API credentials from either source.
 *
 * OpenNext copies string bindings (vars and secrets) into `process.env` when
 * the Worker boots, so that alone covers production. It does NOT cover local
 * `next dev`, where bindings exist only on the Cloudflare context — the same
 * reason getOpenAiKey() checks both.
 */
export async function analyticsCredentials(): Promise<AnalyticsCredentials | null> {
  let accountId = process.env.CF_ACCOUNT_ID?.trim();
  let apiToken = process.env.CF_ANALYTICS_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env } = (await getCloudflareContext({ async: true })) as {
        env: { CF_ACCOUNT_ID?: string; CF_ANALYTICS_API_TOKEN?: string };
      };
      accountId = accountId || env.CF_ACCOUNT_ID?.trim();
      apiToken = apiToken || env.CF_ANALYTICS_API_TOKEN?.trim();
    } catch {
      // Not on Cloudflare (unit tests, plain node) — process.env is all there is.
    }
  }

  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

/** Escape a value for a SQL string literal. Everything user-controlled that
 * reaches a query (a userId from the drill-down link) goes through this. */
export function sqlString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Hours are interpolated into INTERVAL clauses, which cannot be
 * parameterized — clamp to a positive integer so nothing else can get in. */
export function sqlHours(hours: number): number {
  const n = Math.round(Number(hours));
  if (!Number.isFinite(n) || n < 1) return 24;
  return Math.min(n, 24 * 90); // AE retains ~90 days
}

export async function runQuery<T>(
  sql: string,
  creds?: AnalyticsCredentials | null
): Promise<QueryOutcome<T>> {
  // `undefined` means "resolve them"; an explicit `null` means "there are
  // none" and must not trigger a lookup (tests rely on this).
  const resolved = creds === undefined ? await analyticsCredentials() : creds;
  if (!resolved) return { ok: false, reason: "not_configured" };

  // 429 and 5xx are worth another go; 401/403 mean the token is wrong and
  // retrying just burns quota against an endpoint that is already limiting us.
  const backoffMs = [300, 900];
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${SQL_API}/${resolved.accountId}/analytics_engine/sql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${resolved.apiToken}` },
        body: sql,
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: T[] };
        return { ok: true, rows: json.data ?? [] };
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < backoffMs.length) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 3000)
            : backoffMs[attempt]!
        );
        continue;
      }

      const body = (await res.text().catch(() => "")).slice(0, 200);
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: "unauthorized", detail: `HTTP ${res.status}` };
      }
      if (res.status === 429) {
        return { ok: false, reason: "rate_limited", detail: "HTTP 429" };
      }
      return { ok: false, reason: "query_failed", detail: `HTTP ${res.status} ${body}` };
    } catch (err) {
      if (attempt < backoffMs.length) {
        await sleep(backoffMs[attempt]!);
        continue;
      }
      return {
        ok: false,
        reason: "query_failed",
        detail: err instanceof Error ? err.message : "unknown error",
      };
    }
  }
}

// A dataset that has never been written to does not exist yet, and AE answers
// with an error rather than zero rows. That is the normal state right after
// deploy, so callers treat any failure as "no data yet" and keep rendering.
export function rowsOr<T>(outcome: QueryOutcome<T>, fallback: T[] = []): T[] {
  return outcome.ok ? outcome.rows : fallback;
}

const since = (hours: number) => `timestamp > NOW() - INTERVAL '${sqlHours(hours)}' HOUR`;

/** Weighted count of data points. */
const CALLS = "SUM(_sample_interval) AS calls";
const weighted = (field: string, alias: string) =>
  `SUM(${field} * _sample_interval) AS ${alias}`;

/**
 * Carry a string column through a GROUP BY, taking the value from the group's
 * most recent row.
 *
 * `max()` cannot be used here at all: Analytics Engine rejects a String
 * argument outright ("cannot use the String type as argument 1 in max").
 * argMax is also the right answer semantically — a lexicographic max over
 * {free, max, pro} returns "pro", so a Max-tier user would have been
 * mislabelled even if max() had been accepted. This reports the value as of
 * the user's latest activity, which is what the column means.
 */
const latest = (field: string, alias: string) =>
  `argMax(${field}, timestamp) AS ${alias}`;
/**
 * Conditional aggregates.
 *
 * Analytics Engine's IF() requires both branches to have the SAME type, and it
 * rejects the query outright rather than coercing:
 *
 *   the 2nd and 3rd arguments to IF() function must have the same type
 *   but instead had Double and Integer
 *
 * So a counting branch (which returns the integer `_sample_interval`) needs the
 * literal `0`, while a value branch (a double column times the weight) needs
 * `0.0`. Getting it wrong does not under-report, it 422s the whole panel, so
 * these two helpers exist to make the distinction impossible to mix up.
 */
const countIf = (cond: string, alias: string) =>
  `SUM(IF(${cond}, _sample_interval, 0)) AS ${alias}`;

const weightedIf = (cond: string, field: string, alias: string) =>
  `SUM(IF(${cond}, ${field} * _sample_interval, 0.0)) AS ${alias}`;

// ------------------------------------------------------------------ LLM SQL

export interface LlmTotals {
  calls: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  latencySum: number;
  errors: number;
  cachedHits: number;
  users: number;
}

export function llmTotalsSql(hours: number, userId?: string): string {
  const status = llmColumn("status");
  return `SELECT
    ${CALLS},
    ${weighted(llmColumn("costUsd"), "cost")},
    ${weighted(llmColumn("inputTokens"), "inputTokens")},
    ${weighted(llmColumn("outputTokens"), "outputTokens")},
    ${weighted(llmColumn("reasoningTokens"), "reasoningTokens")},
    ${weighted(llmColumn("cachedInputTokens"), "cachedInputTokens")},
    ${weighted(llmColumn("latencyMs"), "latencySum")},
    SUM(if(${status} = 'error', 1, 0) * _sample_interval) AS errors,
    SUM(if(${status} = 'cached', 1, 0) * _sample_interval) AS cachedHits,
    COUNT(DISTINCT ${llmColumn("userId")}) AS users
  FROM ${LLM_DATASET}
  WHERE ${since(hours)}${userId ? ` AND ${llmColumn("userId")} = ${sqlString(userId)}` : ""}`;
}

export interface LlmFacetRow {
  model: string;
  operation: string;
  surface: string;
  effort: string;
  status: string;
  calls: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  latencySum: number;
}

/**
 * One query that answers five panels.
 *
 * Totals and the model / operation / surface / effort breakdowns used to be
 * five separate round trips. Grouping by all four dimensions at once and
 * folding them in JS costs one query instead, which is what keeps the
 * dashboard under the SQL API's rate limit. The grouping key is small by
 * construction (a couple of models × ~8 operations × 2 surfaces × a few
 * efforts × 3 statuses), so the row count stays in the low hundreds.
 */
export function llmFacetsSql(hours: number, userId?: string): string {
  const cols = ["model", "operation", "surface", "effort", "status"] as const;
  const select = cols.map((c) => `${llmColumn(c)} AS ${c}`).join(", ");
  return `SELECT
    ${select},
    ${CALLS},
    ${weighted(llmColumn("costUsd"), "cost")},
    ${weighted(llmColumn("inputTokens"), "inputTokens")},
    ${weighted(llmColumn("outputTokens"), "outputTokens")},
    ${weighted(llmColumn("reasoningTokens"), "reasoningTokens")},
    ${weighted(llmColumn("cachedInputTokens"), "cachedInputTokens")},
    ${weighted(llmColumn("latencyMs"), "latencySum")}
  FROM ${LLM_DATASET}
  WHERE ${since(hours)}${userId ? ` AND ${llmColumn("userId")} = ${sqlString(userId)}` : ""}
  GROUP BY ${cols.join(", ")}
  ORDER BY calls DESC
  LIMIT 1000`;
}

export interface LlmGroupRow {
  label: string;
  calls: number;
  cost: number;
  outputTokens: number;
  reasoningTokens: number;
  latencySum: number;
  errors: number;
}

/** Calls grouped by any LLM blob (model, operation, effort, country, …). */
export function llmGroupSql(
  field: (typeof LLM_BLOBS)[number],
  hours: number,
  limit = 20,
  userId?: string
): string {
  const col = llmColumn(field);
  return `SELECT
    ${col} AS label,
    ${CALLS},
    ${weighted(llmColumn("costUsd"), "cost")},
    ${weighted(llmColumn("outputTokens"), "outputTokens")},
    ${weighted(llmColumn("reasoningTokens"), "reasoningTokens")},
    ${weighted(llmColumn("latencyMs"), "latencySum")},
    SUM(if(${llmColumn("status")} = 'error', 1, 0) * _sample_interval) AS errors
  FROM ${LLM_DATASET}
  WHERE ${since(hours)}${userId ? ` AND ${llmColumn("userId")} = ${sqlString(userId)}` : ""}
  GROUP BY label
  ORDER BY calls DESC
  LIMIT ${Math.max(1, Math.min(200, Math.round(limit)))}`;
}

export interface LlmUserRow {
  userId: string;
  plan: string;
  calls: number;
  cost: number;
  outputTokens: number;
  reasoningTokens: number;
  errors: number;
  lastSeen: string;
}

export function llmByUserSql(hours: number, limit = 50): string {
  return `SELECT
    ${llmColumn("userId")} AS userId,
    ${latest(llmColumn("plan"), "plan")},
    ${CALLS},
    ${weighted(llmColumn("costUsd"), "cost")},
    ${weighted(llmColumn("outputTokens"), "outputTokens")},
    ${weighted(llmColumn("reasoningTokens"), "reasoningTokens")},
    SUM(if(${llmColumn("status")} = 'error', 1, 0) * _sample_interval) AS errors,
    MAX(timestamp) AS lastSeen
  FROM ${LLM_DATASET}
  WHERE ${since(hours)}
  GROUP BY userId
  ORDER BY cost DESC, calls DESC
  LIMIT ${Math.max(1, Math.min(200, Math.round(limit)))}`;
}

export interface TimeBucketRow {
  bucket: string;
  calls: number;
  cost: number;
}

/** Hourly for short windows, daily beyond three days — a 90-day chart with
 * hourly buckets is 2160 points of noise. */
export function llmSeriesSql(hours: number, userId?: string): string {
  const h = sqlHours(hours);
  const bucket = h <= 72 ? "toStartOfHour(timestamp)" : "toDate(timestamp)";
  return `SELECT
    ${bucket} AS bucket,
    ${CALLS},
    ${weighted(llmColumn("costUsd"), "cost")}
  FROM ${LLM_DATASET}
  WHERE ${since(hours)}${userId ? ` AND ${llmColumn("userId")} = ${sqlString(userId)}` : ""}
  GROUP BY bucket
  ORDER BY bucket`;
}

export interface LlmErrorRow {
  errorCode: string;
  model: string;
  operation: string;
  calls: number;
}

export function llmErrorsSql(hours: number, limit = 20): string {
  return `SELECT
    ${llmColumn("errorCode")} AS errorCode,
    ${llmColumn("model")} AS model,
    ${llmColumn("operation")} AS operation,
    ${CALLS}
  FROM ${LLM_DATASET}
  WHERE ${since(hours)} AND ${llmColumn("status")} = 'error'
  GROUP BY errorCode, model, operation
  ORDER BY calls DESC
  LIMIT ${Math.max(1, Math.min(100, Math.round(limit)))}`;
}

// ---------------------------------------------------------------- Event SQL

export interface EventGroupRow {
  label: string;
  events: number;
  users: number;
}

export function eventGroupSql(
  field: (typeof EVENT_BLOBS)[number],
  hours: number,
  kind?: string,
  limit = 20,
  userId?: string
): string {
  const col = eventColumn(field);
  const filters = [since(hours)];
  if (kind) filters.push(`${eventColumn("kind")} = ${sqlString(kind)}`);
  if (userId) filters.push(`${eventColumn("userId")} = ${sqlString(userId)}`);
  return `SELECT
    ${col} AS label,
    SUM(_sample_interval) AS events,
    COUNT(DISTINCT ${eventColumn("userId")}) AS users
  FROM ${EVENT_DATASET}
  WHERE ${filters.join(" AND ")}
  GROUP BY label
  ORDER BY events DESC
  LIMIT ${Math.max(1, Math.min(200, Math.round(limit)))}`;
}

export interface EventUserRow {
  userId: string;
  plan: string;
  events: number;
  country: string;
  device: string;
  lastSeen: string;
}

export function eventsByUserSql(hours: number, limit = 50): string {
  return `SELECT
    ${eventColumn("userId")} AS userId,
    ${latest(eventColumn("plan"), "plan")},
    SUM(_sample_interval) AS events,
    ${latest(eventColumn("country"), "country")},
    ${latest(eventColumn("device"), "device")},
    MAX(timestamp) AS lastSeen
  FROM ${EVENT_DATASET}
  WHERE ${since(hours)}
  GROUP BY userId
  ORDER BY events DESC
  LIMIT ${Math.max(1, Math.min(200, Math.round(limit)))}`;
}

export interface ApiRouteRow {
  label: string;
  events: number;
  latencySum: number;
  errors: number;
}

export function apiRoutesSql(hours: number, limit = 25): string {
  return `SELECT
    ${eventColumn("name")} AS label,
    SUM(_sample_interval) AS events,
    ${weighted(eventColumn("durationMs"), "latencySum")},
    SUM(if(${eventColumn("status")} >= '400', 1, 0) * _sample_interval) AS errors
  FROM ${EVENT_DATASET}
  WHERE ${since(hours)} AND ${eventColumn("kind")} = 'api'
  GROUP BY label
  ORDER BY events DESC
  LIMIT ${Math.max(1, Math.min(100, Math.round(limit)))}`;
}

export interface ExtensionFunnelRow {
  label: string;
  events: number;
}

/** The pre-existing extension funnel dataset writes blob1 = event name. */
export function extensionFunnelSql(hours: number): string {
  return `SELECT
    blob1 AS label,
    SUM(_sample_interval) AS events
  FROM ${EXTENSION_DATASET}
  WHERE ${since(hours)}
  GROUP BY label
  ORDER BY events DESC
  LIMIT 50`;
}

/** AE returns numeric aggregates as strings over the JSON API. */
export function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const LLM_FIELDS = LLM_BLOBS;
export const LLM_METRICS = LLM_DOUBLES;
export const EVENT_FIELDS = EVENT_BLOBS;
export const EVENT_METRICS = EVENT_DOUBLES;


// ------------------------------------------------------ Transcription (avc_transcribe)
//
// Written by the avc-api Worker (backend/src/telemetry.ts). Listening Mode was
// previously invisible here: it runs in a different Worker that had no dataset,
// so the dashboard's spend figures excluded the product's most expensive unit.

export interface TranscribeTotalsRow {
  calls: number;
  audioMinutes: number;
  cost: number;
  latencySum: number;
  segments: number;
  providerCalls: number;
  providerMinutes: number;
  hits: number;
  errors: number;
  capHits: number;
  users: number;
}

/**
 * One row of totals for the window.
 *
 * `providerCalls` is the paid subset and `hits` is the cached subset, so the
 * hit rate has a real denominator. Minutes are split the same way: total
 * minutes is how much audio learners ran through Listening Mode, while
 * `providerMinutes` is what was actually billable.
 */
export function transcribeTotalsSql(hours: number, userId?: string): string {
  const outcome = transcribeColumn("outcome");
  const status = transcribeColumn("status");
  const provider = `${outcome} = 'provider_call'`;
  const cached = `${outcome} IN ('cache_hit', 'peer_hit')`;
  return `SELECT
    ${CALLS},
    ${weighted(transcribeColumn("audioMinutes"), "audioMinutes")},
    ${weighted(transcribeColumn("costUsd"), "cost")},
    ${weighted(transcribeColumn("latencyMs"), "latencySum")},
    ${weighted(transcribeColumn("segments"), "segments")},
    ${countIf(provider, "providerCalls")},
    ${weightedIf(provider, transcribeColumn("audioMinutes"), "providerMinutes")},
    ${countIf(cached, "hits")},
    ${countIf(`${status} = 'error'`, "errors")},
    ${countIf(`${outcome} = 'cap_exceeded'`, "capHits")},
    COUNT(DISTINCT ${transcribeColumn("userId")}) AS users
  FROM ${TRANSCRIBE_DATASET}
  WHERE ${since(hours)}${userId ? ` AND ${transcribeColumn("userId")} = ${sqlString(userId)}` : ""}`;
}

export interface TranscribeGroupRow {
  label: string;
  calls: number;
  audioMinutes: number;
  cost: number;
  latencySum: number;
  errors: number;
}

/** Transcriptions grouped by any blob (outcome, provider, language, plan, …). */
export function transcribeGroupSql(
  field: Parameters<typeof transcribeColumn>[0],
  hours: number,
  limit = 20
): string {
  const col = transcribeColumn(field);
  return `SELECT
    ${col} AS label,
    ${CALLS},
    ${weighted(transcribeColumn("audioMinutes"), "audioMinutes")},
    ${weighted(transcribeColumn("costUsd"), "cost")},
    ${weighted(transcribeColumn("latencyMs"), "latencySum")},
    ${countIf(`${transcribeColumn("status")} = 'error'`, "errors")}
  FROM ${TRANSCRIBE_DATASET}
  WHERE ${since(hours)}
  GROUP BY label
  ORDER BY calls DESC
  LIMIT ${Math.max(1, Math.floor(limit))}`;
}

export interface TranscribeUserRow {
  userId: string;
  plan: string;
  calls: number;
  audioMinutes: number;
  cost: number;
  /** Highest running monthly total seen, i.e. how close to the plan cap. */
  peakMonthMinutes: number;
}

/**
 * Heaviest listeners, with how close each came to their monthly cap.
 *
 * `monthMinutesAfter` is the running total the writer stamped on each row, so
 * MAX over the window is the closest that user got to the ceiling. That is the
 * number that tells you whether a cap is about to cut off your best user.
 */
export function transcribeByUserSql(hours: number, limit = 25): string {
  return `SELECT
    ${transcribeColumn("userId")} AS userId,
    ${latest(transcribeColumn("plan"), "plan")},
    ${CALLS},
    ${weighted(transcribeColumn("audioMinutes"), "audioMinutes")},
    ${weighted(transcribeColumn("costUsd"), "cost")},
    MAX(${transcribeColumn("monthMinutesAfter")}) AS peakMonthMinutes
  FROM ${TRANSCRIBE_DATASET}
  WHERE ${since(hours)}
  GROUP BY userId
  ORDER BY audioMinutes DESC
  LIMIT ${Math.max(1, Math.floor(limit))}`;
}

export interface TranscribeSeriesRow {
  bucket: string;
  calls: number;
  audioMinutes: number;
  cost: number;
}

/** Daily transcription volume, for the trend chart. */
export function transcribeSeriesSql(hours: number): string {
  return `SELECT
    toStartOfInterval(timestamp, INTERVAL '1' DAY) AS bucket,
    ${CALLS},
    ${weighted(transcribeColumn("audioMinutes"), "audioMinutes")},
    ${weighted(transcribeColumn("costUsd"), "cost")}
  FROM ${TRANSCRIBE_DATASET}
  WHERE ${since(hours)}
  GROUP BY bucket
  ORDER BY bucket`;
}

// ---------------------------------------------------------- Distinct-user fixes
//
// `Totals.users` was declared but never populated, so the dashboard rendered
// "0 distinct users" next to a five-figure call count. AE does support
// COUNT(DISTINCT ...) — the bug was that the facets query (which is grouped)
// never selected it, and summing per-group distinct counts would double-count
// anyone who appears in two groups anyway. Hence a dedicated ungrouped query.

/** Distinct users who made an LLM call in the window. */
export function llmDistinctUsersSql(hours: number, userId?: string): string {
  const col = llmColumn("userId");
  return `SELECT COUNT(DISTINCT ${col}) AS users
  FROM ${LLM_DATASET}
  WHERE ${since(hours)} AND ${col} != '' AND ${col} != 'anon'${
    userId ? ` AND ${col} = ${sqlString(userId)}` : ""
  }`;
}

/** Distinct identified users seen in the event stream in the window. */
export function eventDistinctUsersSql(hours: number, userId?: string): string {
  const col = eventColumn("userId");
  return `SELECT COUNT(DISTINCT ${col}) AS users
  FROM ${EVENT_DATASET}
  WHERE ${since(hours)} AND ${col} != '' AND ${col} != 'anon'${
    userId ? ` AND ${col} = ${sqlString(userId)}` : ""
  }`;
}

export interface DistinctUsersRow {
  users: number;
}

// ------------------------------------------------------------- Cache panels
//
// /owner used to carry ONE cache number (the AI coach's response cache) under a
// label that implied it measured the anime-context cache. Two different caches,
// two different economics, one figure — so the panel was confidently wrong
// about whichever one you thought you were reading (#113). They are separate
// queries now, and the third cache number (LLM prompt caching) is computed on
// the dashboard from cachedInputTokens / inputTokens, which the totals already
// carry.

export interface CacheOutcomeRow {
  hits: number;
  misses: number;
}

/**
 * Anime-context cache hit rate, from the feature rows the route writes.
 *
 * Hits and misses are counted in one pass rather than as a share of all
 * requests, because a request that errored before reaching the cache is
 * neither and must not land in the denominator.
 */
export function animeContextCacheSql(
  hours: number,
  userId?: string,
  event = "anime_context"
): string {
  const status = eventColumn("status");
  const filters = [
    since(hours),
    `${eventColumn("kind")} = 'feature'`,
    `${eventColumn("name")} = ${sqlString(event)}`,
  ];
  // The drill-down view is one learner's telemetry; an unfiltered panel there
  // shows everyone's numbers under a heading that says otherwise.
  if (userId) filters.push(`${eventColumn("userId")} = ${sqlString(userId)}`);
  return `SELECT
    ${countIf(`${status} = 'hit'`, "hits")},
    ${countIf(`${status} = 'miss'`, "misses")}
  FROM ${EVENT_DATASET}
  WHERE ${filters.join("\n    AND ")}`;
}

export interface FeatureEventRow {
  label: string;
  events: number;
  /** Distinct userIds INCLUDING the single "anon" bucket — see below. */
  users: number;
  /** Rows written without an identity, so the caller can discount that bucket. */
  anonEvents: number;
}

/**
 * Learning-loop feature events, with how many distinct learners fired each.
 *
 * The per-event user count is the whole point: 400 `card_shown` rows from one
 * insomniac and 400 from forty learners are the same number on a volume chart
 * and completely different products.
 *
 * The writer stores "anon" rather than an empty string for an unidentified
 * row, so COUNT(DISTINCT userId) counts all anonymous traffic as one extra
 * user. Filtering it inside the aggregate would need IF(..., NULL), and AE
 * rejects a mixed-type IF outright (see the countIf/weightedIf note above) —
 * which fails the whole panel rather than the one column. So the anon bucket
 * is reported alongside and subtracted by the caller.
 */
export function featureEventsSql(hours: number, userId?: string, limit = 30): string {
  const userCol = eventColumn("userId");
  const names = LEARNING_LOOP_EVENTS.map(sqlString).join(", ");
  const filters = [
    since(hours),
    `${eventColumn("kind")} = 'feature'`,
    // Restricted to the learning loop. `feature` also carries acquisition
    // events and the anime-context cache probe, and a panel that mixed a
    // marketing click into "cards accepted per learner" would be answering a
    // different question than its heading asks.
    `${eventColumn("name")} IN (${names})`,
  ];
  if (userId) filters.push(`${userCol} = ${sqlString(userId)}`);
  return `SELECT
    ${eventColumn("name")} AS label,
    SUM(_sample_interval) AS events,
    COUNT(DISTINCT ${userCol}) AS users,
    ${countIf(`${userCol} = 'anon' OR ${userCol} = ''`, "anonEvents")}
  FROM ${EVENT_DATASET}
  WHERE ${filters.join("\n    AND ")}
  GROUP BY label
  ORDER BY events DESC
  LIMIT ${Math.max(1, Math.min(200, Math.round(limit)))}`;
}
