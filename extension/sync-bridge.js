"use strict";
(() => {
  // src/config.ts
  var WEB_URL = "https://animevocab.com";

  // web/src/lib/sync.ts
  function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function asNumber(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }
  function asString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }
  function asWordState(value, base = "word") {
    if (value === void 0 || value === null || value === "new") return "new";
    if (value === "learning" || value === "known" || value === "ignored") return value;
    throw new Error(`Invalid word state for ${base}.`);
  }
  function timeToIso(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return new Date(n).toISOString();
  }
  function isoToTime(value) {
    if (!value) return 0;
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }
  function normalizeIsoString(value) {
    if (typeof value !== "string") return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }
  function asTimestampArray(value) {
    return Array.isArray(value) ? value.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
  }
  var MAX_SOURCE_TITLE = 200;
  var MAX_SOURCE_LINE = 500;
  function clampOrNull(value, max) {
    if (typeof value !== "string") return null;
    const t = value.trim().slice(0, max);
    return t.length ? t : null;
  }
  function asWordSource(value) {
    if (!value || typeof value !== "object") return null;
    const s = value;
    const title = clampOrNull(s.title, MAX_SOURCE_TITLE);
    const line = clampOrNull(s.line, MAX_SOURCE_LINE);
    const en = clampOrNull(s.en, MAX_SOURCE_LINE);
    if (!title && !line && !en) return null;
    return { title, line, en };
  }
  var SECRET_SETTING_KEYS = ["openaiKey", "apiKey"];
  function stripSecretSettings(settings) {
    const out = { ...settings };
    for (const key of SECRET_SETTING_KEYS) delete out[key];
    return out;
  }
  function normalizeAnimeVocabExport(input, now = /* @__PURE__ */ new Date()) {
    const vocab = asRecord(input.vocab);
    const stats = input.stats || {};
    const daily = asRecord(stats.daily);
    return {
      schemaVersion: 1,
      source: "animevocab-extension",
      importedAt: now.toISOString(),
      sourceExportedAt: typeof input.exportedAt === "string" ? input.exportedAt : null,
      settings: stripSecretSettings(asRecord(input.settings)),
      cardTimestamps: asTimestampArray(stats.cardTimestamps),
      words: Object.entries(vocab).map(([base, raw]) => {
        const rec = asRecord(raw);
        const srs = asRecord(rec.srs);
        const hasSrs = rec.srs !== null && Object.keys(srs).length > 0;
        return {
          base,
          state: asWordState(rec.state, base),
          reading: asString(rec.reading),
          gloss: asString(rec.gloss),
          level: Number.isFinite(Number(rec.level)) ? Number(rec.level) : null,
          freqRank: Number.isFinite(Number(rec.freqRank)) ? Number(rec.freqRank) : null,
          seenCount: asNumber(rec.seenCount),
          shownCount: asNumber(rec.shownCount),
          firstSeenAt: timeToIso(rec.firstSeenAt),
          lastSeenAt: timeToIso(rec.lastSeenAt),
          review: hasSrs ? {
            stage: asNumber(srs.stage),
            dueAt: timeToIso(srs.dueAt),
            lapses: asNumber(srs.lapses)
          } : null,
          source: asWordSource(rec.source)
        };
      }).sort((a, b) => a.base.localeCompare(b.base)),
      daily: Object.entries(daily).map(([day, raw]) => {
        const rec = asRecord(raw);
        return {
          day,
          met: asNumber(rec.met),
          judged: asNumber(rec.judged),
          reviews: asNumber(rec.reviews),
          watchMin: asNumber(rec.watchMin)
        };
      }).sort((a, b) => a.day.localeCompare(b.day))
    };
  }
  function normalizeCloudSyncSnapshot(input, now = /* @__PURE__ */ new Date()) {
    const raw = asRecord(input);
    const words = Array.isArray(raw.words) ? raw.words : [];
    const daily = Array.isArray(raw.daily) ? raw.daily : [];
    if (raw.schemaVersion !== 1 || raw.source !== "animevocab-extension") {
      throw new Error("invalid_snapshot");
    }
    return {
      schemaVersion: 1,
      source: "animevocab-extension",
      importedAt: normalizeIsoString(raw.importedAt) ?? now.toISOString(),
      sourceExportedAt: normalizeIsoString(raw.sourceExportedAt),
      settings: stripSecretSettings(asRecord(raw.settings)),
      cardTimestamps: asTimestampArray(raw.cardTimestamps),
      words: words.map((value) => {
        const rec = asRecord(value);
        const review = asRecord(rec.review);
        const hasReview = rec.review !== null && Object.keys(review).length > 0;
        const base = asString(rec.base);
        if (!base) throw new Error("invalid_snapshot");
        return {
          base,
          state: asWordState(rec.state, base),
          reading: asString(rec.reading),
          gloss: asString(rec.gloss),
          level: Number.isFinite(Number(rec.level)) ? Number(rec.level) : null,
          freqRank: Number.isFinite(Number(rec.freqRank)) ? Number(rec.freqRank) : null,
          seenCount: asNumber(rec.seenCount),
          shownCount: asNumber(rec.shownCount),
          firstSeenAt: normalizeIsoString(rec.firstSeenAt),
          lastSeenAt: normalizeIsoString(rec.lastSeenAt),
          review: hasReview ? {
            stage: asNumber(review.stage),
            dueAt: normalizeIsoString(review.dueAt),
            lapses: asNumber(review.lapses)
          } : null,
          source: asWordSource(rec.source)
        };
      }).sort((a, b) => a.base.localeCompare(b.base)),
      daily: daily.map((value) => {
        const rec = asRecord(value);
        const day = asString(rec.day);
        if (!day) throw new Error("invalid_snapshot");
        return {
          day,
          met: asNumber(rec.met),
          judged: asNumber(rec.judged),
          reviews: asNumber(rec.reviews),
          watchMin: asNumber(rec.watchMin)
        };
      }).sort((a, b) => a.day.localeCompare(b.day))
    };
  }
  function cloudSnapshotToAnimeVocabExport(snapshot) {
    const vocab = {};
    const daily = {};
    for (const word of snapshot.words) {
      const rec = {
        state: word.state,
        reading: word.reading,
        gloss: word.gloss,
        level: word.level ?? 0,
        freqRank: word.freqRank ?? 0,
        seenCount: word.seenCount,
        shownCount: word.shownCount,
        firstSeenAt: isoToTime(word.firstSeenAt),
        lastSeenAt: isoToTime(word.lastSeenAt),
        srs: word.review ? {
          stage: word.review.stage,
          dueAt: isoToTime(word.review.dueAt),
          lapses: word.review.lapses
        } : null
      };
      if (word.source) rec.source = word.source;
      vocab[word.base] = rec;
    }
    for (const day of snapshot.daily) {
      daily[day.day] = {
        met: day.met,
        judged: day.judged,
        reviews: day.reviews,
        watchMin: day.watchMin
      };
    }
    return {
      settings: snapshot.settings,
      vocab,
      stats: { daily, cardTimestamps: snapshot.cardTimestamps },
      exportedAt: snapshot.sourceExportedAt ?? snapshot.importedAt
    };
  }

  // src/lib/account-cache.ts
  var ACCOUNT_CACHE_CLEARED = "accountCacheClearedAt";
  var SIGN_OUT_SUPPRESSION_MS = 5 * 60 * 1e3;
  async function restoredAccountCache(token) {
    const before = await chrome.storage.local.get(ACCOUNT_CACHE_CLEARED);
    const clearedAt = before[ACCOUNT_CACHE_CLEARED];
    if (!clearedAt) return {};
    const res = await fetch(WEB_URL + "/api/sync/snapshot", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!res.ok) throw new Error("Could not restore your words. Please try signing in again.");
    const data = await res.json();
    const after = await chrome.storage.local.get(ACCOUNT_CACHE_CLEARED);
    if (after[ACCOUNT_CACHE_CLEARED] !== clearedAt) throw new Error("Account changed while restoring your words.");
    const restored = cloudSnapshotToAnimeVocabExport(data.envelope?.snapshot ? normalizeCloudSyncSnapshot(data.envelope.snapshot) : normalizeAnimeVocabExport({}));
    return {
      vocab: restored.vocab,
      stats: restored.stats,
      settings: restored.settings,
      webReviewSeq: data.envelope?.webReviewSeq || 0,
      [ACCOUNT_CACHE_CLEARED]: null
    };
  }

  // src/entries/sync-bridge.ts
  (function initSyncBridge() {
    const bridgeWindow = window;
    if (bridgeWindow.__avcSyncBridgeLoaded) return;
    bridgeWindow.__avcSyncBridgeLoaded = true;
    const ALLOWED_ORIGINS = /* @__PURE__ */ new Set(["https://animevocab.com", "https://www.animevocab.com"]);
    function pageOrigin() {
      return window.location.origin;
    }
    function isAllowedOrigin(origin) {
      return ALLOWED_ORIGINS.has(origin) || origin === pageOrigin();
    }
    function announceExtension() {
      const origin = pageOrigin();
      window.postMessage({ source: "avc-ext", type: "avc-ext-present" }, origin);
      window.postMessage({ source: "avc-ext", type: "avc-request-token" }, origin);
      try {
        chrome.storage.local.get(["syncToken"], (r) => {
          const linked = typeof r?.syncToken === "string" && r.syncToken.length > 0;
          window.postMessage({ source: "avc-ext", type: "avc-ext-present", linked }, origin);
        });
      } catch {
      }
    }
    window.addEventListener("message", (event) => {
      if (event.source !== window || !isAllowedOrigin(event.origin)) return;
      const data = event.data;
      if (!data || data.source !== "avc-web") return;
      if (data.type === "avc-ping-extension") {
        announceExtension();
        return;
      }
      if (data.type === "avc-signin-surface") {
        chrome.runtime.sendMessage({ type: "avc-signin-surface", surface: data.surface }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-sync-token") {
        const token = typeof data.token === "string" ? data.token : "";
        if (!token) return;
        const p = data.profile;
        const plan = p?.plan;
        const syncProfile = p && typeof p === "object" ? {
          email: typeof p.email === "string" ? p.email : null,
          name: typeof p.name === "string" ? p.name : null,
          plan: plan === "free" || plan === "pro" || plan === "max" ? plan : null
        } : void 0;
        const update = { syncToken: token };
        if (syncProfile !== void 0) update.syncProfile = syncProfile;
        update.relinkNeeded = false;
        update.syncAuthFailures = 0;
        void (async () => {
          if (location.pathname === "/start") {
            await chrome.runtime.sendMessage({ type: "avc-signin-surface", surface: "start_page" }).catch(() => {
            });
          }
          await chrome.storage.local.set({ ...await restoredAccountCache(token), ...update });
          chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {
          });
        })().catch(() => {
        });
        return;
      }
      if (data.type === "avc-n5-course-changed" && ALLOWED_ORIGINS.has(event.origin)) {
        chrome.runtime.sendMessage({ type: "avc-n5-refresh" }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-sync-now") {
        chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-settings-updated") {
        chrome.runtime.sendMessage({ type: "avc-pull-settings" }).catch(() => {
        });
        return;
      }
      if (data.type === "avc-sign-out") {
        chrome.runtime.sendMessage({ type: "avc-sign-out" }).catch(() => {
        });
      }
    });
    announceExtension();
  })();
})();
