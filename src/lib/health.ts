// Extension health: the failures a learner sees as "it just doesn't work".
//
// WHY. On 2026-11-13 a store build on Netflix showed romaji with no English
// and no N5 course for an evening, while every API it calls answered 200.
// The reasons existed in memory (`SubTranslator.lastError`,
// `EpisodeSubs.lastError`, the course service's swallowed fetch errors) and
// went nowhere: no toast for a network failure, nothing in the popup, no row
// in telemetry. A reinstall fixed it and erased the evidence. These rows are
// so the next one arrives with its reason, its site and its build attached.
//
// HOW. Every context calls `recordHealth`. The service worker owns delivery:
// it dedups (one row per name + code + site per window), keeps a small outbox
// in storage.local, and posts to /api/track. The outbox is the point: when the
// failure IS the network to animevocab.com, the row waits until the network
// is back instead of being lost with the request that failed. A content script
// relays to the worker; when the worker does not answer, it writes the outbox
// itself, and when the extension context is gone (an orphaned script after a
// reinstall) it falls back to a beacon, the only channel left.

import { WEB_URL } from "../config";
import { extensionVersion, inServiceWorker } from "./run-context";

/**
 * MIRROR of HEALTH_EVENTS in web/src/lib/track-events.ts. The server drops a
 * name it does not know, so test/health.test.ts pins the two lists.
 */
export const HEALTH_EVENTS = [
  // A translate or translate-batch call came back with an error.
  "subs_english_failed",
  // Watchdog: dual subtitles showed many lines and not one had English, with
  // no error to explain it. Catches the causes nobody thought of.
  "subs_english_missing",
  // The N5 lesson could not be loaded (not "no access", which is an answer).
  "course_load_failed",
  // A content script could not reach the service worker.
  "bg_unreachable",
] as const;

export type HealthEvent = (typeof HEALTH_EVENTS)[number];

/** Where it happened. MIRROR of HEALTH_SITES in web/src/lib/track-events.ts. */
export const HEALTH_SITES = ["netflix", "youtube", "crunchyroll", "generic", "worker", "popup"] as const;

export type HealthSite = (typeof HEALTH_SITES)[number];

export function isHealthEvent(v: unknown): v is HealthEvent {
  return typeof v === "string" && (HEALTH_EVENTS as readonly string[]).includes(v);
}

export function isHealthSite(v: unknown): v is HealthSite {
  return typeof v === "string" && (HEALTH_SITES as readonly string[]).includes(v);
}

/** The relay message from content scripts and extension pages. */
export const HEALTH_MESSAGE = "avc-health";

export const OUTBOX_KEY = "healthOutbox";
export const SENT_KEY = "healthSent";
/** One row per name + code + site per install in this window. */
export const DEDUP_MS = 30 * 60_000;
/** A broken install must not be able to grow storage or flood the dataset. */
export const MAX_OUTBOX = 20;
const MAX_SENT_KEYS = 60;
const MAX_CODE = 48;

export interface HealthItem {
  name: HealthEvent;
  code: string;
  site: HealthSite;
  /** The build that saw it; the worker's own version may differ after an update. */
  v: string;
  at: number;
}

/**
 * An error string as a bounded, low-cardinality code: lowercase, [a-z0-9_.:-],
 * at most 48 characters. A raw `Error.message` from the network stack becomes
 * one of a few known codes rather than free text in the dataset.
 */
export function normalizeHealthCode(raw: unknown): string {
  const text = typeof raw === "string" ? raw : raw instanceof Error ? raw.message || raw.name : "";
  const known = classifyError(text);
  if (known) return known;
  const code = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, MAX_CODE);
  return code || "unknown";
}

/** Browser and runtime error messages, mapped to codes worth grouping by. */
function classifyError(text: string): string | null {
  if (!text) return null;
  if (/extension context invalidated/i.test(text)) return "context_invalidated";
  if (/sign in/i.test(text)) return "not_linked";
  if (/receiving end does not exist|could not establish connection/i.test(text)) return "no_receiver";
  if (/message port closed|message channel closed/i.test(text)) return "port_closed";
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(text)) return "network";
  if (/timeout|timed out|aborterror|the operation was aborted/i.test(text)) return "timeout";
  return null;
}

