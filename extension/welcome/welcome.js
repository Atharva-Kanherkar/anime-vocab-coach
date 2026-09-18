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
  var CWS_EXTENSION_ID = "lkjbomofgfonjjbemobacegffepbdnel";

  // src/lib/log.ts
  var warn = (...args) => console.warn("[AVC]", ...args);

  // src/types.ts
  var SRS_INTERVALS = [0, 4 * 36e5, 24 * 36e5, 3 * 24 * 36e5, 7 * 24 * 36e5, 21 * 24 * 36e5];

  // src/lib/review-prompt.ts
  var REVIEW_PROMPT_SNOOZE_MS = 14 * 24 * 36e5;

  // src/lib/extension-events.ts
  var EXTENSION_EVENTS = [
    "review_prompt_shown",
    "review_prompt_clicked",
    "signup_completed",
    "first_card_created",
    "first_srs_review",
    "upgrade_prompt_shown",
    "upgrade_prompt_clicked",
    "checkout_started",
    "onboarding_shown"
  ];
  function isExtensionEvent(v) {
    return typeof v === "string" && EXTENSION_EVENTS.includes(v);
  }
  function extensionId() {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.id) return chrome.runtime.id;
    } catch {
    }
    return CWS_EXTENSION_ID;
  }
  function trackExtensionEvent(event) {
    if (!isExtensionEvent(event)) return;
    try {
      const url = `${WEB_URL}/api/extension/track`;
      const payload = JSON.stringify({ event });
      void fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-avc-extension-id": extensionId()
        },
        body: payload,
        keepalive: true
      }).catch(() => {
      });
    } catch {
    }
  }
  var EXTENSION_MILESTONE_STORAGE_KEY = "funnelMilestones";
  var milestoneInFlight = /* @__PURE__ */ new Set();
  async function trackExtensionMilestone(event) {
    if (milestoneInFlight.has(event)) return false;
    milestoneInFlight.add(event);
    try {
      const result = await chrome.storage.local.get([EXTENSION_MILESTONE_STORAGE_KEY]);
      const milestones = result[EXTENSION_MILESTONE_STORAGE_KEY] && typeof result[EXTENSION_MILESTONE_STORAGE_KEY] === "object" ? result[EXTENSION_MILESTONE_STORAGE_KEY] : {};
      if (milestones[event]) return false;
      await chrome.storage.local.set({
        [EXTENSION_MILESTONE_STORAGE_KEY]: { ...milestones, [event]: true }
      });
      trackExtensionEvent(event);
      return true;
    } catch {
      return false;
    } finally {
      milestoneInFlight.delete(event);
    }
  }

  // src/lib/feature-events.ts
  var TRACK_URL = WEB_URL + "/api/track";

  // src/lib/onboarding.ts
  var ONBOARDING_STORAGE_KEY = "onboarding";
  var ONBOARDING_CHECKLIST_AFTER_MS = 24 * 36e5;
  var EMPTY_ONBOARDING = {
    installedAt: 0,
    shownAt: 0,
    watchedAt: 0,
    cardShownAt: 0,
    firstCardAt: 0,
    celebratedAt: 0,
    checklistDismissedAt: 0
  };
  function stamp(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  function normalizeOnboarding(raw) {
    if (!raw || typeof raw !== "object") return { ...EMPTY_ONBOARDING };
    const o = raw;
    return {
      installedAt: stamp(o.installedAt),
      shownAt: stamp(o.shownAt),
      watchedAt: stamp(o.watchedAt),
      cardShownAt: stamp(o.cardShownAt),
      firstCardAt: stamp(o.firstCardAt),
      celebratedAt: stamp(o.celebratedAt),
      checklistDismissedAt: stamp(o.checklistDismissedAt)
    };
  }
  function applyStamp(state, field, now) {
    if (state[field] > 0) return state;
    return { ...state, [field]: stamp(now) || 1 };
  }
  function isActivated(state) {
    return state.firstCardAt > 0;
  }
  var ONBOARDING_STEPS = [
    {
      id: "watch",
      stampField: "watchedAt",
      title: "Play any anime",
      detail: "Crunchyroll, Netflix or YouTube, with Japanese audio or Japanese subtitles."
    },
    {
      id: "panel",
      stampField: "cardShownAt",
      title: "Open the AnimeVocab panel",
      detail: "The \u30A2\u30CB rail sits at the edge of the player. It picks one word per line for you."
    },
    {
      id: "mine",
      stampField: "firstCardAt",
      title: "Click a word to save it",
      detail: "That is your first card. It comes back for review on its own."
    }
  ];
  function checklistSteps(state) {
    return ONBOARDING_STEPS.map((step) => ({ ...step, done: state[step.stampField] > 0 }));
  }

  // src/lib/onboarding-store.ts
  var queue = Promise.resolve();
  function enqueue(fn) {
    const next = queue.then(fn, fn);
    queue = next.catch((err) => warn("onboarding storage error:", err));
    return next;
  }
  function getOnboarding() {
    return enqueue(async () => {
      try {
        return await readState();
      } catch {
        return normalizeOnboarding(null);
      }
    });
  }
  async function readState() {
    const r = await chrome.storage.local.get([ONBOARDING_STORAGE_KEY]);
    return normalizeOnboarding(r[ONBOARDING_STORAGE_KEY]);
  }
  async function writeStamp(field, now) {
    const state = await readState();
    const next = applyStamp(state, field, now);
    if (next === state) return false;
    await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: next });
    return true;
  }
  function stampOnboarding(field, now = Date.now()) {
    return enqueue(async () => {
      try {
        if (!await writeStamp(field, now)) return false;
        if ((await readState())[field] === 0) await writeStamp(field, now);
        return true;
      } catch {
        return false;
      }
    });
  }
  async function recordOnboardingShown(now = Date.now()) {
    if (await stampOnboarding("shownAt", now)) {
      await trackExtensionMilestone("onboarding_shown");
    }
  }

  // src/lib/storage.ts
  var queue2 = Promise.resolve();
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
  var CRUNCHYROLL_URL = "https://www.crunchyroll.com/videos/popular";
  var NETFLIX_URL = "https://www.netflix.com/browse/genre/7424";
  var YOUTUBE_URL = "https://www.youtube.com/results?search_query=anime+%E6%97%A5%E6%9C%AC%E8%AA%9E%E5%AD%97%E5%B9%95";
  var STEP_ACTIONS = {
    watch: `<div class="row"><button type="button" class="btn btn-primary btn-lg" data-open="${CRUNCHYROLL_URL}">Open Crunchyroll</button><button type="button" class="btn" data-open="${NETFLIX_URL}">Netflix</button><button type="button" class="btn" data-open="${YOUTUBE_URL}">YouTube</button></div>`
  };
  function renderSteps(state) {
    byId("steps").innerHTML = checklistSteps(state).map((step, i) => {
      const done = step.done;
      return `<li class="step${done ? " done" : ""}" data-step="${step.id}"><span class="num" aria-hidden>${done ? "\u2713" : i + 1}</span><div class="body"><h2>${esc(step.title)}</h2><p>${esc(step.detail)}</p>` + (done ? `<span class="step-done-note">Done</span>` : STEP_ACTIONS[step.id] || "") + `</div></li>`;
    }).join("");
  }
  function renderCelebration(state) {
    const el = byId("celebrate");
    if (!isActivated(state)) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = `<h2>\u{1F389} First card saved</h2><p>It comes back for review on its own, starting in about four hours. Everything else is just more anime.</p><div class="row"><button type="button" class="btn btn-primary" data-act="dashboard">Open your review dashboard</button></div>`;
    byId("head-title").textContent = "You are learning Japanese from anime";
    byId("head-sub").textContent = "Your first card is saved. Keep watching \u2014 the rest mines itself.";
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
    byId("account").innerHTML = signinLead() + `<div class="account"><div class="status"><span class="dot warn"></span><div><b>${ACCOUNT_COPY.checkingTitle}</b><span class="note">${ACCOUNT_COPY.checkingNote}</span></div></div></div>`;
  }
  function signinLead() {
    return `<p class="signin-lead">When you save your first card, one tap keeps it in the cloud and on every browser you sign in to. Until then there is nothing to sign up for \u2014 your words stay on this device.</p>`;
  }
  async function renderAccount() {
    const el = byId("account");
    const token = await getSyncToken();
    if (!token) {
      el.innerHTML = signinLead() + `<div class="account"><div class="status"><span class="dot off"></span><div><b>${ACCOUNT_COPY.notLinkedTitle}</b><span class="note">${ACCOUNT_COPY.notLinkedNote}</span></div></div><div class="row"><button type="button" class="btn" id="connect">${ACCOUNT_COPY.connect}</button></div></div>`;
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
    el.innerHTML = `<div class="account"><div class="status"><span class="dot"></span><div><b>${ACCOUNT_COPY.linkedTitle}${plan ? ` \xB7 ${esc(plan)}` : ""}</b><span class="note">${esc(ACCOUNT_COPY.linkedNote(who))}</span></div></div><div class="row"><button type="button" class="btn" id="open-app">${ACCOUNT_COPY.openApp}</button></div></div>`;
    byId("open-app").addEventListener("click", () => {
      void chrome.tabs.create({ url: ownedWebUrl("/app", "welcome_cloud") });
    });
  }
  async function renderOnboarding() {
    const state = await getOnboarding();
    renderSteps(state);
    renderCelebration(state);
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", (e) => {
      const el = e.target?.closest("[data-open], [data-act]");
      if (!el) return;
      const url = el.dataset.open;
      if (url) {
        void chrome.tabs.create({ url });
        return;
      }
      switch (el.dataset.act) {
        case "dashboard":
          void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
          break;
        case "settings":
          chrome.runtime.openOptionsPage();
          break;
        case "privacy":
          void chrome.tabs.create({ url: ownedWebUrl("/privacy", "welcome_privacy") });
          break;
      }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.syncToken || changes.syncProfile) void renderAccount();
      if (changes[ONBOARDING_STORAGE_KEY]) void renderOnboarding();
    });
    void renderOnboarding();
    void recordOnboardingShown();
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
