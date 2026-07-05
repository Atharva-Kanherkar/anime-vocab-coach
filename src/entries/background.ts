import { DEFAULTS } from "../types";
import { BACKEND_URL } from "../config";
import { pushSnapshot } from "../lib/cloud-sync";
import { fetchCoach, fetchChat, streamChat, type ChatMessage, type CoachPayload } from "../lib/coach-client";
import { getSyncToken } from "../lib/storage";
import type { Settings } from "../types";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["settings"], (result) => {
    const raw = (result.settings || {}) as Record<string, unknown>;
    delete raw.licenseKey;
    if (raw.pauseMode === "notify") raw.pauseMode = "copilot";
    chrome.storage.local.set({ settings: { ...DEFAULTS, ...raw } });
  });
});

// --- Background cloud sync -------------------------------------------------
// When linked to an account (a sync token is present), push local progress to
// the cloud: shortly after data changes (debounced), on a periodic alarm, and
// on browser startup. A no-op when local-only.
const SYNC_ALARM = "avc-cloud-sync";
let syncDebounce: ReturnType<typeof setTimeout> | null = null;

function scheduleSync(delayMs = 8000): void {
  if (syncDebounce) clearTimeout(syncDebounce);
  syncDebounce = setTimeout(() => {
    syncDebounce = null;
    pushSnapshot().catch(() => {});
  }, delayMs);
}

chrome.runtime.onStartup.addListener(() => pushSnapshot().catch(() => {}));
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 30 }));
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) pushSnapshot().catch(() => {});
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.vocab || changes.stats)) scheduleSync();
});

// Listening-mode state lives in storage.session: the service worker can be
// torn down between audio chunks while the offscreen document keeps running.
async function getListening(): Promise<Record<number, boolean>> {
  const r = await chrome.storage.session.get(["listeningTabs"]);
  return (r.listeningTabs as Record<number, boolean> | undefined) || {};
}

async function setListening(tabs: Record<number, boolean>): Promise<void> {
  await chrome.storage.session.set({ listeningTabs: tabs });
}

async function ensureOffscreen(): Promise<void> {
  if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return;
  await chrome.offscreen.createDocument({
    url: "offscreen/offscreen.html",
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Capture tab audio and transcribe Japanese speech so vocabulary cards can be shown for what the viewer hears."
  });
}

interface Ack {
  ok: boolean;
  error?: string;
}

// Send a message to the offscreen document, retrying while it is still loading
// (createDocument resolves before offscreen.js registers its listener).
async function sendToOffscreen(msg: object, tries = 15): Promise<Ack> {
  for (let i = 0; i < tries; i++) {
    try {
      const res: Ack | undefined = await chrome.runtime.sendMessage(msg);
      if (res && res.ok) return res;
      if (res && res.ok === false) return res; // handled but failed
    } catch (err) {
      // "Receiving end does not exist" — offscreen not ready yet; wait & retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("offscreen document never acknowledged (audio capture could not start)");
}

// The content scripts, in manifest load order. Injected on demand so
// Listening Mode works even in a tab that was open before the extension
// loaded (Chrome only auto-injects on navigation after install).
const CONTENT_SCRIPTS = ["vendor/kuromoji.js", "content.js"];

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    const [probe] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!(window as Window & { __avcMainLoaded?: boolean }).__avcMainLoaded
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

async function getCacheKeyFromTab(tabId: number): Promise<string | null> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "avc-get-cache-key" }) as { key?: string } | undefined;
    return res?.key || null;
  } catch {
    return null;
  }
}

const NOT_LINKED_MSG =
  "Sign in at animevocab.com/app, keep that tab open briefly, then try again. " +
  "Or add your OpenAI key in Settings for local-only Listening Mode.";

async function startListening(tabId: number): Promise<Ack> {
  const r = await chrome.storage.local.get(["settings"]);
  const settings = (r.settings as Partial<Settings> | undefined) || {};

  let auth;
  if (settings.openaiKey?.trim()) {
    auth = { kind: "byo" as const, key: settings.openaiKey.trim() };
  } else {
    const syncToken = await getSyncToken();
    if (!syncToken) {
      return { ok: false, error: NOT_LINKED_MSG };
    }
    auth = { kind: "cloud" as const, syncToken, backendUrl: BACKEND_URL };
  }

  const injected = await ensureContentScript(tabId);
  if (!injected) {
    return { ok: false, error: "Couldn't load the extension into this tab. Try reloading the page, then Start again." };
  }

  const cacheKey = auth.kind === "cloud" ? await getCacheKeyFromTab(tabId) : null;
  if (auth.kind === "cloud" && !cacheKey) {
    console.warn("[AVC] no cache key yet — listening will wait for fingerprint or page ID");
  }

  let streamId: string;
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
    cacheKey: cacheKey || undefined
  }).catch((err): Ack => ({ ok: false, error: String(err.message || err) }));

  if (!ack || ack.ok === false) {
    return { ok: false, error: ack?.error || "Audio capture failed to start." };
  }

  const tabs = await getListening();
  tabs[tabId] = true;
  await setListening(tabs);
  chrome.tabs.sendMessage(tabId, { type: "avc-listening-state", active: true }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text: "REC" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#f87171" });
  console.log("[AVC] listening started on tab", tabId, "model", settings.transcribeModel || DEFAULTS.transcribeModel);
  return { ok: true };
}

