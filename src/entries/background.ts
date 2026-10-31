import { DEFAULTS } from "../types";
import { BACKEND_URL, WEB_URL } from "../config";
import { pullSettingsFromCloud, syncWithCloud } from "../lib/cloud-sync";
import { attemptAutoLink } from "../lib/account-link";
import { fetchCoach, fetchChat, streamChat, type ChatMessage, type CoachPayload } from "../lib/coach-client";
import { fetchWordPick, type WordPickRequest } from "../lib/word-picker-client";
import { fetchExtractWords, type ExtractWordsRequest } from "../lib/extract-words-client";
import { fetchAnimeContext } from "../lib/anime-context-client";
import { fetchTtsAudio } from "../lib/tts-client";
import { fetchUsage } from "../lib/usage-client";
import { clearSignedOutCache, getSyncToken } from "../lib/storage";
import { stampOnboarding } from "../lib/onboarding-store";
import {
  LISTEN_SIGNIN_REQUIRED,
  SIGNIN_CHIP_DISMISSED_KEY,
  SIGNIN_RETURN_TAB_KEY,
  SIGNIN_START_TAB_KEY,
  SIGNIN_SURFACE_KEY,
  SIGNIN_UPGRADE_NOTICE_KEY,
  isBeforeAccountGate,
  isSignedIn,
  signinStartPath,
} from "../lib/signin-gate";
import {
  TRACK_FEATURE_MESSAGE,
  TRACK_PRO_MESSAGE,
  TRACK_SIGNIN_MESSAGE,
  isFeatureEvent,
  isProFunnelEvent,
  isProSurface,
  isSigninEvent,
  isSigninSurface,
  sendFeatureBeacon,
  sendProBeacon,
  sendSigninBeacon,
  trackFeature,
} from "../lib/feature-events";
import type { SigninSurface } from "../lib/feature-events";
import {
  TRACK_EXTENSION_EVENT_MESSAGE,
  isExtensionEvent,
  sendExtensionEventBeacon,
} from "../lib/extension-events";
import { toastTab } from "../lib/notify";
import { handleN5, invalidateN5, retryPendingN5 } from "../lib/n5-service";
import { fetchSubBatch, fetchSubTranslation, type SubRequest } from "../lib/subs-client";
import type { BatchRequest } from "../lib/episode-subs";
import { CaptureStarts } from "../lib/capture-starts";
import { listeningRegistry, retryCaptureStart } from "../lib/listening-coordination";
const captureStarts = new CaptureStarts();
import type { Settings } from "../types";

// Friendly, page-visible copy for a listening-mode failure code. The offscreen
// document reports terse codes; users shouldn't have to decode them.
function listenErrorText(code: string): string {
  switch (code) {
    case "quota-exceeded":
      return "Listening stopped — you've reached this month's listening limit.";
    case "not-signed-in":
      return "Listening needs sign-in — open animevocab.com to link this browser.";
    case "invalid-key":
      return "Listening stopped — your OpenAI key was rejected. Check it in settings.";
    case "connection-lost":
      return "Listening stopped — lost connection to transcription. Press play to resume.";
    default:
      return "Couldn't start Listening Mode on this tab.";
  }
}

// Streaming tabs the extension operates on — used to recover open tabs after an
// auto-update orphans their old content scripts.
const STREAMING_TAB_PATTERNS = [
  "*://*.youtube.com/*",
  "*://*.netflix.com/*",
  "*://*.crunchyroll.com/*"
];

const APP_TAB_PATTERNS = ["https://animevocab.com/*", "https://www.animevocab.com/*"];

// A link that lands mid-session usually has local words waiting behind it (the
// learner watched first and connected later), and nothing else pushes on a token
// change — the storage listener below only watches vocab/stats. The page
// handshake has always kicked a sync after storing a token; do the same here.
async function linkAccount(trigger: string, options: { force?: boolean } = {}) {
  const result = await attemptAutoLink(trigger, options);
  if (result.linked) syncWithCloud().catch(() => {});
  return result;
}

async function ensureSyncBridgeInOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: APP_TAB_PATTERNS });
  await Promise.all(tabs.map(async (tab) => {
    if (tab.id == null) return;
    try {
      const probe = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => !!(window as Window & { __avcSyncBridgeLoaded?: boolean }).__avcSyncBridgeLoaded,
      });
      if (probe.some((r) => r.result)) return;
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["sync-bridge.js"] });
    } catch (err) {
      console.warn("[AVC] could not attach account bridge to tab", tab.id, String(err));
    }
  }));
}

