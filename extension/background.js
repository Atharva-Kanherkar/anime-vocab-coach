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
    learningDirection: "en-ja",
    autoSpeak: true,
    subLens: true,
    subLensPeek: true,
    openaiKey: "",
    transcribeModel: "gpt-4o-mini-transcribe",
    sites: { youtube: true, netflix: true, generic: true }
  };
  var SRS_INTERVALS = [0, 4 * 36e5, 24 * 36e5, 3 * 24 * 36e5, 7 * 24 * 36e5, 21 * 24 * 36e5];

  // src/config.ts
  var BACKEND_URL = "https://api.animevocab.com";
  var WEB_URL = "https://animevocab.com";
  var CWS_EXTENSION_ID = "lkjbomofgfonjjbemobacegffepbdnel";

  // src/lib/log.ts
  var log = (...args) => console.log("[AVC]", ...args);
  var warn = (...args) => console.warn("[AVC]", ...args);

  // src/lib/locale-direction.ts
  function isJapaneseUiLocale() {
    try {
      const ui = chrome.i18n?.getUILanguage?.() || navigator.language || "en";
      return ui.toLowerCase().startsWith("ja");
    } catch {
      return false;
    }
  }
  function resolveStoredDirection(stored) {
    if (stored === "ja-en" || stored === "en-ja") return stored;
    return null;
  }

  // src/lib/review-prompt.ts
  var REVIEW_PROMPT_SNOOZE_MS = 14 * 24 * 36e5;

  // src/lib/run-context.ts
  function inServiceWorker() {
    return typeof window === "undefined";
  }
  function extensionVersion() {
    try {
      const v = chrome.runtime.getManifest().version;
      return typeof v === "string" ? v : "";
    } catch {
      return "";
    }
  }

  // src/lib/extension-events.ts
  var EXTENSION_EVENTS = [
    "review_prompt_shown",
    "review_prompt_clicked",
    "signup_completed",
    "first_card_created",
    "first_srs_review",
    "upgrade_prompt_shown",
    "upgrade_prompt_clicked",
    "checkout_started",
    "onboarding_shown"
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
  var TRACK_EXTENSION_EVENT_MESSAGE = "avc-track-extension-event";
  function sendExtensionEventBeacon(event) {
    if (!isExtensionEvent(event)) return;
    try {
      const url = `${WEB_URL}/api/extension/track`;
      const payload = JSON.stringify({ event, v: extensionVersion() });
      void fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-avc-extension-id": extensionId()
        },
        body: payload,
        keepalive: true
      }).catch(() => {
      });
    } catch {
    }
  }
  function trackExtensionEvent(event) {
    if (!isExtensionEvent(event)) return;
    if (inServiceWorker()) {
      sendExtensionEventBeacon(event);
      return;
    }
    try {
      void chrome.runtime.sendMessage({ type: TRACK_EXTENSION_EVENT_MESSAGE, event }).catch(() => {
      });
    } catch {
    }
  }
  var EXTENSION_MILESTONE_STORAGE_KEY = "funnelMilestones";
  var milestoneInFlight = /* @__PURE__ */ new Set();
  async function trackExtensionMilestone(event) {
    if (milestoneInFlight.has(event)) return false;
    milestoneInFlight.add(event);
    try {
      const result = await chrome.storage.local.get([EXTENSION_MILESTONE_STORAGE_KEY]);
      const milestones = result[EXTENSION_MILESTONE_STORAGE_KEY] && typeof result[EXTENSION_MILESTONE_STORAGE_KEY] === "object" ? result[EXTENSION_MILESTONE_STORAGE_KEY] : {};
      if (milestones[event]) return false;
      await chrome.storage.local.set({
        [EXTENSION_MILESTONE_STORAGE_KEY]: { ...milestones, [event]: true }
      });
      trackExtensionEvent(event);
      return true;
    } catch {
      return false;
    } finally {
      milestoneInFlight.delete(event);
    }
  }

  // src/lib/feature-events.ts
  var FEATURE_EVENTS = [
    "card_shown",
    "card_known",
    "card_learn",
    "word_saved",
    "review_done",
    "listening_started",
    "install_first_run",
    "extension_linked"
  ];
  function isFeatureEvent(v) {
    return typeof v === "string" && FEATURE_EVENTS.includes(v);
  }
  var TRACK_URL = WEB_URL + "/api/track";
  var TRACK_FEATURE_MESSAGE = "avc-track-feature";
  function syncToken() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(
          ["syncToken"],
          (r) => resolve(typeof r?.syncToken === "string" ? r.syncToken : "")
        );
      } catch {
        resolve("");
      }
    });
  }
  var PRO_FUNNEL_EVENTS = [
    "pro_prompt_shown",
    "pro_prompt_clicked",
    "pro_checkout_started"
  ];
  var PRO_SURFACES = [
    "ext_popup",
    "ext_milestone",
    "ext_popup_limit",
    "ext_limit_sheet"
  ];
  function isProFunnelEvent(v) {
    return typeof v === "string" && PRO_FUNNEL_EVENTS.includes(v);
  }
  function isProSurface(v) {
    return typeof v === "string" && PRO_SURFACES.includes(v);
  }
  var TRACK_PRO_MESSAGE = "avc-track-pro";
  async function postTrack(body) {
    const token = await syncToken();
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = "Bearer " + token;
    void fetch(TRACK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, v: extensionVersion() }),
      keepalive: true
    }).catch(() => {
    });
  }
  async function sendFeatureBeacon(event) {
    if (!isFeatureEvent(event)) return;
    try {
      await postTrack({ kind: "feature", name: event });
    } catch {
    }
  }
  async function sendProBeacon(event, surface) {
    if (!isProFunnelEvent(event) || !isProSurface(surface)) return;
    try {
      await postTrack({ kind: "feature", name: event, surface });
    } catch {
    }
  }
  async function trackFeature(event) {
    if (!isFeatureEvent(event)) return;
    if (inServiceWorker()) {
      await sendFeatureBeacon(event);
      return;
    }
    try {
      void chrome.runtime.sendMessage({ type: TRACK_FEATURE_MESSAGE, event }).catch(() => {
      });
    } catch {
    }
  }

  // src/lib/onboarding.ts
  var ONBOARDING_STORAGE_KEY = "onboarding";
  var ONBOARDING_CHECKLIST_AFTER_MS = 24 * 36e5;
  var EMPTY_ONBOARDING = {
    installedAt: 0,
    shownAt: 0,
    watchedAt: 0,
    cardShownAt: 0,
    firstCardAt: 0,
    celebratedAt: 0,
    checklistDismissedAt: 0
  };
  function stamp(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  function normalizeOnboarding(raw) {
    if (!raw || typeof raw !== "object") return { ...EMPTY_ONBOARDING };
    const o = raw;
    return {
      installedAt: stamp(o.installedAt),
      shownAt: stamp(o.shownAt),
      watchedAt: stamp(o.watchedAt),
      cardShownAt: stamp(o.cardShownAt),
      firstCardAt: stamp(o.firstCardAt),
      celebratedAt: stamp(o.celebratedAt),
      checklistDismissedAt: stamp(o.checklistDismissedAt)
    };
  }
  function applyStamp(state, field, now) {
    if (state[field] > 0) return state;
    return { ...state, [field]: stamp(now) || 1 };
  }

  // src/lib/onboarding-store.ts
  var queue = Promise.resolve();
  function enqueue(fn) {
    const next = queue.then(fn, fn);
    queue = next.catch((err) => warn("onboarding storage error:", err));
    return next;
  }
  async function readState() {
    const r = await chrome.storage.local.get([ONBOARDING_STORAGE_KEY]);
    return normalizeOnboarding(r[ONBOARDING_STORAGE_KEY]);
  }
  async function writeStamp(field, now) {
    const state = await readState();
    const next = applyStamp(state, field, now);
    if (next === state) return false;
    await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: next });
    return true;
  }
  function stampOnboarding(field, now = Date.now()) {
    return enqueue(async () => {
      try {
        if (!await writeStamp(field, now)) return false;
        if ((await readState())[field] === 0) await writeStamp(field, now);
        return true;
      } catch {
        return false;
      }
    });
  }

  // src/lib/storage.ts
  var queue2 = Promise.resolve();
  function todayKey() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv");
  }
  function enqueue2(fn) {
    const next = queue2.then(fn, fn);
    queue2 = next.catch((err) => warn("storage error:", err));
    return next;
  }
  function ensureDaily(stats, day) {
    if (!stats.daily) stats.daily = {};
    if (!stats.daily[day]) {
      stats.daily[day] = { met: 0, judged: 0, reviews: 0, watchMin: 0 };
    }
    return stats.daily[day];
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
  function withDefaults(stored) {
    const merged = { ...DEFAULTS, ...stored };
    if (merged.pauseMode === "notify") merged.pauseMode = "copilot";
    if (resolveStoredDirection(stored.learningDirection) === null && isJapaneseUiLocale()) {
      merged.learningDirection = "ja-en";
    }
    return merged;
  }
  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings"], (r) => {
        resolve(withDefaults(r.settings || {}));
      });
    });
  }
  function setSettings(partial) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["settings"]);
      const settings = { ...withDefaults(r.settings || {}), ...partial };
      await chrome.storage.local.set({ settings });
      return settings;
    });
  }
  function applyReviewResult(rec, passed, at) {
    rec.lastSeenAt = Math.max(rec.lastSeenAt || 0, at);
    if (!rec.srs) return;
    if (passed) {
      const newStage = rec.srs.stage + 1;
      if (newStage > 5) {
        rec.state = "known";
        rec.srs = null;
      } else {
        rec.srs.stage = newStage;
        rec.srs.dueAt = at + SRS_INTERVALS[newStage];
      }
    } else {
      rec.srs.stage = 1;
      rec.srs.lapses += 1;
      rec.srs.dueAt = at + SRS_INTERVALS[1];
    }
  }
  function getWebReviewSeq() {
    return chrome.storage.local.get(["webReviewSeq"]).then((r) => {
      const n = Number(r.webReviewSeq);
      return Number.isFinite(n) && n > 0 ? n : 0;
    });
  }
  function applyWebReviews(ops) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats", "webReviewSeq"]);
      const stored = Number(r.webReviewSeq);
      let seq = Number.isFinite(stored) && stored > 0 ? stored : 0;
      const fresh = ops.filter((op) => op && Number.isFinite(op.seq) && op.seq > seq && typeof op.base === "string").sort((a, b) => a.seq - b.seq);
      if (!fresh.length) return { applied: 0, seq };
      const vocab = r.vocab || {};
      const stats = r.stats || emptyStats();
      let applied = 0;
      for (const op of fresh) {
        seq = op.seq;
        const rec = vocab[op.base];
        if (!rec || rec.state !== "learning" || !rec.srs) continue;
        const parsed = Date.parse(op.at);
        const at = Number.isFinite(parsed) ? parsed : Date.now();
        applyReviewResult(rec, op.result === "pass", at);
        const daily = ensureDaily(stats, new Date(at).toLocaleDateString("sv"));
        daily.reviews += 1;
        daily.judged += 1;
        applied++;
      }
      await chrome.storage.local.set({ vocab, stats, webReviewSeq: seq });
      if (applied) sendBadge(stats);
      return { applied, seq };
    });
  }
  function exportAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings", "vocab", "stats"], (r) => {
        resolve({
          settings: withDefaults(r.settings || {}),
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
    return enqueue2(async () => {
      if (token) {
        await chrome.storage.local.set({
          syncToken: token,
          relinkNeeded: false,
          syncAuthFailures: 0
        });
      } else {
        await chrome.storage.local.set({ syncToken: "", syncProfile: null, syncStatus: { ...EMPTY_SYNC_STATUS } });
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
  function mergeSyncProfile(previous, incoming) {
    const base = previous ?? { email: null, name: null, plan: null };
    if (!incoming || typeof incoming !== "object") return { ...base };
    return {
      email: "email" in incoming ? incoming.email ?? null : base.email,
      name: "name" in incoming ? incoming.name ?? null : base.name,
      plan: "plan" in incoming ? normalizeSyncPlan(incoming.plan) : base.plan
    };
  }
  function normalizeSyncPlan(value) {
    return value === "free" || value === "pro" || value === "max" ? value : null;
  }
  var EMPTY_SYNC_STATUS = {
    state: "idle",
    lastAttemptAt: null,
    lastSuccessAt: null,
    error: null
  };
  function getSyncProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncProfile"], (r) => {
        const p = r.syncProfile;
        resolve(
          p && typeof p === "object" ? { email: p.email ?? null, name: p.name ?? null, plan: normalizeSyncPlan(p.plan) } : null
        );
      });
    });
  }
  function setSyncProfile(incoming) {
    return enqueue2(async () => {
      const previous = await getSyncProfile();
      await chrome.storage.local.set({ syncProfile: mergeSyncProfile(previous, incoming) });
    });
  }
  function getSyncStatus() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncStatus"], (r) => {
        const s = r.syncStatus;
        if (!s || typeof s !== "object") {
          resolve({ ...EMPTY_SYNC_STATUS });
          return;
        }
        const state = s.state === "syncing" || s.state === "ok" || s.state === "error" ? s.state : "idle";
        resolve({
          state,
          lastAttemptAt: Number.isFinite(s.lastAttemptAt) ? Number(s.lastAttemptAt) : null,
          lastSuccessAt: Number.isFinite(s.lastSuccessAt) ? Number(s.lastSuccessAt) : null,
          error: typeof s.error === "string" ? s.error : null
        });
      });
    });
  }
  function setSyncStatus(next) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ syncStatus: next }, () => resolve());
    });
  }
  function getAutoLinkAttemptedAt() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["autoLinkAttemptedAt"], (r) => {
        const n = Number(r.autoLinkAttemptedAt);
        resolve(Number.isFinite(n) && n > 0 ? n : null);
      });
    });
  }
  function setAutoLinkAttemptedAt(at) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ autoLinkAttemptedAt: at }, () => resolve());
    });
  }
  function getAutoLinkSuppressedUntil() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["autoLinkSuppressedUntil"], (r) => {
        const n = Number(r.autoLinkSuppressedUntil);
        resolve(Number.isFinite(n) && n > 0 ? n : null);
      });
    });
  }

  // src/lib/notify.ts
  function toastTab(tabId, text2, kind = "info") {
    chrome.tabs.sendMessage(tabId, { type: "avc-toast", text: text2, kind }).catch(() => {
    });
  }
  async function toastActiveTab(text2, kind = "info") {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tabId = tabs[0]?.id;
      if (tabId != null) toastTab(tabId, text2, kind);
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
  var syncQueued = false;
  async function pullRevision(token) {
    let data;
    try {
      const res = await fetch(SNAPSHOT_URL, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) return null;
      data = await res.json();
    } catch {
      return null;
    }
    const ops = data.envelope?.webReviews;
    if (Array.isArray(ops) && ops.length) {
      const { applied } = await applyWebReviews(ops);
      if (applied) log(`cloud sync: applied ${applied} review(s) from the cloud app`);
    }
    return data.envelope?.revision ?? null;
  }
  async function pullSettingsFromCloud() {
    const token = await getSyncToken();
    if (!token) return;
    try {
      const res = await fetch(SNAPSHOT_URL, { headers: { Authorization: "Bearer " + token } });
      if (res.status === 401) {
        await noteAuthFailure();
        return;
      }
      if (!res.ok) return;
      await noteSyncSuccess();
      const data = await res.json();
      const raw = data.envelope?.snapshot?.settings;
      if (!raw || typeof raw !== "object") return;
      const partial = { ...raw };
      if (partial.pauseMode === "notify") partial.pauseMode = "copilot";
      await setSettings(partial);
      log("cloud settings pulled");
    } catch (err) {
      warn("cloud settings pull error:", err);
    }
  }
  async function syncWithCloud() {
    await pushSnapshot();
  }
  async function pushSnapshot() {
    if (syncing) {
      syncQueued = true;
      return;
    }
    syncing = true;
    try {
      do {
        syncQueued = false;
        await pushSnapshotOnce();
      } while (syncQueued);
    } finally {
      syncing = false;
    }
  }
  async function pushSnapshotOnce() {
    const token = await getSyncToken();
    if (!token) return;
    const startedAt = Date.now();
    const previousStatus = await getSyncStatus();
    const lastSuccessAt = previousStatus.lastSuccessAt;
    await setSyncStatus({ state: "syncing", lastAttemptAt: startedAt, lastSuccessAt, error: null });
    try {
      let conflictRevision = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const expectedRevision = await pullRevision(token) ?? conflictRevision;
        const exportData = await exportAll();
        const settingsNoKey = { ...exportData.settings };
        delete settingsNoKey.openaiKey;
        const safeExport = { ...exportData, settings: settingsNoKey };
        const appliedWebReviewSeq = await getWebReviewSeq();
        const res = await fetch(SNAPSHOT_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ export: safeExport, expectedRevision, appliedWebReviewSeq })
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          conflictRevision = data.conflict?.currentRevision ?? null;
          continue;
        }
        if (res.status === 401) {
          await noteAuthFailure();
          await setSyncStatus({
            state: "error",
            lastAttemptAt: startedAt,
            lastSuccessAt,
            error: "Account link was rejected. Open animevocab.com/app to reconnect."
          });
          return;
        }
        if (!res.ok) {
          warn("cloud sync failed: HTTP", res.status);
          await setSyncStatus({
            state: "error",
            lastAttemptAt: startedAt,
            lastSuccessAt,
            error: `Cloud returned HTTP ${res.status}.`
          });
          return;
        }
        await noteSyncSuccess();
        await setSyncStatus({ state: "ok", lastAttemptAt: startedAt, lastSuccessAt: Date.now(), error: null });
        log("cloud sync ok");
        return;
      }
      warn("cloud sync: gave up after revision conflict");
      await setSyncStatus({
        state: "error",
        lastAttemptAt: startedAt,
        lastSuccessAt,
        error: "Cloud changed during sync. Retry to save the newest local snapshot."
      });
    } catch (err) {
      warn("cloud sync error:", err);
      await setSyncStatus({
        state: "error",
        lastAttemptAt: startedAt,
        lastSuccessAt,
        error: err instanceof Error ? err.message : "Network error while syncing."
      });
    }
  }

  // src/lib/account-link.ts
  var TOKEN_URL = WEB_URL + "/api/sync/token";
  var AUTO_LINK_COOLDOWN_MS = 60 * 60 * 1e3;
  var SIGN_OUT_SUPPRESSION_MS = 5 * 60 * 1e3;
  function shouldAttemptAutoLink(input) {
    if (input.hasToken) return false;
    if (input.suppressedUntil != null && input.now < input.suppressedUntil) return false;
    if (input.force) return true;
    if (input.lastAttemptAt == null) return true;
    if (input.lastAttemptAt > input.now) return true;
    return input.now - input.lastAttemptAt >= AUTO_LINK_COOLDOWN_MS;
  }
  function interpretMintResponse(httpStatus, body) {
    if (httpStatus === 401 || httpStatus === 403) return { status: "signed-out" };
    if (httpStatus < 200 || httpStatus >= 300) return { status: "error", detail: `HTTP ${httpStatus}` };
    const data = body || {};
    const token = typeof data.token === "string" ? data.token : "";
    if (!token) return { status: "error", detail: "no token in response" };
    const p = data.profile && typeof data.profile === "object" ? data.profile : {};
    return {
      status: "linked",
      token,
      profile: {
        email: typeof p.email === "string" ? p.email : null,
        name: typeof p.name === "string" ? p.name : null,
        plan: normalizeSyncPlan(p.plan)
      }
    };
  }
  var inFlight = null;
  function attemptAutoLink(trigger, options = {}) {
    if (inFlight) return inFlight;
    const attempt = runAutoLink(trigger, options).finally(() => {
      inFlight = null;
    });
    inFlight = attempt;
    return attempt;
  }
  async function runAutoLink(trigger, options = {}) {
    const force = options.force === true;
    const [hasToken, lastAttemptAt, suppressedUntil] = await Promise.all([
      getSyncToken().then((t) => !!t),
      getAutoLinkAttemptedAt(),
      getAutoLinkSuppressedUntil()
    ]);
    if (hasToken) return { linked: false, outcome: "already-linked" };
    if (!shouldAttemptAutoLink({ hasToken, now: Date.now(), lastAttemptAt, suppressedUntil, force })) {
      return { linked: false, outcome: "throttled" };
    }
    await setAutoLinkAttemptedAt(Date.now());
    let outcome;
    try {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
      const body = await res.json().catch(() => null);
      outcome = interpretMintResponse(res.status, body);
    } catch (err) {
      outcome = { status: "error", detail: err instanceof Error ? err.message : "network error" };
    }
    if (outcome.status !== "linked") {
      if (outcome.status === "error") warn(`auto-link (${trigger}) failed:`, outcome.detail);
      return { linked: false, outcome: outcome.status };
    }
    await setSyncToken(outcome.token);
    await setSyncProfile(outcome.profile);
    await trackExtensionMilestone("signup_completed");
    log(`auto-link (${trigger}) ok`);
    return { linked: true, outcome: "linked" };
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
  var STREAM_IDLE_MS = 2e4;
  var STREAM_MAX_MS = 12e4;
  async function streamChat(message, history, payload, onChunk) {
    const token = await getSyncToken();
    if (!token) return { ok: false, error: "not_linked" };
    const abort = new AbortController();
    let idle = null;
    const armIdle = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => abort.abort(), STREAM_IDLE_MS);
    };
    const cap = setTimeout(() => abort.abort(), STREAM_MAX_MS);
    armIdle();
    let received = false;
    try {
      const res = await fetch(WEB_URL + "/api/ai/coach/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ mode: "chat", message, history, ...payload }),
        signal: abort.signal
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error || `http_${res.status}` };
      }
      if (!res.body) return { ok: false, error: "no_body" };
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armIdle();
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
      if (received) return { ok: true };
      return { ok: false, error: abort.signal.aborted ? "timeout" : "network" };
    } finally {
      if (idle) clearTimeout(idle);
      clearTimeout(cap);
    }
  }

  // src/lib/word-picker-client.ts
  var sessionCache = /* @__PURE__ */ new Map();
  function sessionKey(req) {
    const bases = req.candidates.map((c) => c.word).sort().join("|");
    return `${req.direction || "en-ja"}:${req.learnerLevel}:${req.line}:${bases}`;
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

  // src/lib/extract-words-client.ts
  var sessionCache2 = /* @__PURE__ */ new Map();
  function sessionKey2(line, direction, level) {
    return `${direction}:${level}:${line}`;
  }
  async function fetchExtractWords(opts) {
    const key = sessionKey2(opts.line, opts.direction, opts.learnerLevel);
    const hit = sessionCache2.get(key);
    if (hit) return { ok: true, words: hit, cached: true };
    const token = await getSyncToken();
    if (!token) return { ok: false, error: "not_linked" };
    try {
      const res = await fetch(WEB_URL + "/api/ai/extract-words", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          line: opts.line,
          direction: opts.direction,
          learnerLevel: opts.learnerLevel,
          title: opts.title || void 0
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || `http_${res.status}` };
      const words = data.result?.words;
      if (!words?.length) return { ok: false, error: "empty_extract" };
      sessionCache2.set(key, words);
      return { ok: true, words, cached: data.cached };
    } catch {
      return { ok: false, error: "network" };
    }
  }

  // src/lib/anime-context-client.ts
  var sessionCache3 = /* @__PURE__ */ new Map();
  async function fetchAnimeContext(title) {
    const clean = (title || "").trim();
    if (!clean) return null;
    const cached = sessionCache3.get(clean.toLowerCase());
    if (cached) return cached;
    const token = await getSyncToken();
    if (!token) return null;
    try {
      const res = await fetch(
        WEB_URL + "/api/anime/context?title=" + encodeURIComponent(clean),
        { headers: { Authorization: "Bearer " + token } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const ctx = (data.context || "").trim();
      if (ctx) sessionCache3.set(clean.toLowerCase(), ctx);
      return ctx || null;
    } catch {
      return null;
    }
  }

  // src/lib/tts-client.ts
  async function fetchCloudTts(text2, token) {
    const res = await fetch(WEB_URL + "/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ text: text2 })
    });
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      return { blob: null, error: data.error || "auto_quota_exhausted" };
    }
    if (!res.ok) return { blob: null, error: `http_${res.status}` };
    return { blob: await res.blob() };
  }
  async function fetchByoTts(text2, key) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model: "tts-1", voice: "nova", input: text2, response_format: "mp3" })
    });
    if (!res.ok) return null;
    return res.blob();
  }
  async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  async function fetchTtsAudio(text2) {
    const trimmed = (text2 || "").trim();
    if (!trimmed) return null;
    const settings = await getSettings();
    if (settings.openaiKey?.trim()) {
      const blob = await fetchByoTts(trimmed, settings.openaiKey.trim());
      if (blob) return { b64: await blobToBase64(blob), mime: blob.type || "audio/mpeg" };
    }
    const token = await getSyncToken();
    if (token) {
      const { blob, error } = await fetchCloudTts(trimmed, token);
      if (blob) return { b64: await blobToBase64(blob), mime: blob.type || "audio/mpeg" };
      if (error) return { error };
    }
    return null;
  }

  // src/lib/usage-client.ts
  function meter(used, limit) {
    const u = Number(used);
    const l = Number(limit);
    if (!Number.isFinite(u) || !Number.isFinite(l)) return null;
    const usedN = Math.max(0, Math.floor(u));
    const limitN = Math.max(0, Math.floor(l));
    return { used: usedN, limit: limitN, left: Math.max(0, limitN - usedN) };
  }
  async function fetchUsage() {
    const token = await getSyncToken();
    if (!token) return null;
    const headers = { Authorization: "Bearer " + token };
    const [aiRes, listenRes] = await Promise.allSettled([
      fetch(WEB_URL + "/api/me/usage", { headers }).then((r) => r.ok ? r.json() : null),
      fetch(BACKEND_URL + "/v1/usage", { headers }).then((r) => r.ok ? r.json() : null)
    ]);
    const aiData = aiRes.status === "fulfilled" ? aiRes.value : null;
    const listenData = listenRes.status === "fulfilled" ? listenRes.value : null;
    if (!aiData && !listenData) return null;
    const raw = aiData || {};
    const listen = listenData || {};
    return {
      plan: raw.plan || listen.plan || "free",
      unlimited: !!raw.unlimited,
      // Each half is independent: the AI endpoint can fail while the listening
      // one answers (and vice versa). Whatever is missing stays null.
      ai: aiData ? meter(raw.ai?.used, raw.ai?.limit) : null,
      auto: aiData ? meter(raw.auto?.used, raw.auto?.limit) : null,
      listening: listenData ? meter(listen.usedMinutes, listen.capMinutes) : null,
      tiers: raw.tiers || null
    };
  }

  // src/lib/course-listening.ts
  var ID = /^[a-z0-9][a-z0-9-]{0,127}$/;
  var obj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  var text = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max;
  function courseLessonFromState(state) {
    if (!obj(state) || !obj(state.lesson)) return null;
    const l = state.lesson;
    if (!text(l.id, 128) || !ID.test(l.id) || l.script !== "romaji" && l.script !== "kana" || !text(l.canDo, 500)) return null;
    if (!Array.isArray(l.vocabulary) || l.vocabulary.length > 20) return null;
    const words = [];
    for (const v of l.vocabulary) {
      if (!obj(v) || !text(v.id, 128) || !text(v.reading, 120) || !text(v.meaning, 250)) return null;
      const kana = text(v.kana, 120) ? v.kana : l.script === "kana" ? v.reading : "";
      words.push({ id: v.id, reading: v.reading, meaning: v.meaning, kana });
    }
    const unit = Number.isSafeInteger(l.unit) && l.unit >= 1 && l.unit <= 99 ? l.unit : null;
    const episode = obj(l.episode) && Number.isSafeInteger(l.episode.number) && text(l.episode.title, 120) ? { number: l.episode.number, title: l.episode.title } : null;
    const ids = new Set(words.map((w) => w.id));
    const heard = Array.isArray(l.heard) ? l.heard.filter((id) => typeof id === "string" && ids.has(id)) : [];
    return {
      id: l.id,
      unit,
      title: text(l.title, 120) ? l.title : null,
      canDo: l.canDo,
      script: l.script,
      episode,
      words,
      heard
    };
  }
  function lessonUrl(lesson2, step) {
    if (!ID.test(lesson2.id)) throw new Error("Invalid lesson");
    return `https://animevocab.com/app/n5/lessons/${lesson2.id}?script=${lesson2.script}#${step}`;
  }

  // src/lib/n5-service.ts
  var CACHE_KEY = "n5Listen";
  var OUTBOX_KEY = "n5ListenOutbox";
  var FRESH_MS = 10 * 6e4;
  var ID2 = /^[a-z0-9][a-z0-9-]{0,127}$/;
  var CourseError = class extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  };
  var tail = Promise.resolve();
  function serial(fn) {
    const next = tail.then(fn, fn);
    tail = next.catch(() => {
    });
    return next;
  }
  async function identity() {
    const token = await getSyncToken();
    if (!token) return null;
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    return { token, tokenHash: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("") };
  }
  async function request(token, path, body) {
    const response = await fetch(BACKEND_URL + "/v1/n5" + path, {
      method: body === void 0 ? "GET" : "POST",
      headers: { Authorization: "Bearer " + token, ...body === void 0 ? {} : { "Content-Type": "application/json" } },
      ...body === void 0 ? {} : { body: JSON.stringify(body) },
      signal: AbortSignal.timeout(1e4),
      cache: "no-store",
      redirect: "error"
    });
    if (!response.ok) throw new CourseError(response.status, `course_${response.status}`);
    const raw = await response.text();
    if (raw.length > 65536) throw new CourseError(502, "course_too_large");
    return JSON.parse(raw);
  }
  async function readCache() {
    const raw = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
    return raw && typeof raw.tokenHash === "string" ? raw : null;
  }
  async function readOutbox(tokenHash) {
    const raw = (await chrome.storage.local.get(OUTBOX_KEY))[OUTBOX_KEY];
    if (!raw || raw.tokenHash !== tokenHash) return { tokenHash, heard: {}, watched: [] };
    return { tokenHash, heard: raw.heard || {}, watched: Array.isArray(raw.watched) ? raw.watched : [] };
  }
  async function writeOutbox(outbox) {
    await chrome.storage.local.set({ [OUTBOX_KEY]: outbox });
  }
  function withPending(lesson2, outbox) {
    if (!lesson2) return null;
    const pending = outbox.heard[lesson2.id] || [];
    return { ...lesson2, heard: [.../* @__PURE__ */ new Set([...lesson2.heard, ...pending])] };
  }
  async function flush(token, tokenHash) {
    const outbox = await readOutbox(tokenHash);
    for (const [lessonId, wordIds] of Object.entries(outbox.heard)) {
      try {
        const saved = await request(token, "/heard", { lessonId, wordIds: wordIds.slice(0, 20) });
        delete outbox.heard[lessonId];
        const cache = await readCache();
        if (cache?.tokenHash === tokenHash && cache.lesson?.id === lessonId && Array.isArray(saved?.heard)) {
          const ids = new Set(cache.lesson.words.map((w) => w.id));
          cache.lesson.heard = saved.heard.filter((id) => typeof id === "string" && ids.has(id));
          await chrome.storage.local.set({ [CACHE_KEY]: cache });
        }
      } catch (error) {
        if (error instanceof CourseError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429) delete outbox.heard[lessonId];
        else break;
      }
      await writeOutbox(outbox);
    }
    for (const event of [...outbox.watched]) {
      try {
        await request(token, "/events", { episodeId: event.episodeId, kind: "watch_complete", idempotencyKey: event.idempotencyKey });
      } catch (error) {
        if (!(error instanceof CourseError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429)) break;
      }
      outbox.watched = outbox.watched.filter((e) => e.idempotencyKey !== event.idempotencyKey);
      await writeOutbox(outbox);
    }
  }
  async function lesson(refresh) {
    const who = await identity();
    if (!who) return { lesson: null, cache: null };
    const cached = await readCache();
    const mine = cached?.tokenHash === who.tokenHash ? cached : null;
    if (mine && !refresh && Date.now() - mine.fetchedAt < FRESH_MS) {
      return { lesson: withPending(mine.lesson, await readOutbox(who.tokenHash)), cache: mine };
    }
    let next;
    try {
      const state = await request(who.token, "/extension/state");
      const context = state?.context;
      next = {
        tokenHash: who.tokenHash,
        lesson: courseLessonFromState(state),
        episodeId: typeof context?.episodeId === "string" && ID2.test(context.episodeId) ? context.episodeId : null,
        fetchedAt: Date.now()
      };
    } catch (error) {
      if (!(error instanceof CourseError && (error.status === 401 || error.status === 404))) {
        return { lesson: withPending(mine?.lesson ?? null, await readOutbox(who.tokenHash)), cache: mine };
      }
      next = { tokenHash: who.tokenHash, lesson: null, episodeId: null, fetchedAt: Date.now() };
    }
    if (await getSyncToken() !== who.token) return { lesson: null, cache: null };
    await chrome.storage.local.set({ [CACHE_KEY]: next });
    return { lesson: withPending(next.lesson, await readOutbox(who.tokenHash)), cache: next };
  }
  var APP_ORIGINS = ["https://animevocab.com", "https://www.animevocab.com"];
  function handleN5(raw, sender, stopCapture) {
    return serial(async () => {
      try {
        if (sender.id !== chrome.runtime.id) return { ok: false, error: "forbidden" };
        const msg = raw && typeof raw === "object" ? raw : {};
        if (msg.type === "avc-n5-refresh") {
          const fromApp = !!sender.url && APP_ORIGINS.includes(new URL(sender.url).origin);
          const fromExtension = !!sender.url && sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`);
          if (!fromApp && !fromExtension) return { ok: false, error: "forbidden" };
          const { lesson: next } = await lesson(true);
          return { ok: true, lesson: next };
        }
        if (msg.type === "avc-n5-lesson") {
          const { lesson: next } = await lesson(msg.refresh === true);
          return { ok: true, lesson: next };
        }
        if (msg.type === "avc-n5-heard") {
          const who = await identity();
          const { lesson: current } = await lesson(false);
          if (!who || !current || msg.lessonId !== current.id || !Array.isArray(msg.wordIds)) return { ok: false, error: "no_lesson" };
          const known = new Set(current.words.map((w) => w.id));
          const fresh = msg.wordIds.filter((id) => typeof id === "string" && known.has(id) && !current.heard.includes(id));
          if (!fresh.length) return { ok: true, lesson: current };
          const outbox = await readOutbox(who.tokenHash);
          outbox.heard[current.id] = [.../* @__PURE__ */ new Set([...outbox.heard[current.id] || [], ...fresh])].slice(0, 20);
          await writeOutbox(outbox);
          void serial(() => flush(who.token, who.tokenHash)).catch(() => {
          });
          return { ok: true, lesson: withPending(current, outbox) };
        }
        if (msg.type === "avc-n5-finish") {
          const tabId = sender.tab?.id;
          const who = await identity();
          const { lesson: current, cache } = await lesson(false);
          if (tabId === void 0 || !who || !current || !cache?.episodeId) return { ok: false, error: "There is no course episode to finish." };
          await stopCapture(tabId);
          const outbox = await readOutbox(who.tokenHash);
          if (!outbox.watched.some((e) => e.episodeId === cache.episodeId)) {
            outbox.watched.push({ episodeId: cache.episodeId, idempotencyKey: crypto.randomUUID() });
            await writeOutbox(outbox);
          }
          await flush(who.token, who.tokenHash).catch(() => {
          });
          await chrome.tabs.create({ url: lessonUrl(current, "practice") });
          return { ok: true };
        }
        return { ok: false, error: "unknown_message" };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Course connection is unavailable." };
      }
    });
  }
  async function invalidateN5() {
    await chrome.storage.local.remove(CACHE_KEY);
  }
  async function retryPendingN5() {
    try {
      const who = await identity();
      if (who) await serial(() => flush(who.token, who.tokenHash));
    } catch {
    }
  }

  // src/lib/subs-client.ts
  async function fetchSubTranslation(req) {
    const token = await getSyncToken();
    if (!token) return { ok: false, error: "not_linked" };
    try {
      const res = await fetch(WEB_URL + "/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ line: req.line, context: req.context, title: req.title || void 0, words: req.words }),
        signal: AbortSignal.timeout(8e3)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.result || typeof data.result.en !== "string") return { ok: false, error: data.error || `http_${res.status}` };
      const readings = {};
      if (data.result.readings && typeof data.result.readings === "object") {
        for (const [k, v] of Object.entries(data.result.readings)) {
          if (/^\d{1,3}$/.test(k) && typeof v === "string" && /^[ぁ-ゖァ-ヺー]{1,30}$/.test(v)) readings[k] = v;
        }
      }
      return { ok: true, result: { en: data.result.en.slice(0, 400), readings } };
    } catch {
      return { ok: false, error: "network" };
    }
  }

  // src/lib/capture-starts.ts
  var CaptureStarts = class {
    constructor() {
      this.pending = /* @__PURE__ */ new Map();
    }
    begin(tabId) {
      const token = /* @__PURE__ */ Symbol();
      this.pending.set(tabId, token);
      return token;
    }
    cancel(tabId) {
      this.pending.delete(tabId);
    }
    current(tabId, token) {
      return this.pending.get(tabId) === token;
    }
  };

  // src/lib/listening-coordination.ts
  function listeningRegistry(read, write) {
    let tail2 = Promise.resolve();
    return (tabId, active, current = () => true) => {
      const update = tail2.then(async () => {
        const tabs = await read();
        if (!current()) return false;
        if (active) tabs[tabId] = true;
        else delete tabs[tabId];
        await write(tabs);
        return current();
      });
      tail2 = update.catch(() => {
      });
      return update;
    };
  }
  async function retryCaptureStart(send, current, wait = () => new Promise((resolve) => setTimeout(resolve, 200))) {
    for (let i = 0; i < 15; i++) {
      if (!current()) return { ok: false, error: "Listening start was cancelled." };
      try {
        const response = await send();
        if (response) return response;
      } catch {
      }
      await wait();
    }
    throw new Error("offscreen document never acknowledged (audio capture could not start)");
  }

  // src/entries/background.ts
  var captureStarts = new CaptureStarts();
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
  var STREAMING_TAB_PATTERNS = [
    "*://*.youtube.com/*",
    "*://*.netflix.com/*",
    "*://*.crunchyroll.com/*"
  ];
  var APP_TAB_PATTERNS = ["https://animevocab.com/*", "https://www.animevocab.com/*"];
  async function linkAccount(trigger, options = {}) {
    const result = await attemptAutoLink(trigger, options);
    if (result.linked) syncWithCloud().catch(() => {
    });
    return result;
  }
  async function ensureSyncBridgeInOpenTabs() {
    const tabs = await chrome.tabs.query({ url: APP_TAB_PATTERNS });
    await Promise.all(tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        const probe = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => !!window.__avcSyncBridgeLoaded
        });
        if (probe.some((r) => r.result)) return;
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["sync-bridge.js"] });
      } catch (err) {
        console.warn("[AVC] could not attach account bridge to tab", tab.id, String(err));
      }
    }));
  }
  chrome.runtime.onInstalled.addListener((details) => {
    chrome.storage.local.get(["settings"], (result) => {
      const raw = result.settings || {};
      delete raw.licenseKey;
      if (raw.pauseMode === "notify") raw.pauseMode = "copilot";
      chrome.storage.local.set({ settings: { ...DEFAULTS, ...raw } });
    });
    if (details.reason === "update") {
      chrome.tabs.query({ url: STREAMING_TAB_PATTERNS }, (tabs) => {
        for (const tab of tabs) {
          if (tab.id != null) chrome.tabs.reload(tab.id).catch(() => {
          });
        }
      });
    }
    if (details.reason === "install") {
      void stampOnboarding("installedAt");
      void trackFeature("install_first_run");
      chrome.tabs.create({ url: chrome.runtime.getURL("welcome/welcome.html") }).catch(() => {
      });
      void linkAccount("install");
    }
    void ensureSyncBridgeInOpenTabs();
  });
  void ensureSyncBridgeInOpenTabs();
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
  chrome.runtime.onStartup.addListener(() => {
    syncWithCloud().catch(() => {
    });
    void retryPendingN5();
    void linkAccount("startup");
  });
  chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 30 }));
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) {
      syncWithCloud().catch(() => {
      });
      void retryPendingN5();
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.vocab || changes.stats) scheduleSync();
    const token = changes.syncToken;
    if (token && token.oldValue !== token.newValue) void invalidateN5();
    if (token && !token.oldValue && typeof token.newValue === "string" && token.newValue) {
      void trackFeature("extension_linked");
    }
  });
  async function getListening() {
    const r = await chrome.storage.session.get(["listeningTabs"]);
    return r.listeningTabs || {};
  }
  var updateListening = listeningRegistry(getListening, async (tabs) => {
    await chrome.storage.session.set({ listeningTabs: tabs });
  });
  async function getCopilot() {
    const r = await chrome.storage.session.get(["copilotTabs"]);
    return r.copilotTabs || {};
  }
  async function setCopilotTab(tabId, open) {
    const tabs = await getCopilot();
    if (open) tabs[tabId] = true;
    else delete tabs[tabId];
    await chrome.storage.session.set({ copilotTabs: tabs });
  }
  async function ensureOffscreen() {
    if (chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: "Capture tab audio and transcribe Japanese speech so vocabulary cards can be shown for what the viewer hears."
    });
  }
  var CONTENT_SCRIPTS = ["key-shield.js", "vendor/kuromoji.js", "content.js"];
  async function tabNeedsAllFrames(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      return !!tab.url && /crunchyroll\.com/i.test(tab.url);
    } catch {
      return false;
    }
  }
  async function deliverTranscript(tabId, text2, start, end) {
    const payload = {
      type: "avc-transcript",
      text: text2,
      ...typeof start === "number" ? { start } : {},
      ...typeof end === "number" ? { end } : {}
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
    const generation = captureStarts.begin(tabId);
    const cancelled = () => !captureStarts.current(tabId, generation);
    const cancelledAck = { ok: false, error: "Listening start was cancelled." };
    const r = await chrome.storage.local.get(["settings"]);
    const settings = r.settings || {};
    let auth;
    if (settings.openaiKey?.trim()) {
      auth = { kind: "byo", key: settings.openaiKey.trim() };
    } else {
      const syncToken2 = await getSyncToken();
      if (!syncToken2) {
        return { ok: false, error: NOT_LINKED_MSG };
      }
      auth = { kind: "cloud", syncToken: syncToken2, backendUrl: BACKEND_URL };
    }
    const injected = await ensureContentScript(tabId);
    if (!injected) {
      return { ok: false, error: "Couldn't load the extension into this tab. Try reloading the page, then Start again." };
    }
    const cacheKey = auth.kind === "cloud" ? await getCacheKeyFromTab(tabId) : null;
    if (cancelled()) return cancelledAck;
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
    if (cancelled()) return cancelledAck;
    const language = settings.learningDirection === "ja-en" ? "en" : "ja";
    const ack = await retryCaptureStart(() => chrome.runtime.sendMessage({
      type: "avc-offscreen-start",
      streamId,
      tabId,
      auth,
      model: settings.transcribeModel || DEFAULTS.transcribeModel,
      language,
      cacheKey: cacheKey || void 0
    }), () => !cancelled()).catch((err) => ({ ok: false, error: String(err.message || err) }));
    if (cancelled()) return cancelledAck;
    if (!ack || ack.ok === false) {
      return { ok: false, error: ack?.error || "Audio capture failed to start." };
    }
    const marked = await updateListening(tabId, true, () => !cancelled());
    if (!marked || cancelled()) return cancelledAck;
    chrome.tabs.sendMessage(tabId, { type: "avc-listening-state", active: true }).catch(() => {
    });
    chrome.action.setBadgeText({ tabId, text: "REC" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#f87171" });
    void trackFeature("listening_started");
    console.log("[AVC] listening started on tab", tabId, "model", settings.transcribeModel || DEFAULTS.transcribeModel);
    return { ok: true };
  }
  async function stopListening(tabId) {
    captureStarts.cancel(tabId);
    chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {
    });
    chrome.tabs.sendMessage(tabId, { type: "avc-listening-state", active: false }).catch(() => {
    });
    await updateListening(tabId, false);
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {
    });
    return { ok: true };
  }
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (typeof msg?.type === "string" && msg.type.startsWith("avc-n5-")) {
      void handleN5(msg, sender, async (tabId) => {
        await stopListening(tabId);
      }).then(sendResponse);
      return true;
    }
    if (msg.type === "avc-badge") {
      const text2 = (msg.count || 0) > 0 ? String(msg.count) : "";
      chrome.action.setBadgeText({ text: text2 });
      chrome.action.setBadgeBackgroundColor({ color: "#c4553a" });
      return;
    }
    if (msg.type === TRACK_FEATURE_MESSAGE) {
      if (isFeatureEvent(msg.event)) void sendFeatureBeacon(msg.event);
      return;
    }
    if (msg.type === TRACK_PRO_MESSAGE) {
      if (isProFunnelEvent(msg.event) && isProSurface(msg.surface)) {
        void sendProBeacon(msg.event, msg.surface);
      }
      return;
    }
    if (msg.type === TRACK_EXTENSION_EVENT_MESSAGE) {
      if (isExtensionEvent(msg.event)) sendExtensionEventBeacon(msg.event);
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
      const tabId = msg.tabId ?? sender.tab?.id;
      getListening().then((tabs) => sendResponse({ listening: tabId != null && !!tabs[tabId] }));
      return true;
    }
    if (msg.type === "avc-session-state") {
      const tabId = msg.tabId ?? sender.tab?.id;
      if (tabId == null) {
        sendResponse({ listening: false, copilot: false });
        return true;
      }
      Promise.all([getListening(), getCopilot()]).then(
        ([listening, copilot]) => sendResponse({ listening: !!listening[tabId], copilot: !!copilot[tabId] })
      ).catch(() => sendResponse({ listening: false, copilot: false }));
      return true;
    }
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
    if (msg.type === "avc-account-link") {
      linkAccount(typeof msg.trigger === "string" ? msg.trigger : "ui", { force: msg.force === true }).then((result) => sendResponse({ ok: true, ...result })).catch(() => sendResponse({ ok: false, linked: false, outcome: "error" }));
      return true;
    }
    if (msg.type === "avc-pull-settings") {
      pullSettingsFromCloud().then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-sync-now") {
      syncWithCloud().then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
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
    if (msg.type === "avc-translate") {
      fetchSubTranslation(msg.payload).then(sendResponse).catch(() => sendResponse({ ok: false, error: "network" }));
      return true;
    }
    if (msg.type === "avc-extract-words") {
      fetchExtractWords(msg.payload).then(sendResponse).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-anime-context") {
      fetchAnimeContext(msg.title || null).then((context) => sendResponse({ ok: true, context: context || "" })).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-tts") {
      fetchTtsAudio(msg.text || "").then((audio) => {
        if (audio && audio.b64) {
          sendResponse({ ok: true, b64: audio.b64, mime: audio.mime });
          return;
        }
        const reason = audio && "error" in audio && audio.error || "not_linked";
        if (reason === "auto_quota_exhausted" && sender.tab?.id != null) {
          chrome.tabs.sendMessage(sender.tab.id, { type: "avc-limit-reached", kind: "auto" }).catch(() => {
          });
        }
        sendResponse({ ok: false, error: reason });
      }).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-usage") {
      fetchUsage().then(
        (usage) => usage ? sendResponse({ ok: true, usage }) : sendResponse({ ok: false, error: "not_linked" })
      ).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-open-url" && typeof msg.url === "string") {
      chrome.tabs.create({ url: msg.url }).catch(() => {
      });
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === "avc-agent-pin" || msg.type === "avc-agent-show" || msg.type === "avc-agent-hide" || msg.type === "avc-agent-status" || msg.type === "avc-caption-status") {
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
        });
      }).catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-transcript") {
      console.log("[AVC] relaying transcript to tab", msg.tabId, "\u2192", msg.text);
      void deliverTranscript(msg.tabId, msg.text, msg.start, msg.end);
      return;
    }
    if (msg.type === "avc-update-cache-key" && sender.tab?.id != null) {
      const tabId = sender.tab.id;
      getListening().then((tabs) => {
        if (tabs[tabId]) {
          chrome.runtime.sendMessage({ type: "avc-offscreen-update-key", tabId, cacheKey: msg.key || "" }).catch(() => {
          });
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
      }).catch(() => {
      });
      return;
    }
    if (msg.type === "avc-listen-error") {
      getListening().then(async () => {
        const stopCodes = ["invalid-key", "capture-failed", "quota-exceeded", "not-signed-in", "connection-lost"];
        if (stopCodes.includes(msg.code || "")) {
          captureStarts.cancel(msg.tabId);
          await updateListening(msg.tabId, false);
          if (msg.tabId != null) {
            chrome.tabs.sendMessage(msg.tabId, { type: "avc-listening-state", active: false }).catch(() => {
            });
          }
          chrome.action.setBadgeText({ tabId: msg.tabId, text: "ERR" });
          chrome.action.setBadgeBackgroundColor({ tabId: msg.tabId, color: "#f87171" });
          if (msg.tabId != null) {
            if (msg.code === "quota-exceeded") {
              chrome.tabs.sendMessage(msg.tabId, { type: "avc-limit-reached", kind: "listening" }).catch(() => toastTab(msg.tabId, listenErrorText("quota-exceeded"), "error"));
            } else {
              toastTab(msg.tabId, listenErrorText(msg.code || ""), "error");
            }
          }
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
    captureStarts.cancel(tabId);
    const tabs = await getListening();
    if (tabs[tabId]) {
      chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {
      });
      await updateListening(tabId, false);
    }
    await setCopilotTab(tabId, false);
  });
})();
