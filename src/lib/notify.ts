// Background-side helpers for surfacing a visible toast on the page. The
// content script (content.ts) renders `avc-toast` messages via the overlay.

export type ToastKind = "error" | "info";

/** Toast a specific tab (used when we already know which tab errored). */
export function toastTab(tabId: number, text: string, kind: ToastKind = "info"): void {
  chrome.tabs.sendMessage(tabId, { type: "avc-toast", text, kind }).catch(() => {});
}

/**
 * Toast the tab the user is most likely looking at. Used for account-level
 * events (e.g. sync re-link needed) that aren't tied to a particular tab.
 */
export async function toastActiveTab(text: string, kind: ToastKind = "info"): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tabId = tabs[0]?.id;
    if (tabId != null) toastTab(tabId, text, kind);
  } catch {
    /* no active tab / no permission — a background log is the only fallback */
  }
}
