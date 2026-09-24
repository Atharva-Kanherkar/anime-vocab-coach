// Data assembly for /owner. Everything here is read-only.
//
// Design note: each panel degrades on its own. A dataset that has never been
// written to does not exist yet in Analytics Engine and the SQL API answers
// with an error rather than an empty result — which is the normal state
// immediately after deploy. So every query is awaited independently and an
// empty panel is rendered instead of failing the whole page.

import {
  QUERY_CONCURRENCY,
  analyticsCredentials,
  apiErrorsSql,
  apiRoutesSql,
  proFunnelSql,
  eventGroupSql,
  llmFacetsSql,
  mapLimit,
  type LlmFacetRow,
  type QueryFailure,
  eventsByUserSql,
  extensionFunnelSql,
  llmByUserSql,
  llmErrorsSql,
  llmGroupSql,
  llmSeriesSql,
  llmTotalsSql,
  num,
  runQuery,
  sqlHours,
  type ApiErrorQueryRow,
  type ProFunnelQueryRow,
  type UserScope,
  type ApiRouteRow,
  type EventGroupRow,
  type EventUserRow,
  type ExtensionFunnelRow,
  type LlmErrorRow,
  type LlmGroupRow,
  type LlmTotals,
  type LlmUserRow,
  type TimeBucketRow,
  animeContextCacheSql,
  eventDistinctUsersSql,
  featureBuildsSql,
  featureEventsSql,
  llmDistinctUsersSql,
  type CacheOutcomeRow,
  type FeatureEventRow,
  transcribeByUserSql,
  transcribeGroupSql,
  transcribeSeriesSql,
  transcribeTotalsSql,
  type DistinctUsersRow,
  type TranscribeGroupRow,
  type TranscribeSeriesRow,
  type TranscribeTotalsRow,
  type TranscribeUserRow,
} from "./telemetry-query";
import { isKnownModel } from "./llm-pricing";

export interface WindowOption {
  hours: number;
  label: string;
}

export const WINDOWS: WindowOption[] = [
  { hours: 6, label: "6h" },
  { hours: 10, label: "10h" },
  { hours: 12, label: "12h" },
  { hours: 24, label: "24h" },
  { hours: 24 * 7, label: "7d" },
  { hours: 24 * 30, label: "30d" },
  { hours: 24 * 90, label: "90d" },
];

export function resolveWindow(raw: string | undefined): WindowOption {
  const hours = sqlHours(Number(raw));
  // Fall back to 24h specifically (not WINDOWS[0]) so an `h=` value outside
  // the preset list — anything sqlHours doesn't clamp away — still lands on
  // the historical default instead of silently becoming the newest, shortest
  // preset just because it sorts first in the array.
  return (
    WINDOWS.find((w) => w.hours === hours) ?? WINDOWS.find((w) => w.hours === 24) ?? WINDOWS[0]!
  );
}

export interface Totals {
  calls: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  avgLatencyMs: number;
  errors: number;
  cachedHits: number;
  users: number;
  /** Share of calls served from the response cache, 0..1. */
  cacheHitRate: number;
  errorRate: number;
}

const EMPTY_TOTALS: Totals = {
  calls: 0,
  cost: 0,
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  cachedInputTokens: 0,
  avgLatencyMs: 0,
  errors: 0,
  cachedHits: 0,
  users: 0,
  cacheHitRate: 0,
  errorRate: 0,
};