async function stopListening(tabId: number): Promise<Ack> {
  chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {});
  chrome.tabs.sendMessage(tabId, { type: "avc-listening-state", active: false }).catch(() => {});
  const tabs = await getListening();
  delete tabs[tabId];
  await setListening(tabs);
  chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  return { ok: true };
}

interface RuntimeMsg {
  type: string;
  count?: number;
  tabId?: number;
  line?: string;
  text?: string;
  code?: string;
  detail?: string;
  time?: number;
  paused?: boolean;
  mode?: "explain" | "hooks";
  message?: string;
  history?: ChatMessage[];
  payload?: CoachPayload;
}

chrome.runtime.onMessage.addListener((msg: RuntimeMsg, sender, sendResponse) => {
  if (msg.type === "avc-badge") {
    const text = (msg.count || 0) > 0 ? String(msg.count) : "";
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: "#c4553a" });
    return;
  }

  if (msg.type === "avc-listen-start") {
    startListening(msg.tabId!)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }

  if (msg.type === "avc-listen-stop") {
    stopListening(msg.tabId!).then(sendResponse);
    return true;
  }

  if (msg.type === "avc-listen-status") {
    getListening().then((tabs) => sendResponse({ listening: !!tabs[msg.tabId!] }));
    return true;
  }

  if (msg.type === "avc-offscreen-log") {
    console.log("[AVC-audio]", msg.line);
    return;
  }

  if (msg.type === "avc-sync-now") {
    pushSnapshot().catch(() => {});
    return;
  }

  // Overlay card AI: content scripts can't call the hosted API cross-origin, so
  // they ask us. We hold the sync token and the host permission.
  if (msg.type === "avc-coach") {
    fetchCoach(msg.mode as "explain" | "hooks", msg.payload as CoachPayload)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === "avc-coach-chat") {
    fetchChat(msg.message as string, (msg.history as ChatMessage[]) || [], msg.payload as CoachPayload)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === "avc-agent-pin") {
    ensureContentScript(msg.tabId!)
      .then((ok) => {
        if (!ok) {
          sendResponse({ ok: false, error: "Could not load into this tab." });
          return;
        }
        chrome.tabs.sendMessage(msg.tabId!, { type: "avc-agent-show" }, () => {
          sendResponse({ ok: !chrome.runtime.lastError });
        });
      })
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === "avc-transcript") {
    console.log("[AVC] relaying transcript to tab", msg.tabId, "→", msg.text);
    chrome.tabs.sendMessage(msg.tabId!, { type: "avc-transcript", text: msg.text }).catch((err) => {
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
    }).catch(() => {});
    return;
  }

  if (msg.type === "avc-listen-error") {
    getListening().then(async (tabs) => {
      if (msg.code === "invalid-key" || msg.code === "capture-failed" ||
          msg.code === "quota-exceeded" || msg.code === "not-signed-in") {
        delete tabs[msg.tabId!];
        await setListening(tabs);
        chrome.action.setBadgeText({ tabId: msg.tabId, text: "ERR" });
        chrome.action.setBadgeBackgroundColor({ tabId: msg.tabId, color: "#f87171" });
      }
      console.warn("[AVC] listening error:", msg.code, msg.detail || "");
    });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "avc-chat-stream") return;
  port.onMessage.addListener((msg: { message?: string; history?: ChatMessage[]; payload?: CoachPayload }) => {
    void (async () => {
      let full = "";
      const result = await streamChat(
        msg.message as string,
        (msg.history as ChatMessage[]) || [],
        msg.payload as CoachPayload,
        (delta) => {
          full += delta;
          try { port.postMessage({ type: "chunk", delta }); } catch { /* disconnected */ }
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
    chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {});
    delete tabs[tabId];
    await setListening(tabs);
  }
});
