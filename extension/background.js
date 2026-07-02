const DEFAULTS = {
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["settings"], (result) => {
    chrome.storage.local.set({ settings: { ...DEFAULTS, ...(result.settings || {}) } });
  });
});

// Listening-mode state lives in storage.session: the service worker can be
// torn down between audio chunks while the offscreen document keeps running.
async function getListening() {
  const r = await chrome.storage.session.get(["listeningTabs"]);
  return r.listeningTabs || {};
}

async function setListening(tabs) {
  await chrome.storage.session.set({ listeningTabs: tabs });
}

async function ensureOffscreen() {
  if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return;
  await chrome.offscreen.createDocument({
    url: "offscreen/offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Capture tab audio and transcribe Japanese speech so vocabulary cards can be shown for what the viewer hears."
  });
}

async function startListening(tabId) {
  const { settings } = await chrome.storage.local.get(["settings"]);
  const key = settings?.openaiKey;
  if (!key) {
    return { ok: false, error: "No OpenAI API key. Add one in Settings first." };
  }
  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  await chrome.runtime.sendMessage({
    type: "avc-offscreen-start",
    streamId,
    tabId,
    key,
    model: settings.transcribeModel || DEFAULTS.transcribeModel
  });
  const tabs = await getListening();
  tabs[tabId] = true;
  await setListening(tabs);
  chrome.action.setBadgeText({ tabId, text: "REC" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#f87171" });
  return { ok: true };
}

async function stopListening(tabId) {
  chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {});
  const tabs = await getListening();
  delete tabs[tabId];
  await setListening(tabs);
  chrome.action.setBadgeText({ tabId, text: "" }).catch?.(() => {});
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "avc-badge") {
    const text = msg.count > 0 ? String(msg.count) : "";
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: "#8b7cf6" });
    return;
  }

  if (msg.type === "avc-listen-start") {
    startListening(msg.tabId)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
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

  if (msg.type === "avc-transcript") {
    // offscreen → the captured tab's content scripts (all frames; the frame
    // that owns the video picks it up)
    chrome.tabs.sendMessage(msg.tabId, { type: "avc-transcript", text: msg.text }).catch(() => {});
    return;
  }

  if (msg.type === "avc-listen-error") {
    getListening().then(async (tabs) => {
      if (msg.code === "invalid-key" || msg.code === "capture-failed") {
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
    chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {});
    delete tabs[tabId];
    await setListening(tabs);
  }
});
