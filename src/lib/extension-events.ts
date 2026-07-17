import { CWS_EXTENSION_ID, WEB_URL } from "../config";

/** Allowlisted extension product-funnel events (aggregate counters only). */
export const EXTENSION_EVENTS = [
  "review_prompt_shown",
  "review_prompt_clicked",
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
 * non-extension callers.
 */
export function trackExtensionEvent(event: ExtensionEvent): void {
  if (!isExtensionEvent(event)) return;
  try {
    const url = `${WEB_URL}/api/extension/track`;
    const payload = JSON.stringify({ event });
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-avc-extension-id": extensionId(),
    };
    void fetch(url, {
      method: "POST",
      headers,
      body: payload,
      keepalive: true,
    }).catch(() => {
      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          // sendBeacon cannot set custom headers; server still accepts Origin
          // from chrome-extension:// pages when the browser attaches it.
          navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
        }
      } catch {
        // swallow
      }
    });
  } catch {
    // swallow
  }
}
