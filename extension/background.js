"use strict";
(() => {
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
      if (token) {
        await chrome.storage.local.set({
          syncToken: token,
          relinkNeeded: false,
          syncAuthFailures: 0
        });
      } else {
        await chrome.storage.local.set({ syncToken: "", syncProfile: null });
      }
    });
  }
  function getSyncAuthFailures() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncAuthFailures"], (r) => resolve(Number(r.syncAuthFailures) || 0));
    });
  }
  function setSyncAuthFailures(n) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ syncAuthFailures: Math.max(0, n) }, () => resolve());
    });
  }
  function setRelinkNeeded(needed) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ relinkNeeded: needed }, () => resolve());
    });
  }

  // src/lib/notify.ts
  function toastTab(tabId, text, kind = "info") {
    chrome.tabs.sendMessage(tabId, { type: "avc-toast", text, kind }).catch(() => {
    });
  }
  async function toastActiveTab(text, kind = "info") {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tabId = tabs[0]?.id;
      if (tabId != null) toastTab(tabId, text, kind);
    } catch {
    }
  }

  // src/lib/cloud-sync.ts
  var SNAPSHOT_URL = WEB_URL + "/api/sync/snapshot";
  var MAX_SYNC_401 = 3;
  async function noteAuthFailure() {
    const failures = await getSyncAuthFailures() + 1;
    await setSyncAuthFailures(failures);
    if (failures < MAX_SYNC_401) {
      warn(`cloud sync: 401 #${failures}/${MAX_SYNC_401} \u2014 tolerating (transient auth blip?)`);
      return false;
    }
    warn("cloud sync: token rejected repeatedly \u2014 unlinking, re-link needed");
    await setSyncToken("");
    await setRelinkNeeded(true);
    await toastActiveTab("AnimeVocab sync signed out \u2014 re-link at animevocab.com to keep your progress in the cloud.", "error");
    return true;
  }
  async function noteSyncSuccess() {
    if (await getSyncAuthFailures() > 0) await setSyncAuthFailures(0);
  }
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
  async function syncWithCloud() {
    await pushSnapshot();
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
          await noteAuthFailure();
          return;
        }
        if (!res.ok) {
          warn("cloud sync failed: HTTP", res.status);
          return;
        }
        await noteSyncSuccess();
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
  async function postCoach(body) {
    const token = await getSyncToken();
    if (!token) return { ok: false, error: "not_linked" };
    try {
      const res = await fetch(WEB_URL + "/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || `http_${res.status}` };
      return { ok: true, result: data.result };
    } catch {
      return { ok: false, error: "network" };
    }
  }
  async function fetchCoach(mode, payload) {
    return postCoach({ mode, ...payload });
  }
  async function fetchChat(message, history, payload) {
    return postCoach({ mode: "chat", message, history, ...payload });
  }
  async function streamChat(message, history, payload, onChunk) {
    const token = await getSyncToken();
    if (!token) return { ok: false, error: "not_linked" };
    try {
      const res = await fetch(WEB_URL + "/api/ai/coach/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ mode: "chat", message, history, ...payload })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error || `http_${res.status}` };
      }
      if (!res.body) return { ok: false, error: "no_body" };
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let received = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (typeof json.delta === "string") {
              received = true;
              onChunk(json.delta);
            }
            if (json.error) {
              if (received) return { ok: true };
              return { ok: false, error: json.error };
            }
          } catch {
          }
        }
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "network" };
    }
  }

  // src/lib/word-picker-client.ts
  var sessionCache = /* @__PURE__ */ new Map();
  function sessionKey(req) {
    const bases = req.candidates.map((c) => c.word).sort().join("|");
    return `${req.learnerLevel}:${req.line}:${bases}`;
  }
  async function fetchWordPick(req) {
    const key = sessionKey(req);
    const hit = sessionCache.get(key);
    if (hit) return { ok: true, word: hit, cached: true };
    const token = await getSyncToken();
    if (!token) return { ok: false, error: "not_linked" };
    try {
      const res = await fetch(WEB_URL + "/api/ai/pick-word", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(req)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || `http_${res.status}` };
      const word = data.result?.word;
      if (!word) return { ok: false, error: "empty_pick" };
      sessionCache.set(key, word);
      return { ok: true, word, cached: data.cached };
    } catch {
      return { ok: false, error: "network" };
    }
  }

  // src/entries/background.ts
  function listenErrorText(code) {
    switch (code) {
      case "quota-exceeded":
        return "Listening stopped \u2014 you've reached this month's listening limit.";
      case "not-signed-in":
        return "Listening needs sign-in \u2014 open animevocab.com to link this browser.";
      case "invalid-key":
        return "Listening stopped \u2014 your OpenAI key was rejected. Check it in settings.";
      case "connection-lost":
        return "Listening stopped \u2014 lost connection to transcription. Press play to resume.";
      default:
        return "Couldn't start Listening Mode on this tab.";
    }
  }
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["settings"], (result) => {
      const raw = result.settings || {};
      delete raw.licenseKey;
      if (raw.pauseMode === "notify") raw.pauseMode = "copilot";
      chrome.storage.local.set({ settings: { ...DEFAULTS, ...raw } });
    });
  });
  var SYNC_ALARM = "avc-cloud-sync";
  var syncDebounce = null;
  function scheduleSync(delayMs = 8e3) {
    if (syncDebounce) clearTimeout(syncDebounce);
    syncDebounce = setTimeout(() => {
      syncDebounce = null;
      syncWithCloud().catch(() => {
      });
    }, delayMs);
  }
  chrome.runtime.onStartup.addListener(() => syncWithCloud().catch(() => {
  }));
  chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 30 }));
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) syncWithCloud().catch(() => {
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
  async function tabNeedsAllFrames(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      return !!tab.url && /crunchyroll\.com/i.test(tab.url);
    } catch {
      return false;
    }
  }
  async function deliverTranscript(tabId, text) {
    const payload = { type: "avc-transcript", text };
    let delivered = false;
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      if (frames?.length) {
        await Promise.all(
          frames.map(async (f) => {
            if (f.frameId == null) return;
            try {
              await chrome.tabs.sendMessage(tabId, payload, { frameId: f.frameId });
              delivered = true;
            } catch {
            }
          })
        );
      }
    } catch (err) {
      console.warn("[AVC] getAllFrames failed:", String(err));
    }
    if (delivered) return;
    try {
      await chrome.tabs.sendMessage(tabId, payload);
    } catch (err) {
      console.warn("[AVC] could not deliver transcript to tab (content script not loaded?):", String(err));
    }
  }
  async function ensureContentScript(tabId) {
    const allFrames = await tabNeedsAllFrames(tabId);
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames },
        func: () => !!window.__avcMainLoaded
      });
      if (results.some((r) => r.result)) return true;
    } catch (err) {
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames },
        files: CONTENT_SCRIPTS
      });
      console.log("[AVC] injected content scripts into tab", tabId, allFrames ? "(all frames)" : "");
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
      syncWithCloud().catch(() => {
      });
      return;
    }
    if (msg.type === "avc-coach") {
      fetchCoach(msg.mode, msg.payload).then(sendResponse).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-coach-chat") {
      fetchChat(msg.message, msg.history || [], msg.payload).then(sendResponse).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-pick-word") {
      fetchWordPick(msg.payload).then(sendResponse).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-agent-pin" || msg.type === "avc-agent-show" || msg.type === "avc-agent-hide" || msg.type === "avc-agent-status") {
      const tabId = msg.tabId;
      const outType = msg.type === "avc-agent-pin" ? "avc-agent-show" : msg.type;
      ensureContentScript(tabId).then((ok) => {
        if (!ok) {
          sendResponse({ ok: false, error: "Could not load into this tab." });
          return;
        }
        chrome.tabs.sendMessage(tabId, { type: outType }, (res) => {
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          sendResponse(res ?? { ok: true });
          if (outType === "avc-agent-show") {
            void getListening().then((tabs) => {
              if (tabs[tabId]) return;
              return startListening(tabId).then((ack) => {
                if (ack && ack.ok === false && ack.error) toastTab(tabId, ack.error, "error");
              });
            }).catch(() => {
            });
          } else if (outType === "avc-agent-hide") {
            void stopListening(tabId).catch(() => {
            });
          }
        });
      }).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-transcript") {
      console.log("[AVC] relaying transcript to tab", msg.tabId, "\u2192", msg.text);
      void deliverTranscript(msg.tabId, msg.text);
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
        const stopCodes = ["invalid-key", "capture-failed", "quota-exceeded", "not-signed-in", "connection-lost"];
        if (stopCodes.includes(msg.code || "")) {
          delete tabs[msg.tabId];
          await setListening(tabs);
          chrome.action.setBadgeText({ tabId: msg.tabId, text: "ERR" });
          chrome.action.setBadgeBackgroundColor({ tabId: msg.tabId, color: "#f87171" });
          if (msg.tabId != null) toastTab(msg.tabId, listenErrorText(msg.code || ""), "error");
        }
        console.warn("[AVC] listening error:", msg.code, msg.detail || "");
      });
    }
  });
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "avc-chat-stream") return;
    port.onMessage.addListener((msg) => {
      void (async () => {
        let full = "";
        const result = await streamChat(
          msg.message,
          msg.history || [],
          msg.payload,
          (delta) => {
            full += delta;
            try {
              port.postMessage({ type: "chunk", delta });
            } catch {
            }
          }
        );
        if (result.ok) {
          port.postMessage({ type: "done" });
        } else {
          port.postMessage({ type: "error", error: result.error || "stream_failed" });
        }
      })();
    });
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
