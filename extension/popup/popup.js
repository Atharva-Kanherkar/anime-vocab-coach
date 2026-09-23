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

  // src/lib/locale-direction.ts
  function isJapaneseUiLocale() {
    try {
      const ui = chrome.i18n?.getUILanguage?.() || navigator.language || "en";
      return ui.toLowerCase().startsWith("ja");
    } catch {
      return false;
    }
  }
  function resolveStoredDirection(stored) {
    if (stored === "ja-en" || stored === "en-ja") return stored;
    return null;
  }

  // src/types.ts
  var DEFAULTS = {
    pauseMode: "copilot",
    cooldownSec: 20,
    maxCardsPerHour: 12,
    targetLevel: 5,
    autoResumeSec: 15,
    displayScript: "romaji",
    learningDirection: "en-ja",
    autoSpeak: true,
    subLens: true,
    subLensPeek: true,
    openaiKey: "",
    transcribeModel: "gpt-4o-mini-transcribe",
    sites: { youtube: true, netflix: true, generic: true }
  };
  var SRS_INTERVALS = [0, 4 * 36e5, 24 * 36e5, 3 * 24 * 36e5, 7 * 24 * 36e5, 21 * 24 * 36e5];

  // src/lib/review-prompt.ts
  var CWS_REVIEWS_URL = "https://chromewebstore.google.com/detail/lkjbomofgfonjjbemobacegffepbdnel/reviews";
  var REVIEW_PROMPT_MIN_MINED = 10;
  var REVIEW_PROMPT_MAX_ASKS = 2;
  var REVIEW_PROMPT_SNOOZE_MS = 14 * 24 * 36e5;
  var REVIEW_PROMPT_SNOOZE_EXTRA_CARDS = 20;
  var EMPTY_REVIEW_PROMPT = {
    dismissedForever: false,
    askCount: 0,
    snoozeUntil: 0,
    snoozeAfterCards: 0,
    lastShownAt: 0
  };
  function countMinedCards(vocab) {
    let n = 0;
    for (const rec of Object.values(vocab)) {
      if (rec.state === "known" || rec.state === "learning") n++;
    }
    return n;
  }
  function totalReviewsDone(stats) {
    let n = 0;
    for (const day of Object.values(stats.daily || {})) {
      n += day.reviews || 0;
    }
    return n;
  }
  function asBool(v) {
    if (v === true || v === 1) return true;
    if (typeof v === "string") return v.toLowerCase() === "true";
    return false;
  }
  function normalizeReviewPrompt(raw) {
    if (!raw || typeof raw !== "object") return { ...EMPTY_REVIEW_PROMPT };
    const o = raw;
    return {
      // Avoid `!!o.dismissedForever` — a legacy string "false" would become true.
      dismissedForever: asBool(o.dismissedForever),
      askCount: Math.max(0, Number(o.askCount) || 0),
      snoozeUntil: Math.max(0, Number(o.snoozeUntil) || 0),
      snoozeAfterCards: Math.max(0, Number(o.snoozeAfterCards) || 0),
      lastShownAt: Math.max(0, Number(o.lastShownAt) || 0)
    };
  }
  function shouldShowReviewPrompt(input) {
    const now = input.now ?? Date.now();
    if (input.blocked) return false;
    const { prompt } = input;
    if (prompt.dismissedForever) return false;
    const mined = countMinedCards(input.vocab);
    if (mined < REVIEW_PROMPT_MIN_MINED) return false;
    if (totalReviewsDone(input.stats) < 1) return false;
    const awaitingResponse = prompt.lastShownAt > 0 && prompt.snoozeUntil === 0 && prompt.askCount > 0 && prompt.askCount <= REVIEW_PROMPT_MAX_ASKS;
    if (awaitingResponse) return true;
    if (prompt.askCount >= REVIEW_PROMPT_MAX_ASKS) return false;
    if (prompt.snoozeUntil > 0 && now < prompt.snoozeUntil) return false;
    if (prompt.snoozeAfterCards > 0 && mined < prompt.snoozeAfterCards) return false;
    return true;
  }
  function applyShown(prompt, now = Date.now()) {
    return {
      ...prompt,
      lastShownAt: now,
      askCount: prompt.askCount + 1,
      snoozeUntil: 0,
      snoozeAfterCards: 0
    };
  }
  function shouldCountShown(prompt, now = Date.now()) {
    if (prompt.askCount >= REVIEW_PROMPT_MAX_ASKS) return false;
    if (prompt.lastShownAt === 0) return true;
    return prompt.snoozeUntil > 0 && now >= prompt.snoozeUntil;
  }
  function applyMaybeLater(prompt, minedCards, now = Date.now()) {
    return {
      ...prompt,
      snoozeUntil: now + REVIEW_PROMPT_SNOOZE_MS,
      snoozeAfterCards: minedCards + REVIEW_PROMPT_SNOOZE_EXTRA_CARDS
    };
  }
  function applyNoThanks(prompt) {
    return { ...prompt, dismissedForever: true };
  }
  function applyRate(prompt) {
    return { ...prompt, dismissedForever: true };
  }

  // src/lib/run-context.ts
  function inServiceWorker() {
    return typeof window === "undefined";
  }
  function extensionVersion() {
    try {
      const v = chrome.runtime.getManifest().version;
      return typeof v === "string" ? v : "";
    } catch {
      return "";
    }
  }

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
  var TRACK_EXTENSION_EVENT_MESSAGE = "avc-track-extension-event";
  function sendExtensionEventBeacon(event) {
    if (!isExtensionEvent(event)) return;
    try {
      const url = `${WEB_URL}/api/extension/track`;
      const payload = JSON.stringify({ event, v: extensionVersion() });
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
  function trackExtensionEvent(event) {
    if (!isExtensionEvent(event)) return;
    if (inServiceWorker()) {
      sendExtensionEventBeacon(event);
      return;
    }
    try {
      void chrome.runtime.sendMessage({ type: TRACK_EXTENSION_EVENT_MESSAGE, event }).catch(() => {
      });
    } catch {
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
  function shouldShowChecklist(input) {
    const { state } = input;
    const now = input.now ?? Date.now();
    if (state.installedAt === 0) return false;
    if (isActivated(state)) return false;
    if (state.checklistDismissedAt > 0) return false;
    return now - state.installedAt >= ONBOARDING_CHECKLIST_AFTER_MS;
  }
  function shouldCelebrate(state) {
    return isActivated(state) && state.celebratedAt === 0;
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

  // src/lib/storage.ts
  var queue2 = Promise.resolve();
  function enqueue2(fn) {
    const next = queue2.then(fn, fn);
    queue2 = next.catch((err) => warn("storage error:", err));
    return next;
  }
  function pruneTimestamps(timestamps) {
    const cutoff = Date.now() - 36e5;
    return (timestamps || []).filter((t) => t >= cutoff);
  }
  function emptyStats() {
    return { daily: {}, cardTimestamps: [] };
  }
  function withDefaults(stored) {
    const merged = { ...DEFAULTS, ...stored };
    if (resolveStoredDirection(stored.learningDirection) === null && isJapaneseUiLocale()) {
      merged.learningDirection = "ja-en";
    }
    return merged;
  }
  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings"], (r) => {
        resolve(withDefaults(r.settings || {}));
      });
    });
  }
  function getVocab() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["vocab"], (r) => resolve(r.vocab || {}));
    });
  }
  function getStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["stats"], (r) => {
        const stats = r.stats || emptyStats();
        stats.cardTimestamps = pruneTimestamps(stats.cardTimestamps);
        resolve(stats);
      });
    });
  }
  function exportAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings", "vocab", "stats"], (r) => {
        resolve({
          settings: withDefaults(r.settings || {}),
          vocab: r.vocab || {},
          stats: r.stats || emptyStats(),
          exportedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      });
    });
  }
  function getSyncToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncToken"], (r) => resolve(r.syncToken || ""));
    });
  }
  function getRelinkNeeded() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["relinkNeeded"], (r) => resolve(!!r.relinkNeeded));
    });
  }
  function normalizeSyncPlan(value) {
    return value === "free" || value === "pro" || value === "max" ? value : null;
  }
  var EMPTY_SYNC_STATUS = {
    state: "idle",
    lastAttemptAt: null,
    lastSuccessAt: null,
    error: null
  };
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
  function getSyncStatus() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncStatus"], (r) => {
        const s = r.syncStatus;
        if (!s || typeof s !== "object") {
          resolve({ ...EMPTY_SYNC_STATUS });
          return;
        }
        const state = s.state === "syncing" || s.state === "ok" || s.state === "error" ? s.state : "idle";
        resolve({
          state,
          lastAttemptAt: Number.isFinite(s.lastAttemptAt) ? Number(s.lastAttemptAt) : null,
          lastSuccessAt: Number.isFinite(s.lastSuccessAt) ? Number(s.lastSuccessAt) : null,
          error: typeof s.error === "string" ? s.error : null
        });
      });
    });
  }
  function getReviewPrompt() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["reviewPrompt"], (r) => {
        resolve(normalizeReviewPrompt(r.reviewPrompt));
      });
    });
  }
  function setReviewPrompt(next) {
    return enqueue2(async () => {
      const state = normalizeReviewPrompt(next);
      await chrome.storage.local.set({ reviewPrompt: state });
      return state;
    });
  }
  function recordReviewPromptShown(now = Date.now()) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["reviewPrompt"]);
      const prompt = normalizeReviewPrompt(r.reviewPrompt);
      if (!shouldCountShown(prompt, now)) return false;
      await chrome.storage.local.set({ reviewPrompt: applyShown(prompt, now) });
      return true;
    });
  }

  // src/lib/review.ts
  function dueCount(vocab, now = Date.now()) {
    let n = 0;
    for (const base of Object.keys(vocab)) {
      const r = vocab[base];
      if (r.state === "learning" && r.srs && r.srs.dueAt <= now) n++;
    }
    return n;
  }

  // src/lib/review-prompt-ui.ts
  async function mountReviewPrompt(opts) {
    const { host, blocked = false, variant = "popup" } = opts;
    try {
      return await mountReviewPromptInner(host, blocked, variant);
    } catch {
      try {
        host.hidden = true;
        host.innerHTML = "";
      } catch {
      }
      return false;
    }
  }
  async function mountReviewPromptInner(host, blocked, variant) {
    const [vocab, stats, prompt] = await Promise.all([
      getVocab(),
      getStats(),
      getReviewPrompt()
    ]);
    const now = Date.now();
    if (!shouldShowReviewPrompt({ vocab, stats, prompt, blocked, now })) {
      host.hidden = true;
      host.innerHTML = "";
      return false;
    }
    if (await recordReviewPromptShown(now)) {
      trackExtensionEvent("review_prompt_shown");
    }
    const rootClass = variant === "popup" ? "av-review-prompt" : "rp-card";
    const btnPrimary = variant === "popup" ? "av-btn av-btn-primary av-btn-block" : "rp-btn rp-btn-primary";
    const btnGhost = variant === "popup" ? "av-btn av-btn-ghost av-btn-block" : "rp-btn rp-btn-ghost";
    const btnQuiet = variant === "popup" ? "av-btn av-btn-quiet av-btn-block" : "rp-btn rp-btn-quiet";
    host.hidden = false;
    host.innerHTML = `<div class="${rootClass}" role="region" aria-label="Rate AnimeVocab"><p class="${variant === "popup" ? "av-review-prompt-copy" : "rp-copy"}">Enjoying AnimeVocab? A rating helps other learners find it.</p><div class="${variant === "popup" ? "av-review-prompt-actions" : "rp-actions"}"><button type="button" class="${btnPrimary}" data-rp="rate">Rate on Chrome Web Store</button><button type="button" class="${btnGhost}" data-rp="later">Maybe later</button><button type="button" class="${btnQuiet}" data-rp="no">No thanks</button></div></div>`;
    const hide2 = () => {
      host.hidden = true;
      host.innerHTML = "";
    };
    const mined = countMinedCards(vocab);
    host.querySelector('[data-rp="rate"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyRate(current));
        trackExtensionEvent("review_prompt_clicked");
        chrome.tabs.create({ url: CWS_REVIEWS_URL });
        hide2();
      })();
    });
    host.querySelector('[data-rp="later"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyMaybeLater(current, mined));
        hide2();
      })();
    });
    host.querySelector('[data-rp="no"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyNoThanks(current));
        hide2();
      })();
    });
    return true;
  }

  // src/lib/onboarding-ui.ts
  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  async function mountOnboarding(opts) {
    try {
      return await mountInner(opts.host, opts.now ?? Date.now());
    } catch {
      hide(opts.host);
      return "none";
    }
  }
  function hide(host) {
    try {
      host.hidden = true;
      host.innerHTML = "";
    } catch {
    }
  }
  async function mountInner(host, now) {
    const state = await getOnboarding();
    if (shouldCelebrate(state)) {
      if (await stampOnboarding("celebratedAt", now)) {
        renderCelebration(host);
        return "celebration";
      }
    }
    if (!shouldShowChecklist({ state, now })) {
      hide(host);
      return "none";
    }
    renderChecklist(host, state, now);
    return "checklist";
  }
  function renderCelebration(host) {
    host.hidden = false;
    host.innerHTML = `<div class="av-onboarding av-onboarding-win" role="region" aria-label="First card saved"><p class="av-onboarding-title">\u{1F389} First card saved</p><p class="av-onboarding-copy">It comes back for review on its own. The dashboard is where you will meet it again.</p><button type="button" class="av-btn av-btn-primary av-btn-block" data-onb="dashboard">Open review dashboard</button></div>`;
    host.querySelector('[data-onb="dashboard"]')?.addEventListener("click", () => {
      void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    });
  }
  function renderChecklist(host, state, now) {
    const steps = checklistSteps(state);
    const rows = steps.map(
      (step, i) => `<li class="av-onboarding-step${step.done ? " done" : ""}"><span class="av-onboarding-num" aria-hidden>${step.done ? "\u2713" : i + 1}</span><span class="av-onboarding-step-title">${esc(step.title)}</span></li>`
    ).join("");
    host.hidden = false;
    host.innerHTML = `<div class="av-onboarding" role="region" aria-label="Getting started"><p class="av-onboarding-title">Three steps to your first card</p><ol class="av-onboarding-steps">${rows}</ol><button type="button" class="av-btn av-btn-primary av-btn-block" data-onb="start">Open Crunchyroll</button><button type="button" class="av-btn av-btn-quiet av-btn-block" data-onb="guide">Show me the full guide</button><button type="button" class="av-btn av-btn-quiet av-btn-block" data-onb="dismiss">Hide this</button></div>`;
    host.querySelector('[data-onb="start"]')?.addEventListener("click", () => {
      void chrome.tabs.create({ url: "https://www.crunchyroll.com/videos/popular" });
    });
    host.querySelector('[data-onb="guide"]')?.addEventListener("click", () => {
      void chrome.tabs.create({ url: chrome.runtime.getURL("welcome/welcome.html") });
    });
    host.querySelector('[data-onb="dismiss"]')?.addEventListener("click", () => {
      void (async () => {
        await stampOnboarding("checklistDismissedAt", now);
        hide(host);
      })();
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

  // src/entries/popup.ts
  var DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function todayKey() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv");
  }
  function esc2(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function byId(id) {
    return document.getElementById(id);
  }
  function weekStamps(daily) {
    const now = /* @__PURE__ */ new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
    const byDay = new Map(Object.entries(daily || {}));
    return DAY_LABELS.map((label, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const key = date.toLocaleDateString("sv");
      const stats = byDay.get(key);
      const hit = !!stats && (stats.judged > 0 || stats.reviews > 0 || stats.watchMin > 0);
      const isToday = date.toDateString() === now.toDateString();
      return { label, hit, isToday };
    });
  }
  function renderStampRally(daily) {
    const week = weekStamps(daily);
    const today = week.find((d) => d.isToday);
    const todayHit = today?.hit;
    const todayLabel = today?.label ?? "today";
    const grid = week.map(
      (d) => `<div class="${d.hit ? "av-stamp av-stamp-hit" : "av-stamp"}">${d.hit ? "\u6E08" : esc2(d.label)}</div>`
    ).join("");
    const note = todayHit ? `<b>${esc2(todayLabel)} is stamped.</b> Come back tomorrow.` : `Practice today to stamp <b>${esc2(todayLabel)}</b>.`;
    byId("stamp-rally").innerHTML = `<div class="av-stamp-head"><span>STAMP RALLY</span><span class="av-stamp-head-jp">\u30B9\u30BF\u30F3\u30D7</span></div><div class="av-stamp-grid">${grid}</div><p class="av-stamp-note">${note}</p>`;
  }
  function initTheme() {
    const btn = byId("theme-toggle");
    const icon = document.getElementById("theme-icon");
    const apply = (theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      if (!icon) return;
      if (theme === "dark") {
        icon.innerHTML = '<circle cx="12" cy="12" r="4"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"></path>';
        btn.setAttribute("aria-label", "Switch to light mode");
        btn.title = "Switch to light mode";
      } else {
        icon.innerHTML = '<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"></path>';
        btn.setAttribute("aria-label", "Switch to dark mode");
        btn.title = "Switch to dark mode";
      }
    };
    let current;
    try {
      const saved = localStorage.getItem("av-theme");
      current = saved === "light" || saved === "dark" ? saved : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch {
      current = "dark";
    }
    apply(current);
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try {
        localStorage.setItem("av-theme", next);
      } catch {
      }
    });
  }
  async function requestAccountLink(force) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: "avc-account-link",
        trigger: "popup",
        force
      });
      return res?.linked === true;
    } catch {
      return false;
    }
  }
  async function renderAccount() {
    const el = byId("account");
    const token = await getSyncToken();
    if (!token) {
      const relink = await getRelinkNeeded();
      const title2 = relink ? ACCOUNT_COPY.popupExpired : ACCOUNT_COPY.popupNotSignedIn;
      const sub2 = relink ? ACCOUNT_COPY.popupExpiredNote : ACCOUNT_COPY.popupNotSignedInNote;
      const cta = relink ? ACCOUNT_COPY.reconnect : ACCOUNT_COPY.connect;
      const dot2 = relink ? "av-dot av-dot-warn" : "av-dot av-dot-off";
      el.innerHTML = `<div class="av-account-row"><span class="${dot2}"></span><div><b>${title2}</b><span class="av-account-sub">${sub2}</span></div></div><button id="signin-btn" class="av-btn av-btn-primary av-btn-block" type="button">${cta}</button>`;
      byId("signin-btn").addEventListener("click", () => {
        void (async () => {
          const btn = byId("signin-btn");
          btn.disabled = true;
          btn.textContent = ACCOUNT_COPY.connecting;
          if (await requestAccountLink(true)) {
            await renderAccount();
            void renderUsage();
            return;
          }
          chrome.tabs.create({ url: ownedWebUrl("/app", "popup_account") });
          btn.disabled = false;
          btn.textContent = cta;
        })();
      });
      return;
    }
    const profile = await getSyncProfile();
    const sync = await getSyncStatus();
    const who = profile?.email || profile?.name || ACCOUNT_COPY.unnamedAccount;
    const plan = planLabel(profile?.plan);
    const staleSync = sync.state === "syncing" && !!sync.lastAttemptAt && Date.now() - sync.lastAttemptAt > 2 * 6e4;
    const lastGood = sync.lastSuccessAt ? relativeTime(sync.lastSuccessAt) : "not backed up yet";
    const title = staleSync || sync.state === "error" ? "Cloud sync issue" : sync.state === "syncing" ? "Syncing now\u2026" : "Cloud sync on";
    const sub = staleSync ? `Previous sync was interrupted \xB7 last good sync ${lastGood}` : sync.state === "error" ? `${sync.error || "Couldn't reach cloud."} \xB7 last good sync ${lastGood}` : sync.state === "ok" ? `Synced as ${who} \xB7 ${lastGood}` : `Connected as ${who} \xB7 waiting for first backup`;
    const dot = staleSync || sync.state === "error" ? "av-dot av-dot-warn" : "av-dot";
    el.innerHTML = `<div class="av-account-row"><span class="${dot}"></span><div><b>${title}</b><span class="av-account-sub">${esc2(sub)}</span></div>` + (plan ? `<span class="av-account-plan">${esc2(plan)}</span>` : "") + `</div>` + (staleSync || sync.state === "error" ? `<button id="sync-retry" class="av-btn av-btn-ghost av-btn-block" type="button">Retry cloud sync</button>` : "");
    document.getElementById("sync-retry")?.addEventListener("click", () => {
      void chrome.runtime.sendMessage({ type: "avc-sync-now" });
    });
  }
  function relativeTime(timestamp) {
    const elapsed = Math.max(0, Date.now() - timestamp);
    if (elapsed < 15e3) return "just now";
    const minutes = Math.floor(elapsed / 6e4);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
  function meterMarkup(label, used, limit, unit) {
    if (!limit) return "";
    const pct = Math.min(100, Math.round(used / limit * 100));
    const cls = pct >= 100 ? "av-meter-fill av-meter-full" : pct >= 85 ? "av-meter-fill av-meter-low" : "av-meter-fill";
    const fmt = (n) => unit === "minutes" ? `${Number.isInteger(n / 60) ? n / 60 : (n / 60).toFixed(1)}h` : n.toLocaleString();
    return `<div class="av-meter"><div class="av-meter-row"><span>${esc2(label)}</span><span class="av-meter-val">${esc2(fmt(Math.min(used, limit)))} / ${esc2(fmt(limit))}</span></div><div class="av-meter-track"><div class="${cls}" style="width:${pct}%"></div></div></div>`;
  }
  function meterLow(m) {
    return !!m && m.limit > 0 && m.used / m.limit >= 0.8;
  }
  async function renderUsage() {
    const el = byId("usage");
    const token = await getSyncToken();
    if (!token) {
      el.hidden = true;
      return;
    }
    let usage = null;
    try {
      const res = await chrome.runtime.sendMessage({ type: "avc-usage" });
      if (res?.ok && res.usage) usage = res.usage;
    } catch {
    }
    if (!usage) {
      el.hidden = true;
      return;
    }
    const planName = usage.plan === "max" ? "Max" : usage.plan === "pro" ? "Pro" : "Free";
    const bars = usage.unlimited ? "" : (usage.ai ? meterMarkup("AI messages", usage.ai.used, usage.ai.limit, "calls") : "") + (usage.listening ? meterMarkup("Listening Mode", usage.listening.used, usage.listening.limit, "minutes") : "");
    const meters = usage.unlimited ? `<p class="av-usage-note">No caps on this account.</p>` : bars || `<p class="av-usage-note">Usage is unavailable right now.</p>`;
    const aiLow = !usage.unlimited && meterLow(usage.ai);
    const listenLow = !usage.unlimited && meterLow(usage.listening);
    const offer = usage.plan === "free" ? usage.tiers?.pro : usage.plan === "pro" ? usage.tiers?.max : null;
    const cta = (aiLow || listenLow) && offer?.checkoutUrl ? `<button id="usage-upgrade" class="av-btn av-btn-primary av-btn-block av-usage-cta" type="button">Upgrade to ${esc2(offer.name)} \xB7 ${esc2(offer.priceLabel)}</button>` : "";
    el.innerHTML = `<div class="av-usage-head"><span class="av-usage-title">This month</span><span class="av-usage-plan">${esc2(planName)}</span></div>` + meters + cta;
    el.hidden = false;
    if (cta && offer?.checkoutUrl) {
      trackExtensionEvent("upgrade_prompt_shown");
      byId("usage-upgrade").addEventListener("click", () => {
        trackExtensionEvent("upgrade_prompt_clicked");
        trackExtensionEvent("checkout_started");
        chrome.tabs.create({ url: offer.checkoutUrl });
      });
    }
  }
  async function render() {
    const vocab = await getVocab();
    const stats = await getStats();
    const due = dueCount(vocab);
    renderStampRally(stats.daily || {});
    const reviewBtn = byId("review-due");
    if (due > 0) {
      reviewBtn.hidden = false;
      reviewBtn.textContent = `Review ${due} due word${due > 1 ? "s" : ""}`;
    } else {
      reviewBtn.hidden = true;
    }
    await mountReviewPrompt({ host: byId("review-prompt"), variant: "popup" });
    await mountOnboarding({ host: byId("onboarding") });
  }
  async function activeTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }
  function runtimeMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(void 0);
          return;
        }
        resolve(response);
      });
    });
  }
  function setModeRow(id, status, detail, state) {
    byId(`${id}-status`).textContent = status;
    const detailEl = document.getElementById(`${id}-detail`);
    if (detailEl) detailEl.textContent = detail;
    const dot = byId(`${id}-dot`);
    dot.className = `av-mode-dot${state === "on" ? " on" : state === "warn" ? " warn" : ""}`;
  }
  async function initModeControls() {
    const copilotBtn = byId("copilot-btn");
    const listeningBtn = byId("listening-btn");
    const sessionBtn = byId("study-session-btn");
    const errEl = byId("listen-error");
    const tabId = await activeTabId();
    if (tabId == null) {
      copilotBtn.disabled = true;
      listeningBtn.disabled = true;
      sessionBtn.disabled = true;
      sessionBtn.textContent = "No active tab";
      return;
    }
    let modeState = null;
    const refresh = async () => {
      const [settings, agent, listening, captions] = await Promise.all([
        getSettings(),
        runtimeMessage({ type: "avc-agent-status", tabId }),
        runtimeMessage({ type: "avc-listen-status", tabId }),
        runtimeMessage({
          type: "avc-caption-status",
          tabId
        })
      ]);
      modeState = {
        settings,
        copilot: !!agent?.visible,
        listening: !!listening?.listening,
        captionDetail: captions?.detail ?? null,
        captionsMissing: captions?.report?.state === "missing"
      };
      const lensConfigured = settings.subLens !== false;
      const lensSupported = settings.learningDirection === "en-ja";
      setModeRow(
        "mode-lens",
        lensConfigured && lensSupported ? "On" : "Off",
        !lensSupported ? "Available while learning Japanese" : lensConfigured ? "Hover or click subtitle words" : "Enable in Settings",
        lensConfigured && lensSupported ? "on" : lensConfigured ? "warn" : "off"
      );
      const cardStatus = settings.pauseMode === "pause" ? "Focus" : settings.pauseMode === "copilot" ? "Ambient" : "Off";
      const cardDetail = settings.pauseMode === "pause" ? "Pauses for each automatic card" : settings.pauseMode === "copilot" ? "Shows automatic cards without pausing" : "Subtitle Lens can still run";
      setModeRow(
        "mode-cards",
        cardStatus,
        modeState.captionDetail || cardDetail,
        settings.pauseMode === "off" ? "off" : modeState.captionsMissing ? "warn" : "on"
      );
      setModeRow("mode-listen", modeState.listening ? "Live" : "Off", "", modeState.listening ? "on" : "off");
      setModeRow("mode-copilot", modeState.copilot ? "Open" : "Closed", "", modeState.copilot ? "on" : "off");
      listeningBtn.textContent = modeState.listening ? "Stop Listening" : "Start Listening";
      listeningBtn.classList.toggle("active", modeState.listening);
      copilotBtn.textContent = modeState.copilot ? "Close Copilot" : "Open Copilot";
      copilotBtn.classList.toggle("active", modeState.copilot);
      sessionBtn.textContent = modeState.listening && modeState.copilot ? "Stop Listening + Copilot" : "Start Listening + Copilot";
    };
    const setListening = async (active) => {
      errEl.hidden = true;
      const res = await runtimeMessage({
        type: active ? "avc-listen-start" : "avc-listen-stop",
        tabId
      });
      if (res?.ok === false && res.error) {
        errEl.textContent = res.error;
        errEl.hidden = false;
      }
    };
    const setCopilot = async (active) => {
      await runtimeMessage({ type: active ? "avc-agent-show" : "avc-agent-hide", tabId });
    };
    listeningBtn.addEventListener("click", () => {
      void (async () => {
        await setListening(!modeState?.listening);
        await refresh();
      })();
    });
    copilotBtn.addEventListener("click", () => {
      void (async () => {
        await setCopilot(!modeState?.copilot);
        await refresh();
      })();
    });
    sessionBtn.addEventListener("click", () => {
      void (async () => {
        const stopBoth = !!modeState?.listening && !!modeState?.copilot;
        if (stopBoth) {
          await Promise.all([setListening(false), setCopilot(false)]);
        } else {
          await setCopilot(true);
          await setListening(true);
        }
        await refresh();
      })();
    });
    await refresh();
  }
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    void render();
    void renderAccount();
    void renderUsage();
    void initModeControls();
    void (async () => {
      if (await getSyncToken()) return;
      await requestAccountLink(false);
    })();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.syncToken || changes.syncProfile || changes.relinkNeeded || changes.syncStatus)) {
        void renderAccount();
        void renderUsage();
      }
    });
    byId("cloud-link").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: ownedWebUrl("/app", "popup_cloud") });
    });
    byId("review-due").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html#review") });
    });
    byId("settings-link").addEventListener("click", async (e) => {
      e.preventDefault();
      const token = await getSyncToken();
      if (token) {
        chrome.tabs.create({ url: ownedWebUrl("/app#settings", "popup_settings") });
      } else {
        chrome.runtime.openOptionsPage();
      }
    });
    byId("export-link").addEventListener("click", async (e) => {
      e.preventDefault();
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animevocab-export-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });
})();