/**
 * The chip and the popup both ask for this (#206).
 *
 * Link first: if this browser already has an animevocab.com session, minting
 * the token silently is the whole flow, and opening a tab would be a pointless
 * detour. Only when there is no session do we send the learner to /start. The
 * tab they came from is recorded so the completion can bring it back.
 */
let openingSignin: ReturnType<typeof runSigninFromGate> | null = null;
function openSigninFromGate(msg: RuntimeMsg, sender: chrome.runtime.MessageSender) {
  if (openingSignin) return openingSignin;
  openingSignin = runSigninFromGate(msg, sender).finally(() => { openingSignin = null; });
  return openingSignin;
}

async function runSigninFromGate(
  msg: RuntimeMsg,
  sender: chrome.runtime.MessageSender
): Promise<{ ok: boolean; linked: boolean; opened: boolean; error?: string }> {
  const surface: SigninSurface = msg.from === "popup" ? "popup" : "content_chip";
  let returnTabId = typeof msg.tabId === "number" ? msg.tabId : sender.tab?.id;
  if (returnTabId == null) {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    returnTabId = active?.id;
  }

  const remembered: Record<string, unknown> = { [SIGNIN_SURFACE_KEY]: surface };
  if (returnTabId != null) remembered[SIGNIN_RETURN_TAB_KEY] = returnTabId;
  try {
    await chrome.storage.session.set(remembered);
  } catch {
    // Session storage unavailable: the flow still works without the return path.
  }

  const result = await linkAccount("signin_gate", { force: true });
  if (result.linked) return { ok: true, linked: true, opened: false };

  try {
    const tab = await chrome.tabs.create({ url: WEB_URL + signinStartPath(surface) });
    if (tab.id != null) {
      try {
        await chrome.storage.session.set({ [SIGNIN_START_TAB_KEY]: tab.id });
      } catch {
        // ignore
      }
    }
    return { ok: true, linked: false, opened: true };
  } catch (err) {
    return { ok: false, linked: false, opened: false, error: String((err as Error)?.message || err) };
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(["settings"], (result) => {
    const raw = (result.settings || {}) as Record<string, unknown>;
    delete raw.licenseKey;
    if (raw.pauseMode === "notify") raw.pauseMode = "copilot";
    chrome.storage.local.set({ settings: { ...DEFAULTS, ...raw } });
  });

  // On auto-update, content scripts already running in open streaming tabs are
  // orphaned against the new service worker and throw on every subtitle line
  // until a manual reload. Reload those tabs so they pick up the new build
  // cleanly (the probe flag means a plain re-inject would be skipped).
  if (details.reason === "update") {
    chrome.tabs.query({ url: STREAMING_TAB_PATTERNS }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id != null) chrome.tabs.reload(tab.id).catch(() => {});
      }
    });
  }

  // A fresh install opens the hosted sign-in page, not the old local welcome
  // page (#206). A free account is now the first step, and /start carries the
  // demo, Google one-tap, and the email form in one place. The silent link
  // still runs, so a browser already signed in on animevocab.com lands linked.
  if (details.reason === "install") {
    // Stamped here and nowhere else: the popup checklist's 24h rule needs a
    // real install time, and an install that predates #77 has none, which is
    // exactly how `shouldShowChecklist` tells the two apart.
    void stampOnboarding("installedAt");
    // The top of the learning funnel in `avc_events` (#111). Anonymous by
    // definition — nobody has linked an account one tick after installing.
    void trackFeature("install_first_run");
    void (async () => {
      const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      await chrome.storage.session.set({
        [SIGNIN_SURFACE_KEY]: "install",
        ...(active?.id != null ? { [SIGNIN_RETURN_TAB_KEY]: active.id } : {}),
      });
      const tab = await chrome.tabs.create({ url: WEB_URL + signinStartPath("install") });
      if (tab.id != null) await chrome.storage.session.set({ [SIGNIN_START_TAB_KEY]: tab.id });
      await linkAccount("install");
    })().catch(() => {});
  }

  // An update from a build that allowed signed-out use: local words are about
  // to move into an account, and the popup explains that once (#206).
  if (details.reason === "update" && isBeforeAccountGate(details.previousVersion || "")) {
    void (async () => {
      try {
        const r = await chrome.storage.local.get(["syncToken", "vocab"]);
        const words = r.vocab && typeof r.vocab === "object" ? Object.keys(r.vocab).length : 0;
        if (!isSignedIn(r.syncToken) && words > 0) {
          await chrome.storage.local.set({ [SIGNIN_UPGRADE_NOTICE_KEY]: true });
        }
      } catch {
        // A failed read must not block the update.
      }
    })();
  }
  void ensureSyncBridgeInOpenTabs();
});