/** Fold the faceted rows into the totals + one breakdown per dimension. */
export function foldFacets(rows: LlmFacetRow[]): {
  totals: Totals;
  byModel: GroupRow[];
  byOperation: GroupRow[];
  bySurface: GroupRow[];
  byEffort: GroupRow[];
} {
  const totals = { ...EMPTY_TOTALS };
  let latencySum = 0;
  let providerCalls = 0;

  type Acc = { calls: number; cost: number; out: number; reasoning: number; lat: number; errors: number };
  const dims: Record<string, Map<string, Acc>> = {
    model: new Map(),
    operation: new Map(),
    surface: new Map(),
    effort: new Map(),
  };

  for (const r of rows) {
    const calls = num(r.calls);
    const isError = r.status === "error";
    const isCached = r.status === "cached";

    totals.calls += calls;
    totals.cost += num(r.cost);
    totals.inputTokens += num(r.inputTokens);
    totals.outputTokens += num(r.outputTokens);
    totals.reasoningTokens += num(r.reasoningTokens);
    totals.cachedInputTokens += num(r.cachedInputTokens);
    if (isError) totals.errors += calls;
    if (isCached) totals.cachedHits += calls;
    // Cached hits never reach the provider, so they must not dilute latency.
    if (!isCached) {
      latencySum += num(r.latencySum);
      providerCalls += calls;
    }

    for (const [dim, key] of [
      ["model", r.model],
      ["operation", r.operation],
      ["surface", r.surface],
      ["effort", r.effort],
    ] as const) {
      const label = key || "(none)";
      const acc = dims[dim]!.get(label) ?? { calls: 0, cost: 0, out: 0, reasoning: 0, lat: 0, errors: 0 };
      acc.calls += calls;
      acc.cost += num(r.cost);
      acc.out += num(r.outputTokens);
      acc.reasoning += num(r.reasoningTokens);
      acc.lat += num(r.latencySum);
      if (isError) acc.errors += calls;
      dims[dim]!.set(label, acc);
    }
  }

  totals.avgLatencyMs = providerCalls > 0 ? latencySum / providerCalls : 0;
  totals.cacheHitRate = totals.calls > 0 ? totals.cachedHits / totals.calls : 0;
  totals.errorRate = totals.calls > 0 ? totals.errors / totals.calls : 0;

  const toRows = (dim: string, isModel = false): GroupRow[] =>
    [...dims[dim]!.entries()]
      .map(([label, a]) => ({
        label,
        calls: a.calls,
        cost: a.cost,
        outputTokens: a.out,
        reasoningTokens: a.reasoning,
        avgLatencyMs: a.calls > 0 ? a.lat / a.calls : 0,
        errors: a.errors,
        unpricedModel: isModel && label !== "(none)" && !isKnownModel(label),
      }))
      .sort((x, y) => y.calls - x.calls);

  return {
    totals,
    byModel: toRows("model", true),
    byOperation: toRows("operation"),
    bySurface: toRows("surface"),
    byEffort: toRows("effort"),
  };
}

function toTotals(row: LlmTotals | undefined): Totals {
  if (!row) return EMPTY_TOTALS;
  const calls = num(row.calls);
  // Latency is averaged over calls that actually ran: cached hits never touch
  // the provider and would drag a "model latency" number toward zero.
  const provider = Math.max(0, calls - num(row.cachedHits));
  return {
    calls,
    cost: num(row.cost),
    inputTokens: num(row.inputTokens),
    outputTokens: num(row.outputTokens),
    reasoningTokens: num(row.reasoningTokens),
    cachedInputTokens: num(row.cachedInputTokens),
    avgLatencyMs: provider > 0 ? num(row.latencySum) / provider : 0,
    errors: num(row.errors),
    cachedHits: num(row.cachedHits),
    users: num(row.users),
    cacheHitRate: calls > 0 ? num(row.cachedHits) / calls : 0,
    errorRate: calls > 0 ? num(row.errors) / calls : 0,
  };
}

export interface GroupRow {
  label: string;
  calls: number;
  cost: number;
  outputTokens: number;
  reasoningTokens: number;
  avgLatencyMs: number;
  errors: number;
  /** Only meaningful for the model breakdown: cost is a guess without a rate. */
  unpricedModel?: boolean;
}

function toGroupRows(rows: LlmGroupRow[], isModel = false): GroupRow[] {
  return rows.map((r) => {
    const calls = num(r.calls);
    return {
      label: r.label || "(none)",
      calls,
      cost: num(r.cost),
      outputTokens: num(r.outputTokens),
      reasoningTokens: num(r.reasoningTokens),
      avgLatencyMs: calls > 0 ? num(r.latencySum) / calls : 0,
      errors: num(r.errors),
      unpricedModel: isModel && !!r.label && !isKnownModel(r.label),
    };
  });
}

