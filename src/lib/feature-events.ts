// Learning-loop telemetry from the extension (#111).
//
// WHY A SECOND BEACON. `extension-events.ts` already posts to
// /api/extension/track, but that path writes aggregate counters into the
// `extension_funnel` dataset with no identity at all — it answers "how many
// installs reached the first review", not "did THIS learner accept a card
// today". The learning-loop question needs per-user rows in `avc_events`, so
// these go to /api/track (kind: "feature") instead, carrying the sync token so
// the server can resolve a userId (#112).
//
// Everything here is fire-and-forget and swallows its own errors: a beacon
// that can throw is a beacon that can break mining or playback.

import { WEB_URL } from "../config";
import { extensionVersion, inServiceWorker } from "./run-context";

/**
 * The learning-loop events this extension emits.
 *
 * MIRROR of the learning-loop block in web/src/lib/track-events.ts. The server
 * drops anything not on its allowlist, so a name that drifts here is silently
 * discarded with no error anywhere — test/feature-events.test.ts pins the two
 * lists against each other.
 */
export const FEATURE_EVENTS = [
  "card_shown",
  "card_known",
  "card_learn",
  "word_saved",
  "review_done",
  "listening_started",
  "install_first_run",
  "extension_linked",
] as const;

export type FeatureEvent = (typeof FEATURE_EVENTS)[number];

export function isFeatureEvent(v: unknown): v is FeatureEvent {
  return typeof v === "string" && (FEATURE_EVENTS as readonly string[]).includes(v);
}

const TRACK_URL = WEB_URL + "/api/track";

/** Message the content scripts use to hand a beacon to the service worker. */
export const TRACK_FEATURE_MESSAGE = "avc-track-feature";

/**
 * Read the sync token straight from storage rather than through lib/storage.
 *
 * storage.ts is the biggest caller of trackFeature (it owns judgeWord and
 * recordCardShown), so importing it here would be a cycle. This is a single
 * key read with no serialisation needs — the token is written elsewhere and
 * only ever read here.
 */
function syncToken(): Promise<string> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["syncToken"], (r) =>
        resolve(typeof r?.syncToken === "string" ? r.syncToken : "")
      );
    } catch {
      resolve("");
    }
  });
}

/**
 * The Pro funnel (#162): shown → clicked → checkout, per surface.
 *
 * Kept apart from FEATURE_EVENTS, which is pinned to the learning-loop panel.
 * MIRROR of PRO_FUNNEL_EVENTS and the `ext_` half of PRO_SURFACES in
 * web/src/lib/pro-funnel.ts; the server writes "" for a surface it does not
 * know, so test/feature-events.test.ts pins both lists.
 */
export const PRO_FUNNEL_EVENTS = [
  "pro_prompt_shown",
  "pro_prompt_clicked",
  "pro_checkout_started",
] as const;

export type ProFunnelEvent = (typeof PRO_FUNNEL_EVENTS)[number];

export const PRO_SURFACES = [
  "ext_popup",
  "ext_milestone",
  "ext_popup_limit",
  "ext_limit_sheet",
] as const;

export type ProSurface = (typeof PRO_SURFACES)[number];

export function isProFunnelEvent(v: unknown): v is ProFunnelEvent {
  return typeof v === "string" && (PRO_FUNNEL_EVENTS as readonly string[]).includes(v);
}

export function isProSurface(v: unknown): v is ProSurface {
  return typeof v === "string" && (PRO_SURFACES as readonly string[]).includes(v);
}

/** Message extension pages and content scripts use to hand a Pro beacon to the worker. */
export const TRACK_PRO_MESSAGE = "avc-track-pro";

/** POST one row to /api/track, with the sync token when there is one. */
async function postTrack(body: Record<string, string>): Promise<void> {
  const token = await syncToken();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  void fetch(TRACK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, v: extensionVersion() }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Send the beacon. Only ever called in the service worker (see above).
 *
 * Unauthenticated installs still send: an anonymous row is the denominator
 * that makes "cards accepted per active learner" mean anything, and without it
 * the local-only majority would be invisible. The token is attached when there
 * is one, which is what turns a row from anonymous into attributable (#112).
 */
export async function sendFeatureBeacon(event: FeatureEvent): Promise<void> {
  if (!isFeatureEvent(event)) return;
  try {
    await postTrack({ kind: "feature", name: event });
  } catch {
    // swallow — telemetry must never reach the learner
  }
}

/** The Pro funnel beacon, service worker only. Same transport, plus the surface. */
export async function sendProBeacon(event: ProFunnelEvent, surface: ProSurface): Promise<void> {
  if (!isProFunnelEvent(event) || !isProSurface(surface)) return;
  try {
    await postTrack({ kind: "feature", name: event, surface });
  } catch {
    // swallow
  }
}

/**
 * Fire one allowlisted learning-loop event from wherever you are.
 *
 * Never throws and never awaits a response — callers `void` this from hot
 * paths (every card shown, every judgment), including content scripts running
 * inside the player page.
 */
export async function trackFeature(event: FeatureEvent): Promise<void> {
  if (!isFeatureEvent(event)) return;
  if (inServiceWorker()) {
    await sendFeatureBeacon(event);
    return;
  }
  try {
    // The worker may be asleep; sendMessage wakes it. A rejection here means
    // there is no receiver (the worker is being torn down), which is a lost
    // beacon and nothing more.
    void chrome.runtime
      .sendMessage({ type: TRACK_FEATURE_MESSAGE, event })
      .catch(() => {});
  } catch {
    // swallow
  }
}

/** Fire one Pro funnel event from anywhere. Never throws, never awaits a response. */
export async function trackPro(event: ProFunnelEvent, surface: ProSurface): Promise<void> {
  if (!isProFunnelEvent(event) || !isProSurface(surface)) return;
  if (inServiceWorker()) {
    await sendProBeacon(event, surface);
    return;
  }
  try {
    void chrome.runtime
      .sendMessage({ type: TRACK_PRO_MESSAGE, event, surface })
      .catch(() => {});
  } catch {
    // swallow
  }
}
