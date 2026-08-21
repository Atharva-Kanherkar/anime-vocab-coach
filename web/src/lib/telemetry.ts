// Observability write path → Cloudflare Analytics Engine.
//
// Two datasets (see telemetry-schema.ts for the column layout):
//   avc_llm     — one row per model invocation: model, operation, tokens,
//                 reasoning tokens, cost, latency, outcome, who, from where.
//   avc_events  — one row per pageview / API call / feature invocation.
//
// Everything here is best-effort and MUST NOT be able to fail a user request:
// writeDataPoint is fire-and-forget, and every entry point swallows its own
// errors. Telemetry that can 500 the product is worse than no telemetry.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  EVENT_BLOBS,
  EVENT_DOUBLES,
  LLM_BLOBS,
  LLM_DOUBLES,
} from "./telemetry-schema";
import { estimateCostUsd, type TokenUsage } from "./llm-pricing";

export interface AnalyticsEngineDataset {
  writeDataPoint(event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

interface TelemetryEnv {
  LLM_AE?: AnalyticsEngineDataset;
  EVENTS_AE?: AnalyticsEngineDataset;
}

let testLlmAe: AnalyticsEngineDataset | null = null;
let testEventsAe: AnalyticsEngineDataset | null = null;

/** Test-only: capture writes without a Cloudflare binding. */
export function setTelemetrySinksForTests(
  llm: AnalyticsEngineDataset | null,
  events: AnalyticsEngineDataset | null
): void {
  testLlmAe = llm;
  testEventsAe = events;
}

async function cfEnv(): Promise<TelemetryEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as TelemetryEnv;
  } catch {
    return {};
  }
}

/** AE caps a blob list at 5120 bytes total; bound each field so one long
 * referrer or error string can't silently drop the whole data point. */
const MAX_BLOB_LEN = 256;

function blob(value: string | null | undefined): string {
  if (!value) return "";
  return value.length > MAX_BLOB_LEN ? value.slice(0, MAX_BLOB_LEN) : value;
}

