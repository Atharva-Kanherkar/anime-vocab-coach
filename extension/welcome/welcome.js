"use strict";
(() => {
  // src/config.ts
  var WEB_URL = "https://animevocab.com";
  function ownedWebUrl(path, campaign) {
    const url = new URL(path, WEB_URL);
    url.searchParams.set("utm_source", "animevocab_extension");
    url.searchParams.set("utm_medium", "extension");
    url.searchParams.set("utm_campaign", campaign);
    return url.toString();
  }

  // src/types.ts
  var SRS_INTERVALS = [0, 4 * 36e5, 24 * 36e5, 3 * 24 * 36e5, 7 * 24 * 36e5, 21 * 24 * 36e5];

  // src/lib/review-prompt.ts
  var REVIEW_PROMPT_SNOOZE_MS = 14 * 24 * 36e5;

  // src/lib/storage.ts
  var queue = Promise.resolve();
  function getSyncToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncToken"], (r) => resolve(r.syncToken || ""));
    });
  }
  function normalizeSyncPlan(value) {
    return value === "free" || value === "pro" || value === "max" ? value : null;
  }
  function getSyncProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncProfile"], (r) => {
        const p = r.syncProfile;
        resolve(
          p && typeof p === "object" ? { email: p.email ?? null, name: p.name ?? null, plan: normalizeSyncPlan(p.plan) } : null
        );
      });
    });
  }

  // src/lib/account-link.ts
  var TOKEN_URL = WEB_URL + "/api/sync/token";
  var AUTO_LINK_COOLDOWN_MS = 60 * 60 * 1e3;
  var SIGN_OUT_SUPPRESSION_MS = 5 * 60 * 1e3;
  function planLabel(plan) {
    return plan === "max" ? "Max" : plan === "pro" ? "Pro" : plan === "free" ? "Free" : "";
  }
  var ACCOUNT_COPY = {
    checkingTitle: "Checking this browser\u2026",
    checkingNote: "Looking for a signed-in animevocab.com session.",
    linkedTitle: "Connected",
    notLinkedTitle: "Not connected",
    notLinkedNote: "Your words stay on this device only.",
    connect: "Connect account",
    connecting: "Connecting\u2026",
    reconnect: "Reconnect account",
    linkedNote: (who) => `Signed in as ${who}. Your words sync automatically.`,
    /** Stand-in when the mint endpoint gave us neither an email nor a name. */
    unnamedAccount: "your account",
    openApp: "Open your cloud app",
    /** Popup-only: it distinguishes a fresh install from an expired session. */
    popupNotSignedIn: "Not signed in",
    popupNotSignedInNote: "Progress stays on this device only",
    popupExpired: "Sign-in expired",
    popupExpiredNote: "Re-link to resume cloud sync"
  };

  // src/entries/welcome.ts
  function byId(id) {
    return document.getElementById(id);
  }
  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  async function requestLink(force) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: "avc-account-link",
        trigger: "welcome",
        force
      });
      return res?.linked === true;
    } catch {
      return false;
    }
  }
  function renderChecking() {
    byId("account").innerHTML = `<div class="status"><span class="dot warn"></span><div><b>${ACCOUNT_COPY.checkingTitle}</b><span class="note">${ACCOUNT_COPY.checkingNote}</span></div></div>`;
  }
  async function renderAccount() {
    const el = byId("account");
    const token = await getSyncToken();
    if (!token) {
      el.innerHTML = `<div class="status"><span class="dot off"></span><div><b>${ACCOUNT_COPY.notLinkedTitle}</b><span class="note">${ACCOUNT_COPY.notLinkedNote}</span></div></div><div class="row"><button type="button" class="btn btn-primary" id="connect">${ACCOUNT_COPY.connect}</button></div>`;
      byId("connect").addEventListener("click", () => {
        void (async () => {
          const button = byId("connect");
          button.disabled = true;
          button.textContent = ACCOUNT_COPY.connecting;
          if (await requestLink(true)) {
            await renderAccount();
            return;
          }
          await chrome.tabs.create({ url: ownedWebUrl("/app", "welcome_connect") });
          button.disabled = false;
          button.textContent = ACCOUNT_COPY.connect;
        })();
      });
      return;
    }
    const profile = await getSyncProfile();
    const who = profile?.email || profile?.name || ACCOUNT_COPY.unnamedAccount;
    const plan = planLabel(profile?.plan ?? null);
    el.innerHTML = `<div class="status"><span class="dot"></span><div><b>${ACCOUNT_COPY.linkedTitle}${plan ? ` \xB7 ${esc(plan)}` : ""}</b><span class="note">${esc(ACCOUNT_COPY.linkedNote(who))}</span></div></div><div class="row"><button type="button" class="btn" id="open-app">${ACCOUNT_COPY.openApp}</button></div>`;
    byId("open-app").addEventListener("click", () => {
      void chrome.tabs.create({ url: ownedWebUrl("/app", "welcome_cloud") });
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    for (const el of document.querySelectorAll("[data-open]")) {
      el.addEventListener("click", () => {
        const url = el.dataset.open;
        if (url) void chrome.tabs.create({ url });
      });
    }
    byId("open-dashboard").addEventListener("click", () => {
      void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    });
    byId("open-settings").addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
    byId("open-privacy").addEventListener("click", () => {
      void chrome.tabs.create({ url: ownedWebUrl("/privacy", "welcome_privacy") });
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.syncToken || changes.syncProfile)) void renderAccount();
    });
    void (async () => {
      const token = await getSyncToken();
      if (token) {
        await renderAccount();
        return;
      }
      renderChecking();
      await requestLink(false);
      await renderAccount();
    })();
  });
})();
