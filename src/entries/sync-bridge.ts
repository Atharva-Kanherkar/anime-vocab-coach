// Content script on the hosted web app (animevocab.com). The signed-in page
// broadcasts a sync token via postMessage; we store it and ask the background
// to push. Kept dependency-free so it stays a tiny bundle on the site.
const ALLOWED_ORIGINS = new Set(["https://animevocab.com", "https://www.animevocab.com"]);

function pageOrigin(): string {
  return window.location.origin;
}

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.has(origin) || origin === pageOrigin();
}

function announceExtension(): void {
  const origin = pageOrigin();
  window.postMessage({ source: "avc-ext", type: "avc-ext-present" }, origin);
  window.postMessage({ source: "avc-ext", type: "avc-request-token" }, origin);
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !isAllowedOrigin(event.origin)) return;
  const data = event.data as { source?: string; type?: string; token?: string } | null;
  if (!data || data.source !== "avc-web") return;

  if (data.type === "avc-ping-extension") {
    announceExtension();
    return;
  }

  if (data.type === "avc-sync-token") {
    const token = typeof data.token === "string" ? data.token : "";
    if (!token) return;
    chrome.storage.local.set({ syncToken: token }, () => {
      chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {});
    });
    return;
  }

  if (data.type === "avc-sync-now") {
    chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {});
  }
});

// React may mount after this script; the page will ping us back.
announceExtension();
