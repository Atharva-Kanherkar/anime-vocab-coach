"use strict";
(() => {
  // src/entries/sync-bridge.ts
  var ALLOWED_ORIGINS = /* @__PURE__ */ new Set(["https://animevocab.com", "https://www.animevocab.com"]);
  function pageOrigin() {
    return window.location.origin;
  }
  function isAllowedOrigin(origin) {
    return ALLOWED_ORIGINS.has(origin) || origin === pageOrigin();
  }
  function announceExtension() {
    const origin = pageOrigin();
    window.postMessage({ source: "avc-ext", type: "avc-ext-present" }, origin);
    window.postMessage({ source: "avc-ext", type: "avc-request-token" }, origin);
  }
  window.addEventListener("message", (event) => {
    if (event.source !== window || !isAllowedOrigin(event.origin)) return;
    const data = event.data;
    if (!data || data.source !== "avc-web") return;
    if (data.type === "avc-ping-extension") {
      announceExtension();
      return;
    }
    if (data.type === "avc-sync-token") {
      const token = typeof data.token === "string" ? data.token : "";
      if (!token) return;
      const p = data.profile;
      const syncProfile = p && typeof p === "object" ? { email: typeof p.email === "string" ? p.email : null, name: typeof p.name === "string" ? p.name : null } : void 0;
      const update = { syncToken: token };
      if (syncProfile !== void 0) update.syncProfile = syncProfile;
      chrome.storage.local.set(update, () => {
        chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {
        });
      });
      return;
    }
    if (data.type === "avc-sync-now") {
      chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {
      });
      return;
    }
    if (data.type === "avc-sign-out") {
      chrome.storage.local.set({
        syncToken: "",
        syncProfile: null,
        relinkNeeded: false,
        syncAuthFailures: 0
      });
    }
  });
  announceExtension();
})();