export interface UserRow {
  userId: string;
  plan: string;
  calls: number;
  cost: number;
  outputTokens: number;
  reasoningTokens: number;
  errors: number;
  lastSeen: string;
  email?: string;
}

export interface SeriesPoint {
  bucket: string;
  calls: number;
  cost: number;
}

export interface SimpleRow {
  label: string;
  value: number;
  secondary?: number;
}

/**
 * Collapse per-panel failures into one line.
 *
 * Fifteen panels failing the same way used to print the same JSON error
 * fifteen times, which buried the one fact that mattered. Identical reasons
 * are grouped and the panel names listed once.
 */
export function summarizeFailures(
  failures: { label: string; reason: QueryFailure; detail?: string }[]
): string | null {
  if (!failures.length) return null;
  const byReason = new Map<string, string[]>();
  for (const f of failures) {
    const key = f.reason === "query_failed" ? `${f.reason}: ${f.detail ?? ""}` : f.reason;
    byReason.set(key, [...(byReason.get(key) ?? []), f.label]);
  }
  return [...byReason.entries()]
    .map(([reason, labels]) => `${reason} (${labels.length}: ${labels.join(", ")})`)
    .join(" · ");
}

export interface OwnerDashboardData {
  configured: boolean;
  /** Present when the SQL API rejected a query — surfaced, never swallowed. */
  queryError: string | null;
  /** The token exists but was rejected: a different problem from "no token". */
  authFailed: boolean;
  /** Hit the SQL API's per-account limit even after retries. */
  rateLimited: boolean;
  totals: Totals;
  byModel: GroupRow[];
  byOperation: GroupRow[];
  bySurface: GroupRow[];
  byEffort: GroupRow[];
  errors: { errorCode: string; model: string; operation: string; calls: number }[];
  series: SeriesPoint[];
  topUsers: UserRow[];
  pages: SimpleRow[];
  countries: SimpleRow[];
  referrers: SimpleRow[];
  devices: SimpleRow[];
  apiRoutes: { label: string; events: number; avgLatencyMs: number; errors: number }[];
  eventUsers: { userId: string; plan: string; events: number; country: string; device: string; lastSeen: string }[];
  extensionFunnel: SimpleRow[];
  /** Listening Mode transcription, from the avc-api Worker's own dataset. */
  transcribe: TranscribeSummary;
  /** Distinct identified users seen in the event stream in the window. */
  eventUserCount: number;
  /** Learning-loop `feature` events (#111): card shown, saved, reviewed, … */
  learningLoop: FeatureRow[];
  /** The same events by sending extension build (#159); see featureBuildsSql. */
  extensionBuilds: FeatureRow[];
  /** The anime-context KV cache, which used to have no panel at all (#113). */
  animeContextCache: CacheSummary;
  /** Failed API calls by route, status, auth kind and reason (#160). */
  apiErrors: ApiErrorRow[];
  /** Pro prompts: shown → clicked → checkout, one row per surface (#162). */
  proFunnel: ProFunnelRow[];
}

/** One learning-loop event: how often, and how many learners. */
export interface FeatureRow {
  label: string;
  events: number;
  /** Distinct identified learners; anonymous rows are excluded, not bucketed. */
  users: number;
  anonEvents: number;
  /** `events` minus the anonymous ones — the numerator `users` can divide. */
  identifiedEvents: number;
}

/**
 * A cache panel with its own denominator.
 *
 * `present` is false until the cache has been asked anything in the window,
 * which the UI shows as "no data yet" — distinct from an honest 0% hit rate,
 * and the difference between "the cache is broken" and "nobody watched
 * anything today".
 */
export interface CacheSummary {
  present: boolean;
  hits: number;
  misses: number;
  /** hits / (hits + misses), 0..1. */
  hitRate: number;
}