/** The dedup key; the version is not part of it, so an update does not reset the window. */
export function healthKey(item: Pick<HealthItem, "name" | "code" | "site">): string {
  return `${item.name}|${item.code}|${item.site}`;
}

/**
 * Pure: decide whether `item` is news, and the next outbox and sent-map.
 * Kept free of chrome.* so the rules are tested without a browser.
 */
export function admit(
  item: HealthItem,
  outbox: HealthItem[],
  sent: Record<string, number>,
  now: number
): { admitted: boolean; outbox: HealthItem[]; sent: Record<string, number> } {
  const key = healthKey(item);
  const last = sent[key];
  const queued = outbox.some((o) => healthKey(o) === key);
  if (queued || (typeof last === "number" && now - last < DEDUP_MS)) {
    return { admitted: false, outbox, sent };
  }
  const nextSent: Record<string, number> = { ...sent, [key]: now };
  // Forget old keys, newest kept, so the map stays small.
  const entries = Object.entries(nextSent)
    .filter(([, t]) => now - t < 24 * 3600_000)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SENT_KEYS);
  // Oldest dropped first: the newest failure is the one worth knowing about.
  const nextOutbox = [...outbox, item].slice(-MAX_OUTBOX);
  return { admitted: true, outbox: nextOutbox, sent: Object.fromEntries(entries) };
}

function sanitize(item: Partial<HealthItem>): HealthItem | null {
  if (!isHealthEvent(item.name)) return null;
  return {
    name: item.name,
    code: normalizeHealthCode(item.code),
    site: isHealthSite(item.site) ? item.site : "generic",
    v: typeof item.v === "string" ? item.v.slice(0, 32) : "",
    at: typeof item.at === "number" && Number.isFinite(item.at) ? item.at : Date.now(),
  };
}

async function readState(): Promise<{ outbox: HealthItem[]; sent: Record<string, number> }> {
  const r = await chrome.storage.local.get([OUTBOX_KEY, SENT_KEY]);
  const outbox = Array.isArray(r[OUTBOX_KEY])
    ? (r[OUTBOX_KEY] as Partial<HealthItem>[]).map(sanitize).filter((x): x is HealthItem => !!x)
    : [];
  const rawSent = r[SENT_KEY];
  const sent: Record<string, number> = {};
  if (rawSent && typeof rawSent === "object") {
    for (const [k, t] of Object.entries(rawSent as Record<string, unknown>)) {
      if (typeof t === "number" && Number.isFinite(t)) sent[k] = t;
    }
  }
  return { outbox, sent };
}

// One writer at a time inside a context, so two failures in the same tick do
// not both read the old outbox and one of them vanish.
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = tail.then(fn, fn);
  tail = next.catch(() => {});
  return next;
}

/** Add to the outbox if it is news. Works in any context that has chrome.storage. */
export function enqueueHealth(raw: Partial<HealthItem>): Promise<boolean> {
  const item = sanitize(raw);
  if (!item) return Promise.resolve(false);
  return serial(async () => {
    const state = await readState();
    const next = admit(item, state.outbox, state.sent, Date.now());
    if (!next.admitted) return false;
    await chrome.storage.local.set({ [OUTBOX_KEY]: next.outbox, [SENT_KEY]: next.sent });
    return true;
  });
}

async function syncToken(): Promise<string> {
  try {
    const r = await chrome.storage.local.get(["syncToken"]);
    return typeof r.syncToken === "string" ? r.syncToken : "";
  } catch {
    return "";
  }
}