function finite(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------- LLM calls

export type LlmStatus = "ok" | "error" | "cached";
export type LlmSurface = "web" | "extension" | "server";

export interface LlmCallRecord {
  model: string;
  /** What the call was for: explain | hooks | chat | chat_stream | … */
  operation: string;
  status: LlmStatus;
  userId?: string | null;
  plan?: string | null;
  /** Provider error code (openai_429, openai_bad_json) — "" when ok. */
  errorCode?: string | null;
  effort?: string | null;
  country?: string | null;
  surface?: LlmSurface;
  direction?: string | null;
  usage?: TokenUsage | null;
  /** Overrides the computed cost. Used for cached hits (always 0). */
  costUsd?: number;
  latencyMs?: number;
}

/** Who/where, threaded from a route into a library that makes its own
 * provider call (the background "auto" ones). */
export interface LlmContext {
  userId?: string | null;
  plan?: string | null;
  country?: string | null;
  surface?: LlmSurface;
  direction?: string | null;
}

export async function recordLlmCall(record: LlmCallRecord): Promise<void> {
  try {
    const ae = testLlmAe ?? (await cfEnv()).LLM_AE;
    if (!ae) return;

    const usage = record.usage ?? null;
    const cost =
      record.costUsd ?? (usage ? estimateCostUsd(record.model, usage) : 0);

    const values: Record<(typeof LLM_BLOBS)[number], string> = {
      model: record.model,
      operation: record.operation,
      userId: record.userId || "anon",
      plan: record.plan || "unknown",
      status: record.status,
      errorCode: record.errorCode || "",
      effort: record.effort || "",
      country: record.country || "",
      surface: record.surface || "web",
      direction: record.direction || "",
    };
    const numbers: Record<(typeof LLM_DOUBLES)[number], number> = {
      inputTokens: finite(usage?.inputTokens),
      outputTokens: finite(usage?.outputTokens),
      reasoningTokens: finite(usage?.reasoningTokens),
      cachedInputTokens: finite(usage?.cachedInputTokens),
      costUsd: finite(cost),
      latencyMs: finite(record.latencyMs),
    };

    ae.writeDataPoint({
      blobs: LLM_BLOBS.map((k) => blob(values[k])),
      doubles: LLM_DOUBLES.map((k) => numbers[k]),
      // The index is AE's sampling key. Model is low-cardinality and is the
      // primary group-by on the dashboard, so sampling (if it ever kicks in)
      // degrades evenly per model instead of hiding one model entirely.
      indexes: [blob(record.model).slice(0, 96)],
    });
  } catch {
    // Telemetry must never break the request it is observing.
  }
}

// -------------------------------------------------------------- User events

export type EventKind = "pageview" | "api" | "feature" | "auth";

export interface UserEventRecord {
  kind: EventKind;
  /** Path for a pageview, route for an api call, action name for a feature. */
  name: string;
  userId?: string | null;
  plan?: string | null;
  country?: string | null;
  city?: string | null;
  referrerHost?: string | null;
  device?: string | null;
  /** How the caller authenticated: clerk | sync_token | dev | none. */
  authKind?: string | null;
  /** HTTP status, or a short outcome tag. */
  status?: string | number | null;
  durationMs?: number;
}

export async function recordUserEvent(record: UserEventRecord): Promise<void> {
  try {
    const ae = testEventsAe ?? (await cfEnv()).EVENTS_AE;
    if (!ae) return;

    const values: Record<(typeof EVENT_BLOBS)[number], string> = {
      kind: record.kind,
      name: record.name,
      userId: record.userId || "anon",
      plan: record.plan || "unknown",
      country: record.country || "",
      city: record.city || "",
      referrerHost: record.referrerHost || "",
      device: record.device || "",
      authKind: record.authKind || "none",
      status: record.status === null || record.status === undefined ? "" : String(record.status),
    };
    const numbers: Record<(typeof EVENT_DOUBLES)[number], number> = {
      durationMs: finite(record.durationMs),
    };

    ae.writeDataPoint({
      blobs: EVENT_BLOBS.map((k) => blob(values[k])),
      doubles: EVENT_DOUBLES.map((k) => numbers[k]),
      indexes: [blob(record.kind).slice(0, 96)],
    });
  } catch {
    // As above: never throw into the request path.
  }
}

/** Our own hosts. A referrer on one of these is an internal navigation, which
 *  is not acquisition data and must not be recorded as a referrer. */
const OWN_HOSTS = new Set(["animevocab.com", "www.animevocab.com", "localhost"]);

/**
 * The external host that sent a visitor here, from a client-reported referrer.
 *
 * Returns "" for same-site navigations, unparseable input, and the empty
 * referrer of a direct visit, so an empty value means "direct or unknown"
 * rather than "our own domain".
 *
 * This exists because the obvious implementation is wrong: reading the
 * `Referer` header of the /api/track beacon reports the page that fired the
 * beacon, which is always ours. That made every pageview self-referred and
 * left the product with no attribution at all.
 *
 * The value is attacker-controlled (any client can POST anything), so it is
 * parsed with the URL parser and reduced to a hostname before storage. AE
 * blobs are never rendered as HTML, but a bounded, structurally-valid hostname
 * also keeps dashboard cardinality from being trivially poisoned.
 */
export function externalReferrerHost(referrer: string): string {
  const raw = (referrer || "").trim();
  if (!raw) return "";
  let host: string;
  try {
    const url = new URL(raw);
    // Only real web referrers. Anything else (data:, chrome-extension:, file:)
    // is not an acquisition source.
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    host = url.hostname.toLowerCase();
  } catch {
    return "";
  }
  if (!host || OWN_HOSTS.has(host)) return "";
  // Subdomains of our own site are still internal (e.g. a preview deploy).
  if (host.endsWith(".animevocab.com")) return "";
  return host.slice(0, 128);
}

// ------------------------------------------------------------ Request facts

/** Cloudflare request geo/UA facts, safe to call off-Cloudflare (returns
 * empties in local dev rather than throwing). */
export interface RequestFacts {
  country: string;
  city: string;
  referrerHost: string;
  device: string;
}

interface CfProperties {
  country?: string;
  city?: string;
}

export function requestFacts(req: Request): RequestFacts {
  const cf = (req as Request & { cf?: CfProperties }).cf;
  const country = cf?.country || req.headers.get("cf-ipcountry") || "";
  const city = cf?.city || "";

  // NOTE: for the /api/track beacon this is always our own domain, because the
  // beacon is fired from our own pages. Pageview attribution therefore comes
  // from the client-reported referrer via externalReferrerHost(), not from
  // here. This stays for server-side API calls, where the header is the only
  // signal available and a same-origin value is still meaningful.
  const referrerHost = externalReferrerHost(req.headers.get("referer") || "");

  return { country, city, referrerHost, device: deviceClass(req.headers.get("user-agent")) };
}

/**
 * How the caller authenticated, from the request alone.
 *
 * `sync_token` is the extension's credential (see resolveProfile), so it
 * doubles as the surface signal: the same user hitting the coach from the
 * in-page overlay vs the website is the distinction worth seeing on the
 * dashboard.
 */
export function authKindOf(req: Request): "sync_token" | "clerk" | "none" {
  const auth = req.headers.get("authorization") || "";
  if (/^Bearer\s+avc_st_[A-Za-z0-9]+$/.test(auth)) return "sync_token";
  const cookie = req.headers.get("cookie") || "";
  if (cookie.includes("__session") || cookie.includes("__client")) return "clerk";
  return "none";
}

export function surfaceOf(req: Request): LlmSurface {
  return authKindOf(req) === "sync_token" ? "extension" : "web";
}

/** Coarse UA bucket. Deliberately not a UA parser: three buckets are all the
 * dashboard needs, and a full parse is cost per request for no extra insight. */
export function deviceClass(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (/bot|crawler|spider|crawling|headlesschrome|lighthouse/.test(s)) return "bot";
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|android|iphone|ipod/.test(s)) return "mobile";
  return "desktop";
}