export const EMPTY_CACHE: CacheSummary = { present: false, hits: 0, misses: 0, hitRate: 0 };

/**
 * Fold the learning-loop rows, discounting the shared anonymous bucket.
 *
 * The writer stores "anon" for an unidentified row, so AE's COUNT(DISTINCT)
 * reports every anonymous learner in the world as one extra user. Left in, a
 * panel showing 1 user and 4,000 card views would be reporting a single
 * insomniac when the truth is "we cannot tell yet".
 */
export function foldFeatureEvents(rows: FeatureEventRow[]): FeatureRow[] {
  return rows
    .filter((r) => r.label)
    .map((r) => {
      const events = num(r.events);
      const anonEvents = num(r.anonEvents);
      return {
        label: r.label,
        events,
        users: Math.max(0, num(r.users) - (anonEvents > 0 ? 1 : 0)),
        anonEvents,
        // Dividing TOTAL events by identified users would charge every
        // anonymous install's activity to the handful of learners who happen
        // to be linked: `install_first_run` is anonymous by definition, so a
        // panel doing that reports dozens of installs per learner.
        identifiedEvents: Math.max(0, events - anonEvents),
      };
    });
}

/** Label for rows from a package too old to send its version (#159). */
export const UNSTAMPED_BUILD = "unstamped (≤ 0.5.6)";

/**
 * Learning-loop rows by build. The empty version is the finding, not noise —
 * foldFeatureEvents drops empty labels, so name it before folding.
 */
export function foldExtensionBuilds(rows: FeatureEventRow[]): FeatureRow[] {
  return foldFeatureEvents(rows.map((r) => ({ ...r, label: r.label || UNSTAMPED_BUILD })));
}

/** Hits over real lookups. No lookups means "not asked yet", not "0% hit rate". */
export function foldCacheOutcome(row: CacheOutcomeRow | undefined): CacheSummary {
  const hits = num(row?.hits);
  const misses = num(row?.misses);
  const lookups = hits + misses;
  return { present: lookups > 0, hits, misses, hitRate: lookups > 0 ? hits / lookups : 0 };
}

/** One bucket of failed API calls: a route, a status, an auth kind, a reason (#160). */
export interface ApiErrorRow {
  route: string;
  status: string;
  /** What the status means from these routes, e.g. "quota or rate limit". */
  meaning: string;
  authKind: string;
  /** Why it failed; UNRECORDED_REASON for rows older than errorCode. */
  reason: string;
  calls: number;
  /** Distinct identified learners; the shared anonymous bucket is not one. */
  users: number;
  anonCalls: number;
  firstSeen: string;
  lastSeen: string;
}

/** The reason on a row written before errorCode existed (#160). */
export const UNRECORDED_REASON = "not recorded";

/**
 * What each status means coming from THESE routes, not the RFC's wording: a
 * 503 here is always ai_not_configured, and a 429 is either an AI meter or a
 * rate limit, which the reason column then says.
 */
const STATUS_MEANINGS = new Map<string, string>([
  ["400", "bad request"],
  ["401", "unauthorized"],
  ["403", "forbidden"],
  ["404", "not found"],
  ["413", "too large"],
  ["429", "quota or rate limit"],
  ["500", "server error"],
  ["502", "upstream failed"],
  ["503", "not configured"],
]);

export function statusMeaning(status: string): string {
  const known = STATUS_MEANINGS.get(status);
  if (known) return known;
  if (/^4\d\d$/.test(status)) return "client error";
  if (/^5\d\d$/.test(status)) return "server error";
  return "unknown";
}

/**
 * Failed-call buckets, readable. Same anonymous-bucket discount as
 * foldFeatureEvents: a dead link's 401 has no user, so without it every
 * all-anonymous row would claim one learner.
 */
