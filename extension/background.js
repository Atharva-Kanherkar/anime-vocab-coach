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

// Send a message to the offscreen document, retrying while it is still loading
// (createDocument resolves before offscreen.js registers its listener).
async function sendToOffscreen(msg, tries = 15) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await chrome.runtime.sendMessage(msg);
      if (res && res.ok) return res;
      if (res && res.ok === false) return res; // handled but failed
    } catch (err) {
      // "Receiving end does not exist" — offscreen not ready yet; wait & retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("offscreen document never acknowledged (audio capture could not start)");
}

// The isolated-world content scripts, in manifest load order. Injected on
// demand so Listening Mode works even in a tab that was open before the
// extension loaded (Chrome only auto-injects on navigation after install).
const CONTENT_SCRIPTS = [
  "vendor/kuromoji.js",
  "src/log.js",
  "src/romaji.js",
  "src/storage.js",
  "src/dictionary.js",
  "src/tokenizer.js",
  "src/scoring.js",
  "src/overlay.js",
  "src/adapters/youtube.js",
  "src/adapters/netflix.js",
  "src/adapters/generic.js",
  "src/main.js"
];

async function ensureContentScript(tabId) {
  try {
    const [probe] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__avcMainLoaded
    });
    if (probe && probe.result) return true; // already there
  } catch (err) {
    // probe failed (no host access etc.) — injection below will surface it
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

async function startListening(tabId) {
  const { settings } = await chrome.storage.local.get(["settings"]);
  const key = settings?.openaiKey;
  if (!key) {
    return { ok: false, error: "No OpenAI API key. Add one in Settings first." };
  }

  // Make sure the page can receive transcripts before we start paying for audio.
  const injected = await ensureContentScript(tabId);
  if (!injected) {
    return { ok: false, error: "Couldn't load the extension into this tab. Try reloading the page, then Start again." };
  }
  let streamId;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch (err) {
    return { ok: false, error: "Couldn't capture this tab's audio: " + (err.message || err) + ". Try clicking the extension icon again directly on the video tab." };
  }
  await ensureOffscreen();
  const ack = await sendToOffscreen({
    type: "avc-offscreen-start",
    streamId,
    tabId,
    key,
    model: settings.transcribeModel || DEFAULTS.transcribeModel
  }).catch((err) => ({ ok: false, error: String(err.message || err) }));

  if (!ack || ack.ok === false) {
    return { ok: false, error: ack?.error || "Audio capture failed to start." };
  }

  const tabs = await getListening();
  tabs[tabId] = true;
  await setListening(tabs);
  chrome.action.setBadgeText({ tabId, text: "REC" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#f87171" });
  console.log("[AVC] listening started on tab", tabId, "model", settings.transcribeModel || DEFAULTS.transcribeModel);
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

  if (msg.type === "avc-offscreen-log") {
    console.log("[AVC-audio]", msg.line);
    return;
  }

  if (msg.type === "avc-transcript") {
    // offscreen → the captured tab's content scripts (all frames; the frame
    // that owns the video picks it up)
    console.log("[AVC] relaying transcript to tab", msg.tabId, "→", msg.text);
    chrome.tabs.sendMessage(msg.tabId, { type: "avc-transcript", text: msg.text }).catch((err) => {
      console.warn("[AVC] could not deliver transcript to tab (content script not loaded?):", String(err));
    });
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
