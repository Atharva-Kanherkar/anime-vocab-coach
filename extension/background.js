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
  function trackExtensionEvent(event) {
    if (!isExtensionEvent(event)) return;
    try {
      const url = `${WEB_URL}/api/extension/track`;
      const payload = JSON.stringify({ event });
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
  function enqueue2(fn) {
    const next = queue2.then(fn, fn);
    queue2 = next.catch((err) => warn("storage error:", err));
    return next;
  }
  function emptyStats() {
    return { daily: {}, cardTimestamps: [] };
  }
  function withDefaults(stored) {
    const merged = { ...DEFAULTS, ...stored };
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
  var syncQueued = false;
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
      const exportData = await exportAll();
      const settingsNoKey = { ...exportData.settings };
      delete settingsNoKey.openaiKey;
      const safeExport = { ...exportData, settings: settingsNoKey };
      let expectedRevision = await currentRevision(token);
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(SNAPSHOT_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ export: safeExport, expectedRevision })
        });
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          expectedRevision = data.conflict?.currentRevision ?? null;
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
  async function fetchCloudTts(text, token) {
    const res = await fetch(WEB_URL + "/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ text })
    });
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      return { blob: null, error: data.error || "auto_quota_exhausted" };
    }
    if (!res.ok) return { blob: null, error: `http_${res.status}` };
    return { blob: await res.blob() };
  }
  async function fetchByoTts(text, key) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model: "tts-1", voice: "nova", input: text, response_format: "mp3" })
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
  async function fetchTtsAudio(text) {
    const trimmed = (text || "").trim();
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
    void linkAccount("startup");
  });
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
  async function deliverTranscript(tabId, text, start) {
    const payload = { type: "avc-transcript", text, ...typeof start === "number" ? { start } : {} };
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
    const language = settings.learningDirection === "ja-en" ? "en" : "ja";
    const ack = await sendToOffscreen({
      type: "avc-offscreen-start",
      streamId,
      tabId,
      auth,
      model: settings.transcribeModel || DEFAULTS.transcribeModel,
      language,
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
      void deliverTranscript(msg.tabId, msg.text, msg.start);
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
      getListening().then(async (tabs) => {
        const stopCodes = ["invalid-key", "capture-failed", "quota-exceeded", "not-signed-in", "connection-lost"];
        if (stopCodes.includes(msg.code || "")) {
          delete tabs[msg.tabId];
          await setListening(tabs);
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
    const tabs = await getListening();
    if (tabs[tabId]) {
      chrome.runtime.sendMessage({ type: "avc-offscreen-stop", tabId }).catch(() => {
      });
      delete tabs[tabId];
      await setListening(tabs);
    }
    await setCopilotTab(tabId, false);
  });
})();