// Loading an unpacked build or waking a recycled service worker can happen
// while the account page is already open. Probe existing tabs so linking does
// not depend on the user guessing that a hard refresh is required.
void ensureSyncBridgeInOpenTabs();

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
    syncWithCloud().catch(() => {});
  }, delayMs);
}

chrome.runtime.onStartup.addListener(() => {
  // If the silent link below completes, this is the surface the completion
  // event names (#206).
  void chrome.storage.session.set({ [SIGNIN_SURFACE_KEY]: "startup" });
  syncWithCloud().catch(() => {});
  void retryPendingN5();
  // Signing in on the site after installing (or clearing the extension's
  // storage) leaves us unlinked with a perfectly good session cookie. Retry
  // once per browser start; the module's own cooldown keeps it cheap.
  void linkAccount("startup");
});
chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 30 }));
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) { syncWithCloud().catch(() => {}); void retryPendingN5(); }
});
/**
 * A token just arrived (#206): close the loop the gate opened.
 *
 * Fire the completion event for the surface that started the flow, push the
 * local deck (a learner may have watched for months before signing in), bring
 * the tab they came from back to the front, and close the /start tab we opened.
 */
async function completeSignin(): Promise<void> {
  let surface: SigninSurface = "startup";
  let returnTabId: number | null = null;
  let startTabId: number | null = null;
  try {
    const s = await chrome.storage.session.get([
      SIGNIN_SURFACE_KEY,
      SIGNIN_RETURN_TAB_KEY,
      SIGNIN_START_TAB_KEY,
    ]);
    if (isSigninSurface(s[SIGNIN_SURFACE_KEY])) surface = s[SIGNIN_SURFACE_KEY];
    if (typeof s[SIGNIN_RETURN_TAB_KEY] === "number") returnTabId = s[SIGNIN_RETURN_TAB_KEY];
    if (typeof s[SIGNIN_START_TAB_KEY] === "number") startTabId = s[SIGNIN_START_TAB_KEY];
  } catch {
    // Session storage unavailable: still finish the part that matters.
  }

  void sendSigninBeacon("signin_completed", surface);
  syncWithCloud().catch(() => {});

  if (returnTabId != null) {
    try {
      const tab = await chrome.tabs.get(returnTabId);
      await chrome.tabs.update(returnTabId, { active: true });
      if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
    } catch {
      // The learner closed that tab; nothing to focus.
    }
  }
  if (startTabId != null && startTabId !== returnTabId) {
    try {
      await chrome.tabs.remove(startTabId);
    } catch {
      // Already closed by the learner.
    }
  }

  try {
    await chrome.storage.session.remove([
      SIGNIN_SURFACE_KEY,
      SIGNIN_RETURN_TAB_KEY,
      SIGNIN_START_TAB_KEY,
    ]);
  } catch {
    // ignore
  }
  await chrome.storage.local.remove(SIGNIN_UPGRADE_NOTICE_KEY);
}

/** A token just went away: stop Listening everywhere and bring the gate back. */
async function handleSignOut(): Promise<void> {
  const pending = captureStarts.cancelAll();
  try {
    const tabs = await getListening();
    await Promise.all(
      [...new Set([...pending, ...Object.keys(tabs).filter(id => tabs[Number(id)]).map(Number)])]
        .map(id => stopListening(id))
    );
  } catch {
    // Listening state unreadable: the token is gone either way.
  }
  await chrome.storage.local.remove([SIGNIN_CHIP_DISMISSED_KEY, SIGNIN_UPGRADE_NOTICE_KEY]);
  try {
    await chrome.storage.session.remove([
      SIGNIN_SURFACE_KEY,
      SIGNIN_RETURN_TAB_KEY,
      SIGNIN_START_TAB_KEY,
    ]);
  } catch {
    // ignore
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.vocab || changes.stats) scheduleSync();
  // `extension_linked` is watched here rather than fired at the two places
  // that store a token: the sync bridge writes chrome.storage directly (it is
  // deliberately dependency-free), and lib/storage's setSyncToken is the other
  // path. Watching the transition catches both, and only the transition — a
  // re-link that rewrites the same token is not a new activation.
  const token = changes.syncToken;
  if (!token || token.oldValue === token.newValue) return;
  const had = isSignedIn(token.oldValue);
  const has = isSignedIn(token.newValue);
  void invalidateN5();
  if (!had && has) {
    void trackFeature("extension_linked");
    void completeSignin();
  } else if (had && !has) {
    void handleSignOut();
  }
});

