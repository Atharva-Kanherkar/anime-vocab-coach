"use strict";
(() => {
  // src/config.ts
  var WEB_URL = "https://animevocab.com";
  var CWS_EXTENSION_ID = "lkjbomofgfonjjbemobacegffepbdnel";

  // src/lib/log.ts
  var warn = (...args) => console.warn("[AVC]", ...args);

  // src/types.ts
  var DEFAULTS = {
    pauseMode: "copilot",
    cooldownSec: 20,
    maxCardsPerHour: 12,
    targetLevel: 5,
    autoResumeSec: 15,
    displayScript: "romaji",
    autoSpeak: true,
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
  function normalizeReviewPrompt(raw) {
    if (!raw || typeof raw !== "object") return { ...EMPTY_REVIEW_PROMPT };
    const o = raw;
    return {
      dismissedForever: !!o.dismissedForever,
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

  // src/lib/storage.ts
  var queue = Promise.resolve();
  function enqueue(fn) {
    const next = queue.then(fn, fn);
    queue = next.catch((err) => warn("storage error:", err));
    return next;
  }
  function pruneTimestamps(timestamps) {
    const cutoff = Date.now() - 36e5;
    return (timestamps || []).filter((t) => t >= cutoff);
  }
  function emptyStats() {
    return { daily: {}, cardTimestamps: [] };
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
          settings: { ...DEFAULTS, ...r.settings || {} },
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
  function getSyncProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncProfile"], (r) => {
        const p = r.syncProfile;
        resolve(p && typeof p === "object" ? { email: p.email ?? null, name: p.name ?? null } : null);
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
    return enqueue(async () => {
      const state = normalizeReviewPrompt(next);
      await chrome.storage.local.set({ reviewPrompt: state });
      return state;
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

  // src/lib/extension-events.ts
  var EXTENSION_EVENTS = [
    "review_prompt_shown",
    "review_prompt_clicked"
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
      const headers = {
        "content-type": "application/json",
        "x-avc-extension-id": extensionId()
      };
      void fetch(url, {
        method: "POST",
        headers,
        body: payload,
        keepalive: true
      }).catch(() => {
        try {
          if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
          }
        } catch {
        }
      });
    } catch {
    }
  }

  // src/lib/review-prompt-ui.ts
  async function mountReviewPrompt(opts) {
    const { host, blocked = false, variant = "popup" } = opts;
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
    if (shouldCountShown(prompt, now)) {
      await setReviewPrompt(applyShown(prompt, now));
      trackExtensionEvent("review_prompt_shown");
    }
    const rootClass = variant === "popup" ? "av-review-prompt" : "rp-card";
    const btnPrimary = variant === "popup" ? "av-btn av-btn-primary av-btn-block" : "rp-btn rp-btn-primary";
    const btnGhost = variant === "popup" ? "av-btn av-btn-ghost av-btn-block" : "rp-btn rp-btn-ghost";
    const btnQuiet = variant === "popup" ? "av-btn av-btn-quiet av-btn-block" : "rp-btn rp-btn-quiet";
    host.hidden = false;
    host.innerHTML = `<div class="${rootClass}" role="region" aria-label="Rate AnimeVocab"><p class="${variant === "popup" ? "av-review-prompt-copy" : "rp-copy"}">Enjoying AnimeVocab? A rating helps other learners find it.</p><div class="${variant === "popup" ? "av-review-prompt-actions" : "rp-actions"}"><button type="button" class="${btnPrimary}" data-rp="rate">Rate on Chrome Web Store</button><button type="button" class="${btnGhost}" data-rp="later">Maybe later</button><button type="button" class="${btnQuiet}" data-rp="no">No thanks</button></div></div>`;
    const hide = () => {
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
        hide();
      })();
    });
    host.querySelector('[data-rp="later"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyMaybeLater(current, mined));
        hide();
      })();
    });
    host.querySelector('[data-rp="no"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyNoThanks(current));
        hide();
      })();
    });
    return true;
  }

  // src/entries/popup.ts
  var DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function todayKey() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv");
  }
  function esc(s) {
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
      (d) => `<div class="${d.hit ? "av-stamp av-stamp-hit" : "av-stamp"}">${d.hit ? "\u6E08" : esc(d.label)}</div>`
    ).join("");
    const note = todayHit ? `<b>${esc(todayLabel)} is stamped.</b> Come back tomorrow.` : `Practice today to stamp <b>${esc(todayLabel)}</b>.`;
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
    const current = document.documentElement.getAttribute("data-theme");
    apply(current === "light" ? "light" : "dark");
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try {
        localStorage.setItem("av-theme", next);
      } catch {
      }
    });
  }
  async function renderAccount() {
    const el = byId("account");
    const token = await getSyncToken();
    if (!token) {
      const relink = await getRelinkNeeded();
      const title = relink ? "Sign-in expired" : "Not signed in";
      const sub = relink ? "Re-link to resume cloud sync" : "Progress stays on this device only";
      const cta = relink ? "Re-link \u2014 animevocab.com" : "Sign in to sync \u2014 animevocab.com";
      const dot = relink ? "av-dot av-dot-warn" : "av-dot av-dot-off";
      el.innerHTML = `<div class="av-account-row"><span class="${dot}"></span><div><b>${title}</b><span class="av-account-sub">${sub}</span></div></div><button id="signin-btn" class="av-btn av-btn-primary av-btn-block" type="button">${cta}</button>`;
      byId("signin-btn").addEventListener("click", () => {
        chrome.tabs.create({ url: `${WEB_URL}/app` });
      });
      return;
    }
    const profile = await getSyncProfile();
    const who = profile?.email || profile?.name || "your account";
    el.innerHTML = `<div class="av-account-row"><span class="av-dot"></span><div><b>Cloud sync on</b><span class="av-account-sub">Synced as ${esc(who)}</span></div></div>`;
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
  }
  async function activeTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }
  async function initCopilotToggle() {
    const btn = byId("copilot-btn");
    const errEl = byId("listen-error");
    const tabId = await activeTabId();
    if (tabId == null) {
      btn.disabled = true;
      btn.textContent = "Open Copilot (no active tab)";
      return;
    }
    const refresh = () => {
      chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
        const on = !!res?.visible;
        btn.textContent = on ? "Stop Copilot & Listening" : "Open Copilot on this tab";
        btn.classList.toggle("active", on);
      });
    };
    btn.addEventListener("click", () => {
      errEl.hidden = true;
      chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
        const type = res?.visible ? "avc-agent-hide" : "avc-agent-show";
        chrome.runtime.sendMessage({ type, tabId }, (r) => {
          if (r && r.ok === false && r.error) {
            errEl.textContent = r.error;
            errEl.hidden = false;
          }
          refresh();
        });
      });
    });
    refresh();
  }
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    void render();
    void renderAccount();
    void initCopilotToggle();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.syncToken || changes.syncProfile || changes.relinkNeeded)) void renderAccount();
    });
    byId("cloud-link").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: `${WEB_URL}/app` });
    });
    byId("review-due").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html#review") });
    });
    byId("settings-link").addEventListener("click", async (e) => {
      e.preventDefault();
      const token = await getSyncToken();
      if (token) {
        chrome.tabs.create({ url: `${WEB_URL}/app#settings` });
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
