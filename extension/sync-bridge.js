"use strict";
(() => {
  // src/entries/sync-bridge.ts
  var WEB_ORIGIN = "https://animevocab.com";
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== WEB_ORIGIN) return;
    const data = event.data;
    if (!data || data.source !== "avc-web" || data.type !== "avc-sync-token") return;
    const token = typeof data.token === "string" ? data.token : "";
    if (!token) return;
    chrome.storage.local.set({ syncToken: token }, () => {
      chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {
      });
    });
  });
  window.postMessage({ source: "avc-ext", type: "avc-request-token" }, WEB_ORIGIN);
})();