// Listening-mode state lives in storage.session: the service worker can be
// torn down between audio chunks while the offscreen document keeps running.
async function getListening(): Promise<Record<number, boolean>> {
  const r = await chrome.storage.session.get(["listeningTabs"]);
  return (r.listeningTabs as Record<number, boolean> | undefined) || {};
}

const updateListening = listeningRegistry(getListening, async tabs => {
  await chrome.storage.session.set({ listeningTabs: tabs });
});

// Copilot visibility lives beside it, and for the same reason: a page reload
// wipes the panel out of the tab while Listening Mode keeps running in the
// offscreen document, which left the learner with a half-dead session (#126).
// Remembering which tabs had the panel open lets the fresh content script put
// it back exactly where it was.
async function getCopilot(): Promise<Record<number, boolean>> {
  const r = await chrome.storage.session.get(["copilotTabs"]);
  return (r.copilotTabs as Record<number, boolean> | undefined) || {};
}

async function setCopilotTab(tabId: number, open: boolean): Promise<void> {
  const tabs = await getCopilot();
  if (open) tabs[tabId] = true;
  else delete tabs[tabId];
  await chrome.storage.session.set({ copilotTabs: tabs });
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

// The content scripts, in manifest load order. Injected on demand so
// Listening Mode works even in a tab that was open before the extension
// loaded (Chrome only auto-injects on navigation after install).
const CONTENT_SCRIPTS = ["key-shield.js", "vendor/kuromoji.js", "content.js"];

async function tabNeedsAllFrames(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return !!tab.url && /crunchyroll\.com/i.test(tab.url);
  } catch {
    return false;
  }
}

async function deliverTranscript(tabId: number, text: string, start?: number, end?: number): Promise<void> {
  const payload = {
    type: "avc-transcript",
    text,
    ...(typeof start === "number" ? { start } : {}),
    ...(typeof end === "number" ? { end } : {}),
  };
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
            /* no content script in this frame */
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

async function ensureContentScript(tabId: number): Promise<boolean> {
  const allFrames = await tabNeedsAllFrames(tabId);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames },
      func: () => !!(window as Window & { __avcMainLoaded?: boolean }).__avcMainLoaded
    });
    if (results.some((r) => r.result)) return true;
  } catch (err) {
    // probe failed (no host access etc.) — injection below will surface it
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

async function getCacheKeyFromTab(tabId: number): Promise<string | null> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "avc-get-cache-key" }) as { key?: string } | undefined;
    return res?.key || null;
  } catch {
    return null;
  }
}

