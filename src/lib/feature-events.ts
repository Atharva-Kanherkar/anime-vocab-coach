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
    const token = await syncToken();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers.authorization = "Bearer " + token;
    void fetch(TRACK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "feature", name: event, v: extensionVersion() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow — telemetry must never reach the learner
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
