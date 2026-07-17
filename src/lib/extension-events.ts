import { WEB_URL } from "../config";

/** Allowlisted extension product-funnel events (aggregate counters only). */
export const EXTENSION_EVENTS = [
  "review_prompt_shown",
  "review_prompt_clicked",
] as const;

export type ExtensionEvent = (typeof EXTENSION_EVENTS)[number];

export function isExtensionEvent(v: unknown): v is ExtensionEvent {
  return typeof v === "string" && (EXTENSION_EVENTS as readonly string[]).includes(v);
}

/**
 * Fire-and-forget allowlisted counter. Never throws — analytics must not
 * break popup/dashboard UX. Uses sendBeacon when available.
 */
export function trackExtensionEvent(event: ExtensionEvent): void {
  if (!isExtensionEvent(event)) return;
  try {
    const url = `${WEB_URL}/api/extension/track`;
    const payload = JSON.stringify({ event });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
      mode: "no-cors",
    }).catch(() => {});
  } catch {
    // swallow
  }
}