async function startListening(tabId: number): Promise<Ack> {
  const generation = captureStarts.begin(tabId);
  const cancelled = (): boolean => !captureStarts.current(tabId, generation);
  const cancelledAck: Ack = { ok: false, error: "Listening start was cancelled." };
  const r = await chrome.storage.local.get(["settings"]);
  const settings = (r.settings as Partial<Settings> | undefined) || {};

  // The account gate (#206): Listening is a learning feature, so it needs a
  // free account before we look at a BYO key. A key alone no longer unlocks it.
  const syncToken = await getSyncToken();
  if (!syncToken) {
    return { ok: false, error: LISTEN_SIGNIN_REQUIRED };
  }

  let auth;
  if (settings.openaiKey?.trim()) {
    auth = { kind: "byo" as const, key: settings.openaiKey.trim() };
  } else {
    auth = { kind: "cloud" as const, syncToken, backendUrl: BACKEND_URL };
  }

  const injected = await ensureContentScript(tabId);
  if (!injected) {
    return { ok: false, error: "Couldn't load the extension into this tab. Try reloading the page, then Start again." };
  }

  const cacheKey = auth.kind === "cloud" ? await getCacheKeyFromTab(tabId) : null;
  if (cancelled()) return cancelledAck;
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
  if (cancelled()) return cancelledAck;
  const language = settings.learningDirection === "ja-en" ? "en" : "ja";
  const ack = await retryCaptureStart(() => chrome.runtime.sendMessage({
    type: "avc-offscreen-start",
    streamId,
    tabId,
    auth,
    model: settings.transcribeModel || DEFAULTS.transcribeModel,
    language,
    cacheKey: cacheKey || undefined
  }), () => !cancelled()).catch((err): Ack => ({ ok: false, error: String(err.message || err) }));
  if (cancelled()) return cancelledAck;

  if (!ack || ack.ok === false) {
    return { ok: false, error: ack?.error || "Audio capture failed to start." };
  }

  const marked = await updateListening(tabId, true, () => !cancelled());
  if (!marked || cancelled()) return cancelledAck;
  chrome.tabs.sendMessage(tabId, { type: "avc-listening-state", active: true }).catch(() => {});
  chrome.action.setBadgeText({ tabId, text: "REC" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#f87171" });
  // Only after capture actually started: an early beacon would count every
  // failed start as discoverability, which is the number Pro is sold on (#118).
  void trackFeature("listening_started");
  console.log("[AVC] listening started on tab", tabId, "model", settings.transcribeModel || DEFAULTS.transcribeModel);
  return { ok: true };
}

async function stopListening(tabId: number): Promise<Ack> {
  captureStarts.cancel(tabId);
  chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {});
  chrome.tabs.sendMessage(tabId, { type: "avc-listening-state", active: false }).catch(() => {});
  await updateListening(tabId, false);
  chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  return { ok: true };
}

interface RuntimeMsg {
  type: string;
  count?: number;
  tabId?: number;
  line?: string;
  text?: string;
  title?: string;
  key?: string;
  code?: string;
  detail?: string;
  time?: number;
  start?: number;
  end?: number;
  paused?: boolean;
  mode?: "explain" | "hooks";
  message?: string;
  history?: ChatMessage[];
  payload?: CoachPayload | WordPickRequest | ExtractWordsRequest | SubRequest | BatchRequest;
  event?: string;
  surface?: string;
  url?: string;
  kind?: string;
  trigger?: string;
  force?: boolean;
  from?: string;
  open?: boolean;
  lessonId?: string;
  attemptId?: string;
}

const ACCOUNT_REQUESTS = new Set([
  "avc-coach", "avc-coach-chat", "avc-pick-word", "avc-translate-batch",
  "avc-translate", "avc-extract-words", "avc-anime-context", "avc-tts", "avc-usage",
]);

chrome.runtime.onMessage.addListener((msg: RuntimeMsg, sender, sendResponse) => {
  if (ACCOUNT_REQUESTS.has(msg.type) || msg.type?.startsWith("avc-n5-")) {
    void getSyncToken().then(token => {
      if (!token) sendResponse({ ok: false, error: "Sign in to your free account at animevocab.com/start." });
      else handleRuntimeMessage(msg, sender, sendResponse);
    }).catch(() => sendResponse({ ok: false, error: "Sign in to your free account at animevocab.com/start." }));
    return true;
  }
  return handleRuntimeMessage(msg, sender, sendResponse);
});

function handleRuntimeMessage(msg: RuntimeMsg, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void): true | undefined {
  if (msg.type === "avc-sign-out") {
    void clearSignedOutCache().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  if (typeof msg?.type === "string" && msg.type.startsWith("avc-n5-")) {
    // Finishing a course episode ends Listening on its tab, the same way the
    // popup's Stop does.
    void handleN5(msg, sender, async (tabId) => { await stopListening(tabId); }).then(sendResponse);
    return true;
  }
  if (msg.type === "avc-badge") {
    const text = (msg.count || 0) > 0 ? String(msg.count) : "";
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: "#c4553a" });
    return;
  }

  // Learning-loop beacons are relayed here (#111) because a content script runs
  // at the watched page's origin, where a cross-origin POST to animevocab.com
  // is blocked by CORS. The service worker has the host permission.
  if (msg.type === TRACK_FEATURE_MESSAGE) {
    if (isFeatureEvent(msg.event)) void sendFeatureBeacon(msg.event);
    return;
  }

  // Same relay for the Pro funnel (#162): the copilot's limit sheet runs in a
  // content script too.
  if (msg.type === TRACK_PRO_MESSAGE) {
    if (isProFunnelEvent(msg.event) && isProSurface(msg.surface)) {
      void sendProBeacon(msg.event, msg.surface);
    }
    return;
  }

  // The sign-in gate (#206): chip, popup, and /start all need the worker to
  // send the beacon, for the same CORS reason.
  if (msg.type === TRACK_SIGNIN_MESSAGE) {
    if (isSigninEvent(msg.event) && isSigninSurface(msg.surface)) {
      void sendSigninBeacon(msg.event, msg.surface);
    }
    return;
  }

  // Same relay, same reason, for the older extension-funnel counters.
  if (msg.type === TRACK_EXTENSION_EVENT_MESSAGE) {
    if (isExtensionEvent(msg.event)) sendExtensionEventBeacon(msg.event);
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
    const tabId = msg.tabId ?? sender.tab?.id;
    getListening().then((tabs) => sendResponse({ listening: tabId != null && !!tabs[tabId] }));
    return true;
  }

  // A freshly loaded content script asking what its tab was doing before the
  // reload. Answered from session state, so Listening Mode and the Copilot
  // panel come back together instead of one without the other.
  if (msg.type === "avc-session-state") {
    const tabId = msg.tabId ?? sender.tab?.id;
    if (tabId == null) {
      sendResponse({ listening: false, copilot: false });
      return true;
    }
    Promise.all([getListening(), getCopilot()])
      .then(([listening, copilot]) =>
        sendResponse({ listening: !!listening[tabId], copilot: !!copilot[tabId] })
      )
      .catch(() => sendResponse({ listening: false, copilot: false }));
    return true;
  }

  // The panel reports its own visibility: opened or closed from the popup, from
  // its own close button, or restored after a reload.
  if (msg.type === "avc-copilot-state") {
    const tabId = msg.tabId ?? sender.tab?.id;
    if (tabId != null) void setCopilotTab(tabId, !!msg.open);
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "avc-offscreen-log") {
    console.log("[AVC-audio]", msg.line);
    return;
  }

  // The popup and the onboarding page ask for a link attempt. They pass force
  // for a click the learner can see happening, so a "Connect account" press is
  // never silently swallowed by the cooldown.
  if (msg.type === "avc-account-link") {
    linkAccount(typeof msg.trigger === "string" ? msg.trigger : "ui", { force: msg.force === true })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch(() => sendResponse({ ok: false, linked: false, outcome: "error" }));
    return true;
  }

  // The chip and the popup gate share one link-first flow (#206).
  if (msg.type === "avc-open-signin") {
    openSigninFromGate(msg, sender)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, linked: false, opened: false, error: String(err?.message || err) }));
    return true;
  }

  // /start names itself before it mints, so the completion event carries the
  // surface the learner actually started from (#206).
  if (msg.type === "avc-signin-surface") {
    void (async () => {
      const s = await chrome.storage.session.get(SIGNIN_SURFACE_KEY);
      // Keep the chip/popup/install attribution when /start is its next step.
      if (!isSigninSurface(s[SIGNIN_SURFACE_KEY]) && msg.surface === "start_page") {
        await chrome.storage.session.set({ [SIGNIN_SURFACE_KEY]: "start_page" });
      }
    })().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }

  // A deliberate save on the site's settings page: the one time settings flow
  // cloud → extension (see pullSettingsFromCloud).
  if (msg.type === "avc-pull-settings") {
    pullSettingsFromCloud()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === "avc-sync-now") {
    syncWithCloud()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
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

  if (msg.type === "avc-pick-word") {
    fetchWordPick(msg.payload as WordPickRequest)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === "avc-translate-batch") {
    fetchSubBatch(msg.payload as BatchRequest)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "network" }));
    return true;
  }

  if (msg.type === "avc-translate") {
    fetchSubTranslation(msg.payload as SubRequest)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "network" }));
    return true;
  }

  if (msg.type === "avc-extract-words") {
    fetchExtractWords(msg.payload as ExtractWordsRequest)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Anime context + cloud TTS also can't be called cross-origin from a content
  // script (no CORS on the web API), so the content side routes them here.
  if (msg.type === "avc-anime-context") {
    fetchAnimeContext(msg.title || null)
      .then((context) => sendResponse({ ok: true, context: context || "" }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === "avc-tts") {
    fetchTtsAudio(msg.text || "")
      .then((audio) => {
        if (audio && audio.b64) {
          sendResponse({ ok: true, b64: audio.b64, mime: audio.mime });
          return;
        }
        // Pass the reason through: the caller falls back to the browser voice
        // either way, but a quota rejection is worth reporting to the learner.
        const reason = (audio && "error" in audio && audio.error) || "not_linked";
        if (reason === "auto_quota_exhausted" && sender.tab?.id != null) {
          chrome.tabs
            .sendMessage(sender.tab.id, { type: "avc-limit-reached", kind: "auto" })
            .catch(() => {});
        }
        sendResponse({ ok: false, error: reason });
      })
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === "avc-usage") {
    fetchUsage()
      .then((usage) =>
        usage ? sendResponse({ ok: true, usage }) : sendResponse({ ok: false, error: "not_linked" })
      )
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === "avc-open-url" && typeof msg.url === "string") {
    // Checkout must open in a real tab: the copilot lives inside the video
    // page, where an in-place navigation would throw away what they're watching.
    chrome.tabs.create({ url: msg.url }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  if (
    msg.type === "avc-agent-pin" ||
    msg.type === "avc-agent-show" ||
    msg.type === "avc-agent-hide" ||
    msg.type === "avc-agent-status" ||
    msg.type === "avc-caption-status" ||
    msg.type === "avc-subs-diag"
  ) {
    const tabId = msg.tabId!;
    const outType = msg.type === "avc-agent-pin" ? "avc-agent-show" : msg.type;
    ensureContentScript(tabId)
      .then((ok) => {
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
        });
      })
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg.type === "avc-transcript") {
    console.log("[AVC] relaying transcript to tab", msg.tabId, "→", msg.text);
    void deliverTranscript(msg.tabId!, msg.text!, msg.start, msg.end);
    return;
  }

  // Episode changed in the tab — forward the new cache key to the offscreen
  // session so it stops uploading under the previous episode's key.
  if (msg.type === "avc-update-cache-key" && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    getListening().then((tabs) => {
      if (tabs[tabId]) {
        chrome.runtime
          .sendMessage({ type: "avc-offscreen-update-key", tabId, cacheKey: msg.key || "" })
          .catch(() => {});
      }
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
    getListening().then(async () => {
      const stopCodes = ["invalid-key", "capture-failed", "quota-exceeded", "not-signed-in", "connection-lost"];
      if (stopCodes.includes(msg.code || "")) {
        captureStarts.cancel(msg.tabId!);
        await updateListening(msg.tabId!, false);
        // The page has to hear it too: it kept polling the transcript cache
        // and relaying playback time for a session that no longer existed.
        if (msg.tabId != null) {
          chrome.tabs.sendMessage(msg.tabId, { type: "avc-listening-state", active: false }).catch(() => {});
        }
        chrome.action.setBadgeText({ tabId: msg.tabId, text: "ERR" });
        chrome.action.setBadgeBackgroundColor({ tabId: msg.tabId, color: "#f87171" });
        // Surface it on the page too — the toolbar badge is invisible while the
        // user is watching (often fullscreen), so failures felt like silent deaths.
        if (msg.tabId != null) {
          if (msg.code === "quota-exceeded") {
            // Running out of hours isn't an error to shrug off in a 6s toast —
            // it needs to say what stopped and what the way out is.
            chrome.tabs
              .sendMessage(msg.tabId, { type: "avc-limit-reached", kind: "listening" })
              .catch(() => toastTab(msg.tabId!, listenErrorText("quota-exceeded"), "error"));
          } else {
            toastTab(msg.tabId, listenErrorText(msg.code || ""), "error");
          }
        }
      }
      console.warn("[AVC] listening error:", msg.code, msg.detail || "");
    });
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "avc-chat-stream") return;
  port.onMessage.addListener((msg: { message?: string; history?: ChatMessage[]; payload?: CoachPayload }) => {
    void (async () => {
      if (!(await getSyncToken())) {
        port.postMessage({ type: "error", error: "Sign in to your free account at animevocab.com/start." });
        return;
      }
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
  captureStarts.cancel(tabId);
  const tabs = await getListening();
  if (tabs[tabId]) {
    chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {});
    await updateListening(tabId, false);
  }
  await setCopilotTab(tabId, false);
});
