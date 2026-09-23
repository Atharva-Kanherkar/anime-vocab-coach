// AI insights for /owner: "what should I do about this window's numbers".
//
// Reuses the OpenAI plumbing from ai-coach.ts (error shaping, usage parsing,
// reasoning-model tuning) rather than duplicating it. The digest builder is
// pure and takes exactly the data the dashboard already rendered — the model
// sees every panel on the page for the selected window, nothing it didn't.

import { completionTuning, openAiHttpError, type UsageSink } from "./ai-coach";
import { parseUsage } from "./llm-pricing";
import {
  fmtInt,
  fmtMs,
  fmtPct,
  fmtUsd,
  type GroupRow,
  type OwnerDashboardData,
  type SeriesPoint,
  type SimpleRow,
  type WindowOption,
} from "./owner-dashboard";
import type { OwnerHistory } from "./owner-history";

export interface OwnerInsights {
  summary: string;
  insights: string[];
  actions: string[];
}

const SYSTEM_PROMPT =
  "You are a product analyst reviewing the internal owner dashboard for AnimeVocab, a solo-built " +
  "anime vocabulary learning app monetized through paid tiers (free/pro/max) plus OpenAI-backed AI " +
  "features (coach explanations, memory hooks, chat, Listening Mode transcription). You are given a " +
  "plain-text digest of every panel visible on the dashboard for one time window. " +
  "Ground every claim ONLY in the numbers given — never invent a figure that isn't there, and say so " +
  "when a section has no data rather than guessing. Prefer specific, surprising, or actionable " +
  "observations over restating the obvious. The free tier is intentionally generous and staying that " +
  "way is non-negotiable — never suggest shrinking free limits to control cost; if spend looks high, " +
  "point at caching, model choice, error retries, or paid-tier upsell instead. " +
  'Respond only as strict JSON: {"summary": string, "insights": string[], "actions": string[]}. ' +
  "`summary` is 1-2 sentences on the overall state of this window. `insights` is 3-6 short bullet " +
  "observations (each under 25 words) about what the numbers show. `actions` is 3-6 short imperative " +
  "next steps (each under 20 words), concrete and specific to this data, not generic advice.";

const take = <T>(rows: T[], n: number): T[] => rows.slice(0, n);

function groupLines(rows: GroupRow[], n = 6): string {
  if (!rows.length) return "  (none)";
  return take(rows, n)
    .map((r) => {
      const errRate = r.calls > 0 ? r.errors / r.calls : 0;
      return `  - ${r.label}: ${fmtInt(r.calls)} calls, ${fmtUsd(r.cost)}, ${fmtPct(errRate)} errors, ${fmtMs(r.avgLatencyMs)} avg latency`;
    })
    .join("\n");
}

function simpleLines(rows: SimpleRow[], n = 6, unit = ""): string {
  if (!rows.length) return "  (none)";
  return take(rows, n)
    .map((r) => {
      const users = typeof r.secondary === "number" && r.secondary > 0 ? ` (${fmtInt(r.secondary)} users)` : "";
      return `  - ${r.label}: ${fmtInt(r.value)}${unit ? ` ${unit}` : ""}${users}`;
    })
    .join("\n");
}

/** O(1)-size trend summary regardless of window length, so a 90-day daily
 * series costs the same tokens as a 6-hour hourly one. */
function seriesSummary(points: SeriesPoint[]): string {
  if (!points.length) return "  (no data)";
  const total = points.reduce((sum, p) => sum + p.calls, 0);
  const peak = points.reduce((m, p) => (p.calls > m.calls ? p : m), points[0]!);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const trend = first.calls > 0 ? ((last.calls - first.calls) / first.calls) * 100 : null;
  const trendNote = trend !== null ? ` (${trend >= 0 ? "+" : ""}${trend.toFixed(0)}% vs first bucket)` : "";
  return [
    `  ${points.length} buckets, ${fmtInt(total)} calls total`,
    `  first ${first.bucket}: ${fmtInt(first.calls)} calls`,
    `  last ${last.bucket}: ${fmtInt(last.calls)} calls${trendNote}`,
    `  peak ${peak.bucket}: ${fmtInt(peak.calls)} calls`,
  ].join("\n");
}

