"use strict";
(() => {
  // src/lib/log.ts
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

  // src/lib/review-prompt.ts
  var REVIEW_PROMPT_SNOOZE_MS = 14 * 24 * 36e5;

  // src/config.ts
  var WEB_URL = "https://animevocab.com";
  var CWS_EXTENSION_ID = "lkjbomofgfonjjbemobacegffepbdnel";

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

  // src/lib/net.ts
  var TIMEOUT_MS = {
    /** Small JSON round trips: sync, usage, beacons, captions. */
    quick: 15e3,
    /** A model call behind our API (word pick, coach, extraction, TTS). */
    ai: 45e3,
    /** An audio chunk upload that the server transcribes before answering. */
    upload: 3e4
  };
  function timeout(kind) {
    return AbortSignal.timeout(TIMEOUT_MS[kind]);
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
        keepalive: true,
        signal: timeout("quick")
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
  async function postTrack(body) {
    const token = await syncToken();
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = "Bearer " + token;
    void fetch(TRACK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, v: extensionVersion() }),
      keepalive: true,
      signal: timeout("quick")
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

  // src/lib/backup.ts
  var BACKUP_MAX_BYTES = 20 * 1024 * 1024;
  var MAX_CARD_TIMESTAMPS = 1e4;
  var STATES = ["new", "learning", "known", "ignored"];
  var num = (v) => typeof v === "number" && Number.isFinite(v);
  var str = (v) => typeof v === "string";
  function readRecord(raw) {
    const r = raw;
    if (!r || typeof r !== "object") return null;
    if (!STATES.includes(r.state) || !str(r.reading) || !str(r.gloss)) return null;
    if (![r.level, r.freqRank, r.seenCount, r.shownCount, r.firstSeenAt, r.lastSeenAt].every(num)) return null;
    let srs = null;
    if (r.srs != null) {
      const s = r.srs;
      if (!num(s.stage) || s.stage < 1 || s.stage > 5 || !num(s.dueAt) || !num(s.lapses)) return null;
      srs = { stage: s.stage, dueAt: s.dueAt, lapses: s.lapses };
    }
    const source = r.source && typeof r.source === "object" ? { title: str(r.source.title) ? r.source.title : null, line: str(r.source.line) ? r.source.line : null, en: str(r.source.en) ? r.source.en : null } : null;
    return {
      state: r.state,
      reading: r.reading,
      gloss: r.gloss,
      level: r.level,
      freqRank: r.freqRank,
      seenCount: r.seenCount,
      shownCount: r.shownCount,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
      srs,
      ...source ? { source } : {}
    };
  }
  function readDaily(raw) {
    const d = raw;
    if (!d || typeof d !== "object") return null;
    const n = (v) => num(v) && v >= 0 ? v : 0;
    return { met: n(d.met), judged: n(d.judged), reviews: n(d.reviews), watchMin: n(d.watchMin) };
  }
  function parseBackup(json) {
    const data = json;
    if (!data || typeof data !== "object" || !data.vocab || typeof data.vocab !== "object") {
      return { ok: false, error: "This isn't an AnimeVocab backup (no word list in it)." };
    }
    const vocab = {};
    let skipped = 0;
    for (const [base, raw] of Object.entries(data.vocab)) {
      const rec = base && base.length <= 64 ? readRecord(raw) : null;
      if (rec) vocab[base] = rec;
      else skipped++;
    }
    const rawStats = data.stats || {};
    const daily = {};
    if (rawStats.daily && typeof rawStats.daily === "object") {
      for (const [day, raw] of Object.entries(rawStats.daily)) {
        const d = /^\d{4}-\d{2}-\d{2}$/.test(day) ? readDaily(raw) : null;
        if (d) daily[day] = d;
      }
    }
    const cardTimestamps = Array.isArray(rawStats.cardTimestamps) ? rawStats.cardTimestamps.filter(num) : [];
    return { ok: true, backup: { vocab, stats: { daily, cardTimestamps } }, skipped };
  }
  function mergeRecord(mine, theirs) {
    const winner = theirs.lastSeenAt > mine.lastSeenAt ? theirs : mine;
    return {
      ...winner,
      firstSeenAt: Math.min(mine.firstSeenAt, theirs.firstSeenAt),
      seenCount: Math.max(mine.seenCount, theirs.seenCount),
      shownCount: Math.max(mine.shownCount, theirs.shownCount)
    };
  }
  function mergeBackup(current, incoming) {
    const vocab = { ...current.vocab };
    let added = 0;
    let updated = 0;
    for (const [base, rec] of Object.entries(incoming.vocab)) {
      const mine = vocab[base];
      if (!mine) {
        vocab[base] = rec;
        added++;
        continue;
      }
      const next = mergeRecord(mine, rec);
      if (JSON.stringify(next) !== JSON.stringify(mine)) updated++;
      vocab[base] = next;
    }
    const daily = { ...current.stats.daily || {} };
    for (const [day, d] of Object.entries(incoming.stats.daily)) {
      const e = daily[day];
      daily[day] = e ? { met: Math.max(e.met, d.met), judged: Math.max(e.judged, d.judged), reviews: Math.max(e.reviews, d.reviews), watchMin: Math.max(e.watchMin, d.watchMin) } : d;
    }
    const stamps = [.../* @__PURE__ */ new Set([...current.stats.cardTimestamps || [], ...incoming.stats.cardTimestamps])].sort((a, b) => a - b);
    return {
      merged: { vocab, stats: { daily, cardTimestamps: stamps.slice(-MAX_CARD_TIMESTAMPS) } },
      added,
      updated
    };
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
  function pruneTimestamps(timestamps) {
    const cutoff = Date.now() - 36e5;
    return (timestamps || []).filter((t) => t >= cutoff);
  }
  function emptyStats() {
    return { daily: {}, cardTimestamps: [] };
  }
  function sendBadge(stats) {
    const day = todayKey();
    const judged = stats.daily?.[day]?.judged || 0;
    if (inServiceWorker() && typeof chrome.action?.setBadgeText === "function") {
      void chrome.action.setBadgeText({ text: judged > 0 ? String(judged) : "" });
      void chrome.action.setBadgeBackgroundColor({ color: "#c4553a" });
      return;
    }
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
  function localSetSettings(partial) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["settings"]);
      const settings = { ...withDefaults(r.settings || {}), ...partial };
      await chrome.storage.local.set({ settings });
      return settings;
    });
  }
  function localSetWordState(base, state) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab"]);
      const vocab = r.vocab || {};
      if (!vocab[base]) return;
      vocab[base].state = state;
      if (state === "learning") {
        vocab[base].srs = { stage: 1, dueAt: Date.now() + SRS_INTERVALS[1], lapses: 0 };
      } else {
        vocab[base].srs = null;
      }
      await chrome.storage.local.set({ vocab });
    });
  }
  function localRecordSeen(words) {
    return enqueue2(async () => {
      if (!words.length) return;
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const vocab = { ...r.vocab || {} };
      const stats = r.stats || emptyStats();
      const daily = ensureDaily(stats, todayKey());
      for (const w of words) {
        if (!vocab[w.base]) {
          vocab[w.base] = {
            state: "new",
            reading: w.reading,
            gloss: w.gloss,
            level: w.level,
            freqRank: w.freqRank,
            seenCount: 1,
            shownCount: 0,
            firstSeenAt: Date.now(),
            lastSeenAt: Date.now(),
            srs: null
          };
          daily.met += 1;
        } else {
          vocab[w.base].seenCount += 1;
          vocab[w.base].lastSeenAt = Date.now();
        }
      }
      await chrome.storage.local.set({ vocab, stats });
      void stampOnboarding("watchedAt");
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
  function localApplyWebReviews(ops) {
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
  function localJudgeWord(base, judgment, meta, source) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const vocab = r.vocab || {};
      const stats = r.stats || emptyStats();
      const day = todayKey();
      const daily = ensureDaily(stats, day);
      const now = Date.now();
      if (!vocab[base]) {
        vocab[base] = {
          state: "new",
          reading: meta.reading,
          gloss: meta.gloss,
          level: meta.level,
          freqRank: meta.freqRank,
          seenCount: 1,
          shownCount: 0,
          firstSeenAt: now,
          lastSeenAt: now,
          srs: null
        };
      }
      const rec = vocab[base];
      const wasCollected = rec.state === "known" || rec.state === "learning";
      if (meta) {
        rec.reading = meta.reading;
        rec.gloss = meta.gloss;
        rec.level = meta.level;
        rec.freqRank = meta.freqRank;
      }
      if (source && !rec.source && (source.title || source.line)) {
        rec.source = source;
      }
      if (judgment === "know") {
        rec.state = "known";
        rec.srs = null;
      } else if (judgment === "learn") {
        rec.state = "learning";
        rec.srs = { stage: 1, dueAt: now + SRS_INTERVALS[1], lapses: 0 };
      } else if (judgment === "ignore") {
        rec.state = "ignored";
        rec.srs = null;
      } else if (judgment === "review-pass" || judgment === "review-fail") {
        applyReviewResult(rec, judgment === "review-pass", now);
        daily.reviews += 1;
      }
      if (judgment !== "dismiss") {
        daily.judged += 1;
      }
      await chrome.storage.local.set({ vocab, stats });
      if (judgment === "review-pass" || judgment === "review-fail") {
        await trackExtensionMilestone("first_srs_review");
      }
      if (judgment === "know" || judgment === "learn") {
        void stampOnboarding("firstCardAt");
      }
      if (judgment === "know") void trackFeature("card_known");
      if (judgment === "learn") void trackFeature("card_learn");
      if (!wasCollected && (judgment === "know" || judgment === "learn")) {
        void trackFeature("word_saved");
      }
      if (judgment === "review-pass" || judgment === "review-fail") {
        void trackFeature("review_done");
      }
      sendBadge(stats);
      return vocab[base];
    });
  }
  function localImportBackup(incoming) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const current = {
        vocab: r.vocab || {},
        stats: r.stats || emptyStats()
      };
      const { merged, added, updated } = mergeBackup(current, incoming);
      await chrome.storage.local.set({ vocab: merged.vocab, stats: merged.stats });
      sendBadge(merged.stats);
      return { added, updated };
    });
  }
  function localUndoJudgment(undo) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const vocab = r.vocab || {};
      const stats = r.stats || emptyStats();
      if (undo.previous) vocab[undo.base] = undo.previous;
      else delete vocab[undo.base];
      const daily = stats.daily?.[undo.day];
      if (daily && undo.judgment !== "dismiss") {
        daily.judged = Math.max(0, (daily.judged || 0) - 1);
        if (undo.judgment === "review-pass" || undo.judgment === "review-fail") {
          daily.reviews = Math.max(0, (daily.reviews || 0) - 1);
        }
      }
      await chrome.storage.local.set({ vocab, stats });
      sendBadge(stats);
    });
  }
  function localRecordCardShown(base) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const vocab = r.vocab || {};
      const stats = r.stats || emptyStats();
      const now = Date.now();
      stats.cardTimestamps = pruneTimestamps(stats.cardTimestamps);
      stats.cardTimestamps.push(now);
      if (vocab[base]) {
        vocab[base].shownCount = (vocab[base].shownCount || 0) + 1;
      }
      await chrome.storage.local.set({ vocab, stats });
      await trackExtensionMilestone("first_card_created");
      void stampOnboarding("cardShownAt");
      void trackFeature("card_shown");
    });
  }
  function localRecordWatchTick() {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["stats"]);
      const stats = r.stats || emptyStats();
      const day = todayKey();
      const daily = ensureDaily(stats, day);
      daily.watchMin += 1;
      await chrome.storage.local.set({ stats });
    });
  }
  async function exportForBackup() {
    const data = await exportAll();
    const settings = { ...data.settings };
    delete settings.openaiKey;
    return { ...data, settings };
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
  function localResetProgress() {
    return enqueue2(async () => {
      await chrome.storage.local.set({ vocab: {}, stats: emptyStats() });
      sendBadge({ daily: {} });
    });
  }
  var STORAGE_WRITE_MESSAGE = "avc-storage-write";
  var writers = {
    setSettings: localSetSettings,
    setWordState: localSetWordState,
    recordSeen: localRecordSeen,
    applyWebReviews: localApplyWebReviews,
    judgeWord: localJudgeWord,
    recordCardShown: localRecordCardShown,
    recordWatchTick: localRecordWatchTick,
    resetProgress: localResetProgress,
    undoJudgment: localUndoJudgment,
    importBackup: localImportBackup
  };
  async function write(op, ...args) {
    const run = () => writers[op](...args);
    if (inServiceWorker()) return run();
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: STORAGE_WRITE_MESSAGE, op, args });
    } catch {
      res = void 0;
    }
    if (res?.ok === true) return res.value;
    if (res?.ok === false) throw new Error(res.error || `storage write ${op} failed`);
    warn(`storage write ${op} ran in this context (no service worker answer)`);
    return run();
  }
  function setSettings(partial) {
    return write("setSettings", partial);
  }
  function importBackup(backup) {
    return write("importBackup", backup);
  }
  function resetProgress() {
    return write("resetProgress");
  }

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
    byId("learningDirection").value = s.learningDirection || "en-ja";
    byId("autoSpeak").checked = s.autoSpeak !== false;
    byId("subLens").checked = s.subLens !== false;
    byId("subLensPeek").checked = s.subLensPeek !== false;
    byId("openaiKey").value = s.openaiKey || "";
    byId("transcribeModel").value = s.transcribeModel || "gpt-4o-mini-transcribe";
  }
  async function savePartial(partial) {
    await setSettings(partial);
    showSaved();
  }
  function maybeShowJaEnBanner() {
    if (!isJapaneseUiLocale()) return;
    try {
      if (localStorage.getItem("av-ja-en-prompt-dismissed") === "1") return;
    } catch {
    }
    void getSettings().then((s) => {
      if (s.learningDirection === "ja-en") return;
      const banner = document.createElement("div");
      banner.className = "av-ja-en-banner";
      banner.innerHTML = '<p><strong>\u65E5\u672C\u8A9E \u2192 English \u3067\u5B66\u3079\u307E\u3059\u3002</strong> \u30A2\u30CB\u30E1\u306E\u82F1\u8A9E\u304B\u3089\u5358\u8A9E\u3092\u899A\u3048\u3001\u89E3\u8AAC\u306F\u65E5\u672C\u8A9E\u3067\u3059\u3002</p><div class="av-ja-en-banner__actions"><button type="button" class="av-btn av-btn-primary" id="ja-en-apply">\u65E5\u672C\u8A9E \u2192 English \u306B\u5207\u308A\u66FF\u3048</button><button type="button" class="av-btn av-btn-ghost" id="ja-en-dismiss">\u9589\u3058\u308B</button></div>';
      const shell = document.querySelector(".shell");
      shell?.insertBefore(banner, shell.querySelector(".av-sub"));
      banner.querySelector("#ja-en-apply")?.addEventListener("click", () => {
        void savePartial({ learningDirection: "ja-en" }).then(() => {
          byId("learningDirection").value = "ja-en";
          banner.remove();
        });
      });
      banner.querySelector("#ja-en-dismiss")?.addEventListener("click", () => {
        try {
          localStorage.setItem("av-ja-en-prompt-dismissed", "1");
        } catch {
        }
        banner.remove();
      });
    });
  }
  document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    await loadSettingsForm();
    maybeShowJaEnBanner();
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
    byId("learningDirection").addEventListener("change", (e) => {
      savePartial({ learningDirection: e.target.value });
    });
    byId("displayScript").addEventListener("change", (e) => {
      savePartial({ displayScript: e.target.value });
    });
    byId("subLens").addEventListener("change", (e) => {
      savePartial({ subLens: e.target.checked });
    });
    byId("subLensPeek").addEventListener("change", (e) => {
      savePartial({ subLensPeek: e.target.checked });
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
      const data = await exportForBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animevocab-export-${todayKey2()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    const status = byId("backup-status");
    const fileInput = byId("import-file");
    byId("import-btn").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      if (file.size > BACKUP_MAX_BYTES) {
        status.textContent = "That file is too large to be an AnimeVocab backup.";
        return;
      }
      let parsed;
      try {
        parsed = parseBackup(JSON.parse(await file.text()));
      } catch {
        parsed = { ok: false, error: "That file isn't valid JSON." };
      }
      if (!parsed.ok) {
        status.textContent = parsed.error;
        return;
      }
      const n = Object.keys(parsed.backup.vocab).length;
      if (!confirm(`Merge ${n} word${n === 1 ? "" : "s"} from this backup? Nothing in this browser is deleted; where both have a word, the more recently seen copy is kept.`)) return;
      try {
        const { added, updated } = await importBackup(parsed.backup);
        status.textContent = `Imported: ${added} new word${added === 1 ? "" : "s"}, ${updated} updated` + (parsed.skipped ? `, ${parsed.skipped} unreadable entr${parsed.skipped === 1 ? "y" : "ies"} skipped.` : ".");
      } catch (err) {
        status.textContent = "Import failed: " + (err instanceof Error ? err.message : String(err));
      }
    });
    byId("reset-btn").addEventListener("click", async () => {
      if (!confirm("Reset all vocab and stats? Settings will be kept.")) return;
      await resetProgress();
    });
  });
})();