export function foldApiErrors(rows: ApiErrorQueryRow[]): ApiErrorRow[] {
  return rows.map((r) => {
    const status = String(r.status ?? "");
    const anonCalls = num(r.anonEvents);
    return {
      route: r.route || "(none)",
      status,
      meaning: statusMeaning(status),
      authKind: r.authKind || "none",
      reason: r.errorCode || UNRECORDED_REASON,
      calls: num(r.events),
      users: Math.max(0, num(r.users) - (anonCalls > 0 ? 1 : 0)),
      anonCalls,
      firstSeen: String(r.firstSeen ?? ""),
      lastSeen: String(r.lastSeen ?? ""),
    };
  });
}

/** One step of the Pro funnel on one surface. */
export interface ProFunnelStep {
  events: number;
  /** Distinct identified learners; the shared anonymous bucket is not one. */
  users: number;
}

/** One Pro prompt surface, shown → clicked → checkout (#162). */
export interface ProFunnelRow {
  surface: string;
  shown: ProFunnelStep;
  clicked: ProFunnelStep;
  checkout: ProFunnelStep;
  /** clicked / shown events, or null when nothing was shown. */
  clickRate: number | null;
  /** checkout / clicked events, or null when nothing was clicked. */
  checkoutRate: number | null;
}

/** The surface label on a Pro row with none (a surface the server did not know). */
export const UNKNOWN_SURFACE = "unknown";

const PRO_STEP: Record<string, "shown" | "clicked" | "checkout"> = {
  pro_prompt_shown: "shown",
  pro_prompt_clicked: "clicked",
  pro_checkout_started: "checkout",
};

/**
 * Pivot surface × step rows into one funnel row per surface.
 *
 * A rate with nothing under it is null, not 0: "no one saw it" and "everyone
 * saw it and nobody clicked" are different findings, and at this traffic a
 * 0% would read as the second.
 */
export function foldProFunnel(rows: ProFunnelQueryRow[]): ProFunnelRow[] {
  const bySurface = new Map<string, ProFunnelRow>();
  for (const r of rows) {
    const step = PRO_STEP[String(r.name ?? "")];
    if (!step) continue;
    const surface = r.surface || UNKNOWN_SURFACE;
    let row = bySurface.get(surface);
    if (!row) {
      row = {
        surface,
        shown: { events: 0, users: 0 },
        clicked: { events: 0, users: 0 },
        checkout: { events: 0, users: 0 },
        clickRate: null,
        checkoutRate: null,
      };
      bySurface.set(surface, row);
    }
    const anon = num(r.anonEvents);
    row[step] = {
      events: row[step].events + num(r.events),
      users: row[step].users + Math.max(0, num(r.users) - (anon > 0 ? 1 : 0)),
    };
  }
  const out = [...bySurface.values()];
  for (const row of out) {
    row.clickRate = row.shown.events > 0 ? row.clicked.events / row.shown.events : null;
    row.checkoutRate = row.clicked.events > 0 ? row.checkout.events / row.clicked.events : null;
  }
  return out.sort(
    (a, b) =>
      b.shown.events - a.shown.events ||
      b.checkout.events - a.checkout.events ||
      a.surface.localeCompare(b.surface)
  );
}

/**
 * Listening Mode roll-up.
 *
 * `minutes` is all audio that passed through Listening Mode; `providerMinutes`
 * is the billable subset, i.e. what a cache miss actually sent to a provider.
 * Keeping both is the difference between "how much are learners listening" and
 * "how much did that cost", which are not the same question.
 */
export interface TranscribeSummary {
  /** No rows at all: the dataset is not written yet (nothing to show, not an error). */
  present: boolean;
  calls: number;
  users: number;
  minutes: number;
  providerMinutes: number;
  providerCalls: number;
  hits: number;
  /** Share of transcription requests served from cache, 0..1. */
  hitRate: number;
  cost: number;
  avgLatencyMs: number;
  errors: number;
  capHits: number;
  byOutcome: SimpleRow[];
  byProvider: SimpleRow[];
  byLanguage: SimpleRow[];
  byPlan: SimpleRow[];
  series: { bucket: string; calls: number; minutes: number; cost: number }[];
  topUsers: { userId: string; plan: string; calls: number; minutes: number; cost: number; peakMonthMinutes: number }[];
}

