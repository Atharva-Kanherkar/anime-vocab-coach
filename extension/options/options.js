"use strict";
(() => {
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
  var REVIEW_PROMPT_SNOOZE_MS = 14 * 24 * 36e5;

  // src/lib/storage.ts
  var queue = Promise.resolve();
  function todayKey() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv");
  }
  function enqueue(fn) {
    const next = queue.then(fn, fn);
    queue = next.catch((err) => warn("storage error:", err));
    return next;
  }
  function emptyStats() {
    return { daily: {}, cardTimestamps: [] };
  }
  function sendBadge(stats) {
    const day = todayKey();
    const judged = stats.daily?.[day]?.judged || 0;
    chrome.runtime.sendMessage({ type: "avc-badge", count: judged }).catch(() => {
    });
  }
  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings"], (r) => {
        resolve({ ...DEFAULTS, ...r.settings || {} });
      });
    });
  }
  function setSettings(partial) {
    return enqueue(async () => {
      const r = await chrome.storage.local.get(["settings"]);
      const settings = { ...DEFAULTS, ...r.settings || {}, ...partial };
      await chrome.storage.local.set({ settings });
      return settings;
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
  function resetProgress() {
    return enqueue(async () => {
      await chrome.storage.local.set({ vocab: {}, stats: emptyStats() });
      sendBadge({ daily: {} });
    });
  }

  // src/config.ts
  var WEB_URL = "https://animevocab.com";

  // src/entries/options.ts
  function todayKey2() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv");
  }
  function byId(id) {
    return document.getElementById(id);
  }
  function showSaved() {
    const el = byId("saved-msg");
    el.hidden = false;
    setTimeout(() => {
      el.hidden = true;
    }, 1500);
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
      } else {
        icon.innerHTML = '<path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5z"></path>';
        btn.setAttribute("aria-label", "Switch to dark mode");
      }
    };
    apply(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try {
        localStorage.setItem("av-theme", next);
      } catch {
      }
    });
  }
  async function loadSettingsForm() {
    const s = await getSettings();
    document.querySelectorAll('input[name="pauseMode"]').forEach((el) => {
      el.checked = el.value === s.pauseMode;
    });
    byId("cooldownSec").value = String(s.cooldownSec);
    byId("maxCardsPerHour").value = String(s.maxCardsPerHour);
    byId("targetLevel").value = String(s.targetLevel);
    byId("autoResumeSec").value = String(s.autoResumeSec);
    byId("site-youtube").checked = s.sites?.youtube !== false;
    byId("site-netflix").checked = s.sites?.netflix !== false;
    byId("site-generic").checked = s.sites?.generic !== false;
    byId("displayScript").value = s.displayScript || "romaji";
    byId("autoSpeak").checked = s.autoSpeak !== false;
    byId("openaiKey").value = s.openaiKey || "";
    byId("transcribeModel").value = s.transcribeModel || "gpt-4o-mini-transcribe";
  }
  async function savePartial(partial) {
    await setSettings(partial);
    showSaved();
  }
  document.addEventListener("DOMContentLoaded", async () => {
    const token = await getSyncToken();
    if (token) {
      window.location.replace(`${WEB_URL}/app#settings`);
      return;
    }
    initTheme();
    await loadSettingsForm();
    document.querySelectorAll('input[name="pauseMode"]').forEach((el) => {
      el.addEventListener("change", () => savePartial({ pauseMode: el.value }));
    });
    byId("cooldownSec").addEventListener("change", (e) => {
      const v = Number(e.target.value) || 20;
      savePartial({ cooldownSec: Math.max(5, Math.min(120, v)) });
    });
    byId("maxCardsPerHour").addEventListener("change", (e) => {
      const v = Number(e.target.value) || 12;
      savePartial({ maxCardsPerHour: Math.max(1, Math.min(60, v)) });
    });
    byId("targetLevel").addEventListener("change", (e) => {
      savePartial({ targetLevel: Number(e.target.value) });
    });
    byId("autoResumeSec").addEventListener("change", (e) => {
      savePartial({ autoResumeSec: Math.max(0, Number(e.target.value) || 0) });
    });
    byId("site-youtube").addEventListener("change", async (e) => {
      const s = await getSettings();
      savePartial({ sites: { ...s.sites, youtube: e.target.checked } });
    });
    byId("site-netflix").addEventListener("change", async (e) => {
      const s = await getSettings();
      savePartial({ sites: { ...s.sites, netflix: e.target.checked } });
    });
    byId("site-generic").addEventListener("change", async (e) => {
      const s = await getSettings();
      savePartial({ sites: { ...s.sites, generic: e.target.checked } });
    });
    byId("displayScript").addEventListener("change", (e) => {
      savePartial({ displayScript: e.target.value });
    });
    byId("autoSpeak").addEventListener("change", (e) => {
      savePartial({ autoSpeak: e.target.checked });
    });
    byId("openaiKey").addEventListener("change", (e) => {
      savePartial({ openaiKey: e.target.value.trim() });
    });
    byId("transcribeModel").addEventListener("change", (e) => {
      savePartial({ transcribeModel: e.target.value });
    });
    byId("export-btn").addEventListener("click", async () => {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animevocab-export-${todayKey2()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    byId("reset-btn").addEventListener("click", async () => {
      if (!confirm("Reset all vocab and stats? Settings will be kept.")) return;
      await resetProgress();
    });
  });
})();
