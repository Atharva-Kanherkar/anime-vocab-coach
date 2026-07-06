// Content script on the hosted web app (animevocab.com). The signed-in page
// broadcasts a sync token via postMessage; we store it and ask the background
// to push. Kept dependency-free so it stays a tiny bundle on the site.
const WEB_ORIGIN = "https://animevocab.com";

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== WEB_ORIGIN) return;
  const data = event.data as { source?: string; type?: string; token?: string } | null;
  if (!data || data.source !== "avc-web") return;

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

// The page may have rendered before this script loaded; ask it to resend.
window.postMessage({ source: "avc-ext", type: "avc-request-token" }, WEB_ORIGIN);