export const EMPTY_TRANSCRIBE: TranscribeSummary = {
  present: false,
  calls: 0,
  users: 0,
  minutes: 0,
  providerMinutes: 0,
  providerCalls: 0,
  hits: 0,
  hitRate: 0,
  cost: 0,
  avgLatencyMs: 0,
  errors: 0,
  capHits: 0,
  byOutcome: [],
  byProvider: [],
  byLanguage: [],
  byPlan: [],
  series: [],
  topUsers: [],
};

/** What the page renders when there is no read token: every panel empty, and
 * `configured: false` so the UI shows setup steps rather than an error. */
const UNCONFIGURED: OwnerDashboardData = {
  configured: false,
  queryError: null,
  authFailed: false,
  rateLimited: false,
  totals: EMPTY_TOTALS,
  byModel: [],
  byOperation: [],
  bySurface: [],
  byEffort: [],
  errors: [],
  series: [],
  topUsers: [],
  pages: [],
  countries: [],
  referrers: [],
  devices: [],
  apiRoutes: [],
  eventUsers: [],
  extensionFunnel: [],
  transcribe: EMPTY_TRANSCRIBE,
  eventUserCount: 0,
  learningLoop: [],
  extensionBuilds: [],
  animeContextCache: EMPTY_CACHE,
  apiErrors: [],
  proFunnel: [],
};

const simple = (rows: EventGroupRow[]): SimpleRow[] =>
  rows.map((r) => ({ label: r.label || "(none)", value: num(r.events), secondary: num(r.users) }));