/**
 * Render exactly what the dashboard shows for this window into plain text.
 *
 * One section per panel, in the same order they appear on the page, so a
 * digest and a screenshot of the page would read the same. Every list is
 * capped so the prompt stays a bounded size no matter how large the window or
 * how many users/pages/models are behind it.
 */
export function buildInsightsDigest(
  win: WindowOption,
  data: OwnerDashboardData,
  history: OwnerHistory | null,
  focusUser?: string
): string {
  const t = data.totals;
  const tx = data.transcribe;
  const ctx = data.animeContextCache;
  const lines: string[] = [];

  lines.push(
    `Window: last ${win.label}${focusUser ? ` · single user ${focusUser}` : " · all users"}. All times UTC.`
  );

  lines.push("\n## LLM usage");
  lines.push(
    `  ${fmtInt(t.calls)} calls · ${fmtInt(t.users)} distinct users · ${fmtUsd(t.cost)} spend` +
      (t.calls > 0 ? ` (${fmtUsd(t.cost / t.calls)}/call)` : "")
  );
  lines.push(`  error rate ${fmtPct(t.errorRate)} (${fmtInt(t.errors)} failed) · avg latency ${fmtMs(t.avgLatencyMs)}`);
  lines.push(
    `  coach response cache hit rate ${fmtPct(t.cacheHitRate)} (${fmtInt(t.cachedHits)} free replies) · ` +
      `LLM prompt cache ${t.inputTokens > 0 ? fmtPct(t.cachedInputTokens / t.inputTokens) : "n/a, no input tokens"}`
  );
  lines.push(
    `  anime-context cache: ${
      ctx.present
        ? `${fmtPct(ctx.hitRate)} hit rate (${fmtInt(ctx.hits)} hits / ${fmtInt(ctx.misses)} paid lookups)`
        : "no lookups in this window"
    }`
  );
  lines.push(
    `  reasoning tokens ${fmtInt(t.reasoningTokens)}` +
      (t.outputTokens > 0 ? ` (${fmtPct(t.reasoningTokens / t.outputTokens)} of output tokens)` : "")
  );

  lines.push("\n## Calls over time");
  lines.push(seriesSummary(data.series));

  lines.push("\n## By model");
  lines.push(groupLines(data.byModel));
  lines.push("\n## By operation");
  lines.push(groupLines(data.byOperation));
  lines.push("\n## By surface");
  lines.push(groupLines(data.bySurface));
  if (data.byEffort.length) {
    lines.push("\n## By reasoning effort");
    lines.push(groupLines(data.byEffort));
  }

  if (data.errors.length) {
    lines.push("\n## Top errors");
    lines.push(
      take(data.errors, 8)
        .map((e) => `  - ${e.errorCode} (op ${e.operation}, model ${e.model}): ${fmtInt(e.calls)}`)
        .join("\n")
    );
  }

  if (!focusUser && data.topUsers.length) {
    lines.push("\n## Top users by spend");
    lines.push(
      take(data.topUsers, 8)
        .map(
          (u) =>
            `  - ${u.email || u.userId} (${u.plan}): ${fmtUsd(u.cost)}, ${fmtInt(u.calls)} calls, ${fmtInt(u.errors)} errors`
        )
        .join("\n")
    );
  }

  lines.push("\n## Traffic");
  lines.push(`  ${fmtInt(data.eventUserCount)} distinct identified users seen on site`);
  lines.push("  Top pages:\n" + simpleLines(data.pages, 6, "views"));
  lines.push("  Countries:\n" + simpleLines(data.countries, 6));
  lines.push("  Referrers:\n" + simpleLines(data.referrers, 6));
  lines.push("  Devices:\n" + simpleLines(data.devices));

  if (!focusUser && data.extensionFunnel.length) {
    lines.push("\n## Extension install funnel");
    lines.push(simpleLines(data.extensionFunnel, 10));
  }

  if (data.learningLoop.length) {
    lines.push("\n## Learning loop (product engagement, not traffic)");
    lines.push(
      data.learningLoop
        .map(
          (r) =>
            `  - ${r.label}: ${fmtInt(r.events)} events, ${fmtInt(r.users)} learners, ` +
            `${r.users > 0 ? (r.identifiedEvents / r.users).toFixed(1) : "—"} per learner, ${fmtInt(r.anonEvents)} anonymous`
        )
        .join("\n")
    );
  }

  if (data.extensionBuilds.length) {
    // #159: without this the model sees a near-empty learning loop and blames
    // the product, when the real cause was a store package too old to report.
    lines.push("\n## Extension builds sending learning-loop events");
    lines.push(
      data.extensionBuilds
        .map((r) => `  - ${r.label}: ${fmtInt(r.events)} events, ${fmtInt(r.users)} learners`)
        .join("\n")
    );
  }

  if (data.apiRoutes.length) {
    lines.push("\n## API routes");
    lines.push(
      take(data.apiRoutes, 8)
        .map((r) => `  - ${r.label}: ${fmtInt(r.events)} calls, ${fmtMs(r.avgLatencyMs)} avg, ${fmtInt(r.errors)} 4xx/5xx`)
        .join("\n")
    );
  }

  lines.push("\n## Listening Mode (transcription, separate Worker)");
  if (!tx.present) {
    lines.push("  no transcription recorded in this window");
  } else {
    lines.push(
      `  ${fmtInt(tx.calls)} chunks · ${fmtInt(tx.users)} users · cache hit rate ${fmtPct(tx.hitRate)} · ` +
        `spend ${fmtUsd(tx.cost)} · avg latency ${fmtMs(tx.avgLatencyMs)} · cap rejections ${fmtInt(tx.capHits)} · errors ${fmtInt(tx.errors)}`
    );
  }

  if (history?.available) {
    lines.push("\n## All-time (Clerk + KV, not windowed by the period above)");
    lines.push(
      `  ${history.totalUsers ?? "n/a"} total signups · ${history.activeLast30 ?? "n/a"} active in last 30d · ` +
        `${history.neverActive ?? "n/a"} signed up and never used the product`
    );
    if (history.activationRate !== null) {
      lines.push(`  activation (signup → linked the extension): ${fmtPct(history.activationRate)}`);
    }
  }

  if (data.queryError) {
    lines.push(`\nNote: some panels failed to load for this render (${data.queryError}). Treat those as unknown, not zero.`);
  }

  return lines.join("\n");
}

function cleanStringList(value: unknown, max: number, maxLen = 220): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim().slice(0, maxLen))
    .slice(0, max);
}

/** Call OpenAI for one window's insights. Throws on transport/HTTP error,
 * mirroring runCoach's contract so callers handle both the same way. */
export async function runOwnerInsights(
  apiKey: string,
  model: string,
  digest: string,
  onUsage?: UsageSink
): Promise<OwnerInsights> {
  const startedAt = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: digest },
      ],
      response_format: { type: "json_object" },
      ...completionTuning(model, { temperature: 0.3, maxTokens: 700 }),
    }),
  });

  if (!res.ok) throw await openAiHttpError(res, "owner_insights");

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: unknown;
  };
  onUsage?.(parseUsage(data.usage), Date.now() - startedAt);

  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("openai_bad_json");
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 400) : "";
  const insights = cleanStringList(parsed.insights, 8);
  const actions = cleanStringList(parsed.actions, 8);
  if (!summary && insights.length === 0 && actions.length === 0) throw new Error("openai_empty");

  return { summary, insights, actions };
}