/** POST one row; true only when the server took it. */
async function post(item: HealthItem, token: string): Promise<boolean> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  try {
    const res = await fetch(WEB_URL + "/api/track", {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "health", name: item.name, code: item.code, surface: item.site, v: item.v }),
      keepalive: true,
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send what the outbox holds (service worker only). Stops at the first item
 * the network refuses, so a dead connection costs one request per flush, and
 * keeps the rest for the next one (the sync alarm, or the next failure).
 */
export function flushHealth(): Promise<number> {
  if (!inServiceWorker()) return Promise.resolve(0);
  return serial(async () => {
    const { outbox } = await readState();
    if (!outbox.length) return 0;
    const token = await syncToken();
    let sent = 0;
    for (const item of outbox) {
      if (!(await post(item, token))) break;
      sent++;
    }
    if (sent) {
      // Re-read: a failure recorded while we were posting must not be lost.
      const now = await readState();
      const done = new Set(outbox.slice(0, sent).map((o) => `${healthKey(o)}|${o.at}`));
      await chrome.storage.local.set({ [OUTBOX_KEY]: now.outbox.filter((o) => !done.has(`${healthKey(o)}|${o.at}`)) });
    }
    return sent;
  });
}

/** Last resort for an orphaned content script: no storage, no worker, one beacon. */
function beacon(item: HealthItem): void {
  try {
    // text/plain keeps it a simple request (no preflight), which is the only
    // kind a page-origin script can still get out; the reply is unreadable
    // and not needed. Anonymous: an orphan cannot read the token.
    navigator.sendBeacon?.(
      WEB_URL + "/api/track",
      new Blob([JSON.stringify({ kind: "health", name: item.name, code: item.code, surface: item.site, v: item.v })], {
        type: "text/plain",
      })
    );
  } catch {
    // nothing left to try
  }
}

/** This build's version, captured early: an orphaned script cannot read it later. */
let VERSION = extensionVersion();
function version(): string {
  if (!VERSION) VERSION = extensionVersion();
  return VERSION;
}

function contextAlive(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * Record a failure from anywhere. Never throws, never blocks the caller:
 * call it as `void recordHealth(...)` from hot paths.
 */
export async function recordHealth(name: HealthEvent, code: unknown, site: HealthSite): Promise<void> {
  const item = sanitize({ name, code: normalizeHealthCode(code), site, v: version(), at: Date.now() });
  if (!item) return;
  try {
    if (inServiceWorker()) {
      if (await enqueueHealth(item)) await flushHealth();
      return;
    }
    if (!contextAlive()) {
      beacon(item);
      return;
    }
    let relayed = false;
    try {
      const res = (await chrome.runtime.sendMessage({ type: HEALTH_MESSAGE, item })) as { ok?: boolean } | undefined;
      relayed = res?.ok === true;
    } catch (err) {
      if (!contextAlive()) {
        beacon(item);
        return;
      }
      // The worker did not answer: that is itself the failure worth knowing.
      void enqueueHealth({ name: "bg_unreachable", code: normalizeHealthCode(err), site, v: version(), at: Date.now() }).catch(() => {});
    }
    // Storage still works when the worker does not; the worker sends it later.
    if (!relayed) await enqueueHealth(item);
  } catch {
    // telemetry must never reach the learner
  }
}

/** Worker side of the relay. */
export async function receiveHealth(raw: unknown): Promise<{ ok: boolean }> {
  const item = sanitize((raw && typeof raw === "object" ? raw : {}) as Partial<HealthItem>);
  if (!item) return { ok: false };
  try {
    if (await enqueueHealth(item)) void flushHealth();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Why English is missing, in words, for the popup's Dual subtitles row. The
 * tab has always known this (`englishError` in its diag) and the popup never
 * said it, so "romaji only" was all a learner could report. "" when there is
 * nothing to say.
 */
export function englishErrorText(code: string | null | undefined): string {
  if (!code) return "";
  if (/quota/.test(code)) return "English paused: this month's limit is used up";
  if (/not_linked|unauthorized/.test(code)) return "Sign in to get English";
  if (/^bg_/.test(code)) return "English unavailable: reload this tab";
  if (/network|timeout/.test(code)) return "English unavailable: can't reach AnimeVocab";
  return `English unavailable (${normalizeHealthCode(code)})`;
}