export async function loadOwnerDashboard(
  hours: number,
  scope?: UserScope
): Promise<OwnerDashboardData> {
  const failures: { label: string; reason: QueryFailure; detail?: string }[] = [];

  // Resolved once, not per panel: eleven identical credential lookups is
  // waste, and "no token" is a property of the page, not of one query.
  const creds = await analyticsCredentials();
  if (!creds) return UNCONFIGURED;

  // Queries are throttled rather than fanned out: the SQL API rate-limits per
  // account, and firing every panel at once turned most of them into 429s.
  const specs: { label: string; sql: string }[] = [
    { label: "llm facets", sql: llmFacetsSql(hours, scope) },
    { label: "series", sql: llmSeriesSql(hours, scope) },
    { label: "errors", sql: llmErrorsSql(hours, 20, scope) },
    { label: "top users", sql: llmByUserSql(hours, 50, scope) },
    { label: "pages", sql: eventGroupSql("name", hours, "pageview", 25, scope) },
    { label: "countries", sql: eventGroupSql("country", hours, undefined, 20, scope) },
    { label: "referrers", sql: eventGroupSql("referrerHost", hours, "pageview", 15, scope) },
    { label: "devices", sql: eventGroupSql("device", hours, undefined, 6, scope) },
    { label: "api routes", sql: apiRoutesSql(hours, scope) },
    { label: "event users", sql: eventsByUserSql(hours, 50, scope) },
    // No user column in this dataset, so no scope: it always includes us.
    { label: "extension funnel", sql: extensionFunnelSql(hours) },
    // Listening Mode lives in a different Worker's dataset. Until it has been
    // written once the dataset does not exist and the SQL API errors rather
    // than returning zero rows, so these panels must fail independently.
    { label: "transcribe totals", sql: transcribeTotalsSql(hours, scope) },
    { label: "transcribe by outcome", sql: transcribeGroupSql("outcome", hours, 8, scope) },
    { label: "transcribe by provider", sql: transcribeGroupSql("provider", hours, 8, scope) },
    { label: "transcribe by language", sql: transcribeGroupSql("language", hours, 8, scope) },
    { label: "transcribe by plan", sql: transcribeGroupSql("plan", hours, 8, scope) },
    { label: "transcribe series", sql: transcribeSeriesSql(hours, scope) },
    { label: "transcribe users", sql: transcribeByUserSql(hours, 25, scope) },
    // Distinct-user counts: separate ungrouped queries, because summing
    // per-group DISTINCTs double-counts anyone present in two groups.
    { label: "llm distinct users", sql: llmDistinctUsersSql(hours, scope) },
    { label: "event distinct users", sql: eventDistinctUsersSql(hours, scope) },
    // The learning loop (#111) and the cache that had no panel (#113). Both
    // read `feature` rows, which did not exist at all before this work, so
    // both fail independently until the first one is written. Both take the
    // focus user, so the drill-down is one learner's telemetry throughout
    // rather than a page where some panels quietly show everybody.
    { label: "learning loop", sql: featureEventsSql(hours, scope) },
    { label: "anime context cache", sql: animeContextCacheSql(hours, scope) },
    { label: "extension builds", sql: featureBuildsSql(hours, scope) },
    // #160: the same api rows as "api routes", broken down by why they failed.
    // Last in the list so every index above keeps its position.
    { label: "api errors", sql: apiErrorsSql(hours, scope) },
    // #162, appended for the same reason.
    { label: "pro funnel", sql: proFunnelSql(hours, scope) },
  ];

  const outcomes = await mapLimit(specs, QUERY_CONCURRENCY, async (spec) => {
    const out = await runQuery<Record<string, unknown>>(spec.sql, creds);
    if (!out.ok) {
      failures.push({ label: spec.label, reason: out.reason, detail: out.detail });
      return [];
    }
    return out.rows;
  });

  const at = <T>(i: number): T[] => (outcomes[i] ?? []) as T[];

  {
    const facets = foldFacets(at<LlmFacetRow>(0));
    const errorRows = at<LlmErrorRow>(2);
    const seriesRows = at<TimeBucketRow>(1);
    const userRows = at<LlmUserRow>(3);
    const pageRows = at<EventGroupRow>(4);
    const countryRows = at<EventGroupRow>(5);
    const referrerRows = at<EventGroupRow>(6);
    const deviceRows = at<EventGroupRow>(7);
    const apiRows = at<ApiRouteRow>(8);
    const eventUserRows = at<EventUserRow>(9);
    const funnelRows = at<ExtensionFunnelRow>(10);
    const txTotals = at<TranscribeTotalsRow>(11)[0];
    const txOutcome = at<TranscribeGroupRow>(12);
    const txProvider = at<TranscribeGroupRow>(13);
    const txLanguage = at<TranscribeGroupRow>(14);
    const txPlan = at<TranscribeGroupRow>(15);
    const txSeries = at<TranscribeSeriesRow>(16);
    const txUsers = at<TranscribeUserRow>(17);
    const llmUsers = at<DistinctUsersRow>(18)[0];
    const eventUsersCount = at<DistinctUsersRow>(19)[0];
    const featureRows = at<FeatureEventRow>(20);
    const animeCacheRow = at<CacheOutcomeRow>(21)[0];
    const buildRows = at<FeatureEventRow>(22);
    const apiErrorRows = at<ApiErrorQueryRow>(23);
    const proFunnelRows = at<ProFunnelQueryRow>(24);

    const txCalls = num(txTotals?.calls);
    const txHits = num(txTotals?.hits);
    const txGroup = (rows: TranscribeGroupRow[]): SimpleRow[] =>
      rows
        .filter((r) => r.label)
        .map((r) => ({
          label: r.label,
          value: num(r.calls),
          secondary: Math.round(num(r.audioMinutes)),
        }));

    const transcribe: TranscribeSummary = {
      // A dataset that has never been written does not exist, and the SQL API
      // errors on it. No rows means "nothing recorded yet", which the panel
      // shows as a waiting state rather than a row of zeroes.
      present: txCalls > 0,
      calls: txCalls,
      users: num(txTotals?.users),
      minutes: num(txTotals?.audioMinutes),
      providerMinutes: num(txTotals?.providerMinutes),
      providerCalls: num(txTotals?.providerCalls),
      hits: txHits,
      hitRate: txCalls > 0 ? txHits / txCalls : 0,
      cost: num(txTotals?.cost),
      avgLatencyMs: txCalls > 0 ? num(txTotals?.latencySum) / txCalls : 0,
      errors: num(txTotals?.errors),
      capHits: num(txTotals?.capHits),
      byOutcome: txGroup(txOutcome),
      byProvider: txGroup(txProvider),
      byLanguage: txGroup(txLanguage),
      byPlan: txGroup(txPlan),
      series: txSeries.map((r) => ({
        bucket: String(r.bucket),
        calls: num(r.calls),
        minutes: num(r.audioMinutes),
        cost: num(r.cost),
      })),
      topUsers: txUsers.map((r) => ({
        userId: r.userId,
        plan: r.plan,
        calls: num(r.calls),
        minutes: num(r.audioMinutes),
        cost: num(r.cost),
        peakMonthMinutes: num(r.peakMonthMinutes),
      })),
    };

    // `Totals.users` was declared but never assigned, which is why the header
    // read "0 distinct users" next to a four-figure call count.
    const totals = { ...facets.totals, users: num(llmUsers?.users) };

    const learningLoop = foldFeatureEvents(featureRows);
    const extensionBuilds = foldExtensionBuilds(buildRows);
    const animeContextCache = foldCacheOutcome(animeCacheRow);

    return {
      configured: true,
      queryError: summarizeFailures(failures),
      authFailed: failures.some((f) => f.reason === "unauthorized"),
      rateLimited: failures.some((f) => f.reason === "rate_limited"),
      totals,
      byModel: facets.byModel,
      byOperation: facets.byOperation,
      bySurface: facets.bySurface,
      byEffort: facets.byEffort,
      errors: errorRows.map((r) => ({
        errorCode: r.errorCode || "(none)",
        model: r.model,
        operation: r.operation,
        calls: num(r.calls),
      })),
      series: seriesRows.map((r) => ({
        bucket: String(r.bucket),
        calls: num(r.calls),
        cost: num(r.cost),
      })),
      topUsers: userRows.map((r) => ({
        userId: r.userId,
        plan: r.plan,
        calls: num(r.calls),
        cost: num(r.cost),
        outputTokens: num(r.outputTokens),
        reasoningTokens: num(r.reasoningTokens),
        errors: num(r.errors),
        lastSeen: String(r.lastSeen ?? ""),
      })),
      pages: simple(pageRows),
      countries: simple(countryRows),
      referrers: simple(referrerRows),
      devices: simple(deviceRows),
      apiRoutes: apiRows.map((r) => {
        const events = num(r.events);
        return {
          label: r.label || "(none)",
          events,
          avgLatencyMs: events > 0 ? num(r.latencySum) / events : 0,
          errors: num(r.errors),
        };
      }),
      eventUsers: eventUserRows.map((r) => ({
        userId: r.userId,
        plan: r.plan,
        events: num(r.events),
        country: r.country,
        device: r.device,
        lastSeen: String(r.lastSeen ?? ""),
      })),
      extensionFunnel: funnelRows.map((r) => ({ label: r.label, value: num(r.events) })),
      transcribe,
      eventUserCount: num(eventUsersCount?.users),
      learningLoop,
      extensionBuilds,
      animeContextCache,
      apiErrors: foldApiErrors(apiErrorRows),
      proFunnel: foldProFunnel(proFunnelRows),
    };
  }
}

// ------------------------------------------------------------- formatting

export function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 10) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtCompact(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1e6).toFixed(1)}M`;
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`;
}

export function fmtMs(n: number): string {
  if (n <= 0) return "—";
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

/** AE returns timestamps as "2026-08-06 14:00:00". Render them compactly and
 * always in UTC, matching how the queries bucket. */
export function fmtWhen(raw: string): string {
  if (!raw) return "—";
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString().slice(0, 16).replace("T", " ");
}
