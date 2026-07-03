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
    licenseKey: "",
    transcribeModel: "gpt-4o-mini-transcribe",
    sites: { youtube: true, netflix: true, generic: true }
  };
  var SRS_INTERVALS = [0, 4 * 36e5, 24 * 36e5, 3 * 24 * 36e5, 7 * 24 * 36e5, 21 * 24 * 36e5];

  // src/config.ts
  var BACKEND_URL = "https://avc-api.example.workers.dev";

  // src/entries/background.ts
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["settings"], (result) => {
      chrome.storage.local.set({ settings: { ...DEFAULTS, ...result.settings || {} } });
    });
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
  async function startListening(tabId) {
    const r = await chrome.storage.local.get(["settings"]);
    const settings = r.settings || {};
    const auth = settings.licenseKey ? { kind: "hosted", licenseKey: settings.licenseKey, backendUrl: BACKEND_URL } : settings.openaiKey ? { kind: "byo", key: settings.openaiKey } : null;
    if (!auth) {
      return { ok: false, error: "Listening Mode needs Pro (license key) or your own OpenAI API key \u2014 set either in Settings." };
    }
    const injected = await ensureContentScript(tabId);
    if (!injected) {
      return { ok: false, error: "Couldn't load the extension into this tab. Try reloading the page, then Start again." };
    }
    const cacheKey = auth.kind === "hosted" ? await getCacheKeyFromTab(tabId) : null;
    if (auth.kind === "hosted" && !cacheKey) {
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
        time: msg.time
      }).catch(() => {
      });
      return;
    }
    if (msg.type === "avc-listen-error") {
      getListening().then(async (tabs) => {
        if (msg.code === "invalid-key" || msg.code === "capture-failed" || msg.code === "quota-exceeded" || msg.code === "subscription-inactive") {
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
