// Data assembly for /owner. Everything here is read-only.
//
// Design note: each panel degrades on its own. A dataset that has never been
// written to does not exist yet in Analytics Engine and the SQL API answers
// with an error rather than an empty result — which is the normal state
// immediately after deploy. So every query is awaited independently and an
// empty panel is rendered instead of failing the whole page.

import {
  apiRoutesSql,
  eventGroupSql,
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
  type ApiRouteRow,
  type EventGroupRow,
  type EventUserRow,
  type ExtensionFunnelRow,
  type LlmErrorRow,
  type LlmGroupRow,
  type LlmTotals,
  type LlmUserRow,
  type TimeBucketRow,
} from "./telemetry-query";
import { isKnownModel } from "./llm-pricing";

export interface WindowOption {
  hours: number;
  label: string;
}

export const WINDOWS: WindowOption[] = [
  { hours: 24, label: "24h" },
  { hours: 24 * 7, label: "7d" },
  { hours: 24 * 30, label: "30d" },
  { hours: 24 * 90, label: "90d" },
];

export function resolveWindow(raw: string | undefined): WindowOption {
  const hours = sqlHours(Number(raw));
  return WINDOWS.find((w) => w.hours === hours) ?? WINDOWS[0]!;
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

export interface OwnerDashboardData {
  configured: boolean;
  /** Present when the SQL API rejected a query — surfaced, never swallowed. */
  queryError: string | null;
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
}

const simple = (rows: EventGroupRow[]): SimpleRow[] =>
  rows.map((r) => ({ label: r.label || "(none)", value: num(r.events), secondary: num(r.users) }));

export async function loadOwnerDashboard(
  hours: number,
  userId?: string
): Promise<OwnerDashboardData> {
  const errors: string[] = [];
  // Each query resolves independently; a failure contributes an empty panel
  // and one line to the error banner.
  async function q<T>(sql: string, label: string): Promise<T[]> {
    const out = await runQuery<T>(sql);
    if (out.ok) return out.rows;
    if (out.reason === "not_configured") throw new Error("not_configured");
    errors.push(`${label}: ${out.detail ?? "failed"}`);
    return [];
  }

  try {
    const [
      totalsRows,
      modelRows,
      operationRows,
      surfaceRows,
      effortRows,
      errorRows,
      seriesRows,
      userRows,
      pageRows,
      countryRows,
      referrerRows,
      deviceRows,
      apiRows,
      eventUserRows,
      funnelRows,
    ] = await Promise.all([
      q<LlmTotals>(llmTotalsSql(hours, userId), "totals"),
      q<LlmGroupRow>(llmGroupSql("model", hours, 20, userId), "by model"),
      q<LlmGroupRow>(llmGroupSql("operation", hours, 20, userId), "by operation"),
      q<LlmGroupRow>(llmGroupSql("surface", hours, 10, userId), "by surface"),
      q<LlmGroupRow>(llmGroupSql("effort", hours, 10, userId), "by effort"),
      q<LlmErrorRow>(llmErrorsSql(hours), "errors"),
      q<TimeBucketRow>(llmSeriesSql(hours, userId), "series"),
      q<LlmUserRow>(llmByUserSql(hours), "top users"),
      q<EventGroupRow>(eventGroupSql("name", hours, "pageview", 25, userId), "pages"),
      q<EventGroupRow>(eventGroupSql("country", hours, undefined, 20, userId), "countries"),
      q<EventGroupRow>(eventGroupSql("referrerHost", hours, "pageview", 15, userId), "referrers"),
      q<EventGroupRow>(eventGroupSql("device", hours, undefined, 6, userId), "devices"),
      q<ApiRouteRow>(apiRoutesSql(hours), "api routes"),
      q<EventUserRow>(eventsByUserSql(hours), "event users"),
      q<ExtensionFunnelRow>(extensionFunnelSql(hours), "extension funnel"),
    ]);

    return {
      configured: true,
      queryError: errors.length ? errors.join(" · ") : null,
      totals: toTotals(totalsRows[0]),
      byModel: toGroupRows(modelRows, true),
      byOperation: toGroupRows(operationRows),
      bySurface: toGroupRows(surfaceRows),
      byEffort: toGroupRows(effortRows),
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
    };
  } catch (err) {
    if (err instanceof Error && err.message === "not_configured") {
      return {
        configured: false,
        queryError: null,
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
      };
    }
    throw err;
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
