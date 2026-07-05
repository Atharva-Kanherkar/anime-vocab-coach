"use strict";
(() => {
  // src/types.ts
  var DEFAULTS = {
    pauseMode: "pause",
    cooldownSec: 20,
    maxCardsPerHour: 12,
    targetLevel: 5,
    autoResumeSec: 0,
    displayScript: "romaji",
    autoSpeak: true,
    openaiKey: "",
    transcribeModel: "gpt-4o-mini-transcribe",
    sites: { youtube: true, netflix: true, generic: true }
  };
  var SRS_INTERVALS = [0, 4 * 36e5, 24 * 36e5, 3 * 24 * 36e5, 7 * 24 * 36e5, 21 * 24 * 36e5];

  // src/config.ts
  var BACKEND_URL = "https://api.animevocab.com";
  var WEB_URL = "https://animevocab.com";

  // src/lib/log.ts
  var log = (...args) => console.log("[AVC]", ...args);
  var warn = (...args) => console.warn("[AVC]", ...args);

  // src/lib/storage.ts
  var queue = Promise.resolve();
  function enqueue(fn) {
    const next = queue.then(fn, fn);
    queue = next.catch((err) => warn("storage error:", err));
    return next;
  }
  function emptyStats() {
    return { daily: {}, cardTimestamps: [] };
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
  function setSyncToken(token) {
    return enqueue(async () => {
      await chrome.storage.local.set({ syncToken: token });
    });
  }

  // src/lib/cloud-sync.ts
  var SNAPSHOT_URL = WEB_URL + "/api/sync/snapshot";
  var syncing = false;
  async function currentRevision(token) {
    try {
      const res = await fetch(SNAPSHOT_URL, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) return null;
      const data = await res.json();
      return data.envelope?.revision ?? null;
    } catch {
      return null;
    }
  }
  async function pushSnapshot() {
    if (syncing) return;
    const token = await getSyncToken();
    if (!token) return;
    syncing = true;
    try {
      const exportData = await exportAll();
      let expectedRevision = await currentRevision(token);
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(SNAPSHOT_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ export: exportData, expectedRevision })
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          expectedRevision = data.conflict?.currentRevision ?? null;
          continue;
        }
        if (res.status === 401) {
          warn("cloud sync: token rejected (signed out or expired) \u2014 clearing");
          await setSyncToken("");
          return;
        }
        if (!res.ok) {
          warn("cloud sync failed: HTTP", res.status);
          return;
        }
        log("cloud sync ok");
        return;
      }
      warn("cloud sync: gave up after revision conflict");
    } catch (err) {
      warn("cloud sync error:", err);
    } finally {
      syncing = false;
    }
  }

  // src/lib/coach-client.ts
  async function fetchCoach(mode, payload) {
    const token = await getSyncToken();
    if (!token) return { ok: false, error: "not_linked" };
    try {
      const res = await fetch(WEB_URL + "/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ mode, ...payload })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || `http_${res.status}` };
      return { ok: true, result: data.result };
    } catch {
      return { ok: false, error: "network" };
    }
  }

  // src/entries/background.ts
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["settings"], (result) => {
      const raw = result.settings || {};
      delete raw.licenseKey;
      chrome.storage.local.set({ settings: { ...DEFAULTS, ...raw } });
    });
  });
  var SYNC_ALARM = "avc-cloud-sync";
  var syncDebounce = null;
  function scheduleSync(delayMs = 8e3) {
    if (syncDebounce) clearTimeout(syncDebounce);
    syncDebounce = setTimeout(() => {
      syncDebounce = null;
      pushSnapshot().catch(() => {
      });
    }, delayMs);
  }
  chrome.runtime.onStartup.addListener(() => pushSnapshot().catch(() => {
  }));
  chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 30 }));
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) pushSnapshot().catch(() => {
    });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.vocab || changes.stats)) scheduleSync();
  });
  async function getListening() {
    const r = await chrome.storage.session.get(["listeningTabs"]);
    return r.listeningTabs || {};
  }
  async function setListening(tabs) {
    await chrome.storage.session.set({ listeningTabs: tabs });
  }
  async function ensureOffscreen() {
    if (chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: "Capture tab audio and transcribe Japanese speech so vocabulary cards can be shown for what the viewer hears."
    });
  }
  async function sendToOffscreen(msg, tries = 15) {
    for (let i = 0; i < tries; i++) {
      try {
        const res = await chrome.runtime.sendMessage(msg);
        if (res && res.ok) return res;
        if (res && res.ok === false) return res;
      } catch (err) {
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error("offscreen document never acknowledged (audio capture could not start)");
  }
  var CONTENT_SCRIPTS = ["vendor/kuromoji.js", "content.js"];
  async function ensureContentScript(tabId) {
    try {
      const [probe] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => !!window.__avcMainLoaded
      });
      if (probe && probe.result) return true;
    } catch (err) {
    }
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPTS });
      console.log("[AVC] injected content scripts into tab", tabId);
      return true;
    } catch (err) {
      console.warn("[AVC] content-script injection failed:", String(err));
      return false;
    }
  }
  async function getCacheKeyFromTab(tabId) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "avc-get-cache-key" });
      return res?.key || null;
    } catch {
      return null;
    }
  }
  var NOT_LINKED_MSG = "Sign in at animevocab.com/app, keep that tab open briefly, then try again. Or add your OpenAI key in Settings for local-only Listening Mode.";
  async function startListening(tabId) {
    const r = await chrome.storage.local.get(["settings"]);
    const settings = r.settings || {};
    let auth;
    if (settings.openaiKey?.trim()) {
      auth = { kind: "byo", key: settings.openaiKey.trim() };
    } else {
      const syncToken = await getSyncToken();
      if (!syncToken) {
        return { ok: false, error: NOT_LINKED_MSG };
      }
      auth = { kind: "cloud", syncToken, backendUrl: BACKEND_URL };
    }
    const injected = await ensureContentScript(tabId);
    if (!injected) {
      return { ok: false, error: "Couldn't load the extension into this tab. Try reloading the page, then Start again." };
    }
    const cacheKey = auth.kind === "cloud" ? await getCacheKeyFromTab(tabId) : null;
    if (auth.kind === "cloud" && !cacheKey) {
      console.warn("[AVC] no cache key yet \u2014 listening will wait for fingerprint or page ID");
    }
    let streamId;
    try {
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { ok: false, error: "Couldn't capture this tab's audio: " + detail + ". Try clicking the extension icon again directly on the video tab." };
    }
    await ensureOffscreen();
    const ack = await sendToOffscreen({
      type: "avc-offscreen-start",
      streamId,
      tabId,
      auth,
      model: settings.transcribeModel || DEFAULTS.transcribeModel,
      cacheKey: cacheKey || void 0
    }).catch((err) => ({ ok: false, error: String(err.message || err) }));
    if (!ack || ack.ok === false) {
      return { ok: false, error: ack?.error || "Audio capture failed to start." };
    }
    const tabs = await getListening();
    tabs[tabId] = true;
    await setListening(tabs);
    chrome.tabs.sendMessage(tabId, { type: "avc-listening-state", active: true }).catch(() => {
    });
    chrome.action.setBadgeText({ tabId, text: "REC" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#f87171" });
    console.log("[AVC] listening started on tab", tabId, "model", settings.transcribeModel || DEFAULTS.transcribeModel);
    return { ok: true };
  }
  async function stopListening(tabId) {
    chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {
    });
    chrome.tabs.sendMessage(tabId, { type: "avc-listening-state", active: false }).catch(() => {
    });
    const tabs = await getListening();
    delete tabs[tabId];
    await setListening(tabs);
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {
    });
    return { ok: true };
  }
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "avc-badge") {
      const text = (msg.count || 0) > 0 ? String(msg.count) : "";
      chrome.action.setBadgeText({ text });
      chrome.action.setBadgeBackgroundColor({ color: "#c4553a" });
      return;
    }
    if (msg.type === "avc-listen-start") {
      startListening(msg.tabId).then(sendResponse).catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
      return true;
    }
    if (msg.type === "avc-listen-stop") {
      stopListening(msg.tabId).then(sendResponse);
      return true;
    }
    if (msg.type === "avc-listen-status") {
      getListening().then((tabs) => sendResponse({ listening: !!tabs[msg.tabId] }));
      return true;
    }
    if (msg.type === "avc-offscreen-log") {
      console.log("[AVC-audio]", msg.line);
      return;
    }
    if (msg.type === "avc-sync-now") {
      pushSnapshot().catch(() => {
      });
      return;
    }
    if (msg.type === "avc-coach") {
      fetchCoach(msg.mode, msg.payload).then(sendResponse).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-transcript") {
      console.log("[AVC] relaying transcript to tab", msg.tabId, "\u2192", msg.text);
      chrome.tabs.sendMessage(msg.tabId, { type: "avc-transcript", text: msg.text }).catch((err) => {
        console.warn("[AVC] could not deliver transcript to tab (content script not loaded?):", String(err));
      });
      return;
    }
    if (msg.type === "avc-playback-time" && sender.tab?.id != null) {
      chrome.runtime.sendMessage({
        type: "avc-playback-time",
        tabId: sender.tab.id,
        time: msg.time,
        paused: msg.paused
      }).catch(() => {
      });
      return;
    }
    if (msg.type === "avc-listen-error") {
      getListening().then(async (tabs) => {
        if (msg.code === "invalid-key" || msg.code === "capture-failed" || msg.code === "quota-exceeded" || msg.code === "not-signed-in") {
          delete tabs[msg.tabId];
          await setListening(tabs);
          chrome.action.setBadgeText({ tabId: msg.tabId, text: "ERR" });
          chrome.action.setBadgeBackgroundColor({ tabId: msg.tabId, color: "#f87171" });
        }
        console.warn("[AVC] listening error:", msg.code, msg.detail || "");
      });
    }
  });
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const tabs = await getListening();
    if (tabs[tabId]) {
      chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {
      });
      delete tabs[tabId];
      await setListening(tabs);
    }
  });
})();
