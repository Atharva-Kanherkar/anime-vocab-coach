"use strict";
(() => {
  // src/config.ts
  var WEB_URL = "https://animevocab.com";

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

  // src/lib/storage.ts
  var queue = Promise.resolve();
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

  // src/lib/review.ts
  function dueCount(vocab, now = Date.now()) {
    let n = 0;
    for (const base of Object.keys(vocab)) {
      const r = vocab[base];
      if (r.state === "learning" && r.srs && r.srs.dueAt <= now) n++;
    }
    return n;
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
  }
  async function activeTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }
  async function initListening() {
    const btn = byId("listen-btn");
    const errEl = byId("listen-error");
    const tabId = await activeTabId();
    if (tabId == null) return;
    const setUi = (listening) => {
      btn.classList.toggle("active", listening);
      btn.textContent = listening ? "Stop Listening Mode" : "Start Listening Mode";
    };
    chrome.runtime.sendMessage({ type: "avc-listen-status", tabId }, (res) => {
      setUi(!!res?.listening);
    });
    btn.addEventListener("click", () => {
      errEl.hidden = true;
      const starting = !btn.classList.contains("active");
      const type = starting ? "avc-listen-start" : "avc-listen-stop";
      chrome.runtime.sendMessage({ type, tabId }, (res) => {
        if (res?.ok) {
          setUi(starting);
        } else {
          errEl.textContent = res?.error || "Failed to toggle listening mode.";
          errEl.hidden = false;
        }
      });
    });
  }
  async function initCopilotToggle() {
    const btn = byId("copilot-btn");
    const tabId = await activeTabId();
    if (tabId == null) {
      btn.disabled = true;
      btn.textContent = "Open Copilot (no active tab)";
      return;
    }
    const refresh = () => {
      chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
        const on = !!res?.visible;
        btn.textContent = on ? "Hide Copilot on this tab" : "Open Copilot on this tab";
        btn.classList.toggle("active", on);
      });
    };
    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "avc-agent-status", tabId }, (res) => {
        const type = res?.visible ? "avc-agent-hide" : "avc-agent-show";
        chrome.runtime.sendMessage({ type, tabId }, () => refresh());
      });
    });
    refresh();
  }
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    void render();
    void initListening();
    void initCopilotToggle();
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
