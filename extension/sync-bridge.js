"use strict";
(() => {
  // src/entries/sync-bridge.ts
  (function initSyncBridge() {
    const bridgeWindow = window;
    if (bridgeWindow.__avcSyncBridgeLoaded) return;
    bridgeWindow.__avcSyncBridgeLoaded = true;
    const ALLOWED_ORIGINS = /* @__PURE__ */ new Set(["https://animevocab.com", "https://www.animevocab.com"]);
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
      try {
        chrome.storage.local.get(["syncToken"], (r) => {
          const linked = typeof r?.syncToken === "string" && r.syncToken.length > 0;
          window.postMessage({ source: "avc-ext", type: "avc-ext-present", linked }, origin);
        });
      } catch {
      }
    }
    window.addEventListener("message", (event) => {
      if (event.source !== window || !isAllowedOrigin(event.origin)) return;
      const data = event.data;
      if (!data || data.source !== "avc-web") return;
      if (data.type === "avc-ping-extension") {
        announceExtension();
        return;
      }
      if (data.type === "avc-signin-surface") {
        chrome.runtime.sendMessage({ type: "avc-signin-surface", surface: data.surface }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-sync-token") {
        const token = typeof data.token === "string" ? data.token : "";
        if (!token) return;
        const p = data.profile;
        const plan = p?.plan;
        const syncProfile = p && typeof p === "object" ? {
          email: typeof p.email === "string" ? p.email : null,
          name: typeof p.name === "string" ? p.name : null,
          plan: plan === "free" || plan === "pro" || plan === "max" ? plan : null
        } : void 0;
        void chrome.runtime.sendMessage({ type: "avc-link-token", token, profile: syncProfile }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-n5-course-changed" && ALLOWED_ORIGINS.has(event.origin)) {
        chrome.runtime.sendMessage({ type: "avc-n5-refresh" }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-sync-now") {
        chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-settings-updated") {
        chrome.runtime.sendMessage({ type: "avc-pull-settings" }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-device-key" && typeof data.requestId === "string" && typeof data.value === "string") {
        void chrome.runtime.sendMessage({ type: "avc-device-key", value: data.value }).then((reply) => {
          window.postMessage({ source: "avc-ext", type: "avc-device-key-saved", requestId: data.requestId, ok: reply?.ok === true }, pageOrigin());
        }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-delete-learning-data") {
        void chrome.runtime.sendMessage({ type: "avc-delete-learning-data" }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-sign-out") {
        chrome.runtime.sendMessage({ type: "avc-sign-out" }).catch(() => {
        });
      }
    });
    announceExtension();
  })();
})();
