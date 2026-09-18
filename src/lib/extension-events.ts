import { CWS_EXTENSION_ID, WEB_URL } from "../config";

/** Allowlisted extension product-funnel events (aggregate counters only). */
export const EXTENSION_EVENTS = [
  "review_prompt_shown",
  "review_prompt_clicked",
  "signup_completed",
  "first_card_created",
  "first_srs_review",
  "upgrade_prompt_shown",
  "upgrade_prompt_clicked",
  "checkout_started",
  "onboarding_shown",
] as const;

export type ExtensionEvent = (typeof EXTENSION_EVENTS)[number];

export function isExtensionEvent(v: unknown): v is ExtensionEvent {
  return typeof v === "string" && (EXTENSION_EVENTS as readonly string[]).includes(v);
}

function extensionId(): string {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) return chrome.runtime.id;
  } catch {
    /* ignore */
  }
  return CWS_EXTENSION_ID;
}

/**
 * Fire-and-forget allowlisted counter. Never throws — analytics must not
 * break popup/dashboard UX. Sends the extension id so the server can reject
 * non-extension callers. fetch-only (sendBeacon cannot set the id header and
 * is not CORS-safelisted for application/json).
 */
export function trackExtensionEvent(event: ExtensionEvent): void {
  if (!isExtensionEvent(event)) return;
  try {
    const url = `${WEB_URL}/api/extension/track`;
    const payload = JSON.stringify({ event });
    void fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-avc-extension-id": extensionId(),
      },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow
  }
}

export const EXTENSION_MILESTONES = [
  "onboarding_shown",
  "signup_completed",
  "first_card_created",
  "first_srs_review",
] as const satisfies readonly ExtensionEvent[];

export type ExtensionMilestone = (typeof EXTENSION_MILESTONES)[number];
export const EXTENSION_MILESTONE_STORAGE_KEY = "funnelMilestones";
const milestoneInFlight = new Set<ExtensionMilestone>();

/** Persist a lifecycle milestone before sending so it is counted once/install. */
export async function trackExtensionMilestone(event: ExtensionMilestone): Promise<boolean> {
  if (milestoneInFlight.has(event)) return false;
  milestoneInFlight.add(event);
  try {
    const result = await chrome.storage.local.get([EXTENSION_MILESTONE_STORAGE_KEY]);
    const milestones =
      result[EXTENSION_MILESTONE_STORAGE_KEY] &&
      typeof result[EXTENSION_MILESTONE_STORAGE_KEY] === "object"
        ? (result[EXTENSION_MILESTONE_STORAGE_KEY] as Record<string, boolean>)
        : {};
    if (milestones[event]) return false;
    await chrome.storage.local.set({
      [EXTENSION_MILESTONE_STORAGE_KEY]: { ...milestones, [event]: true },
    });
    trackExtensionEvent(event);
    return true;
  } catch {
    return false;
  } finally {
    milestoneInFlight.delete(event);
  }
}
