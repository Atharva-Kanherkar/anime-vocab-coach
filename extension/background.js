"use strict";
(() => {
  // web/src/lib/learn-protocol/model.ts
  var emptyLearnState = () => ({
    words: {},
    daily: {},
    settings: {},
    notebooks: {}
  });
  var newLearnOp = (kind, payload, op_id = crypto.randomUUID(), client_ts = (/* @__PURE__ */ new Date()).toISOString()) => ({ op_id, kind, payload, client_ts });
  var intervals = [
    0,
    4 * 36e5,
    24 * 36e5,
    3 * 864e5,
    7 * 864e5,
    21 * 864e5
  ];
  function projectLearnOp(state, op) {
    const p = op.payload;
    const at = Date.parse(op.client_ts);
    const delta = {};
    if (op.kind === "word" || op.kind === "import_local") {
      const incoming = p.word;
      if (incoming) {
        const current = state.words[incoming.base];
        let word = structuredClone(incoming);
        if (op.kind === "import_local" && current) word = current;
        else if (current && p.intent === "seen") {
          word = {
            ...current,
            seenCount: current.seenCount + Number(p.seenDelta || 0),
            shownCount: current.shownCount + Number(p.shownDelta || 0),
            lastSeenAt: incoming.lastSeenAt
          };
        } else if (current && p.intent === "save" && incoming.state === "learning" && current.state === "learning") {
          word = { ...incoming, review: current.review };
        }
        state.words[incoming.base] = word;
        delta.words = { [incoming.base]: word };
      }
      if (op.kind === "import_local") {
        const daily = p.daily;
        if (daily && !state.daily[daily.day]) {
          state.daily[daily.day] = structuredClone(daily);
          delta.daily = { [daily.day]: state.daily[daily.day] };
        }
        if (p.settings) {
          const settings = Object.fromEntries(
            Object.entries(p.settings).filter(
              ([k]) => !(k in state.settings)
            )
          );
          Object.assign(state.settings, settings);
          delta.settings = settings;
        }
      }
    } else if (op.kind === "review_history") {
    } else if (op.kind === "review") {
      const base = p.base;
      const current = state.words[base];
      if (!current) throw new Error("word_not_found");
      const word = structuredClone(current);
      if (word.state === "learning" && word.review) {
        const stage = p.result === "pass" ? word.review.stage + 1 : 1;
        if (stage >= intervals.length) {
          word.state = "known";
          word.review = null;
        } else
          word.review = {
            stage,
            dueAt: new Date(at + intervals[stage]).toISOString(),
            lapses: word.review.lapses + (p.result === "fail" ? 1 : 0)
          };
      }
      word.lastSeenAt = op.client_ts;
      state.words[base] = word;
      delta.words = { [base]: word };
      delta.daily = bumpProgress(state, p.day, {
        reviews: 1,
        judged: 1
      });
    } else if (op.kind === "settings") {
      Object.assign(state.settings, p.settings);
      delta.settings = structuredClone(p.settings);
    } else if (op.kind === "progress") {
      delta.daily = bumpProgress(
        state,
        p.day,
        p.delta
      );
    } else if (op.kind === "notebook") {
      const notebook = p.notebook;
      if (!state.notebooks[notebook.id] && Object.keys(state.notebooks).length >= 100)
        throw new Error("too_many_notebooks");
      const next = {
        ...structuredClone(notebook),
        updatedAt: op.client_ts,
        entries: state.notebooks[notebook.id]?.entries || []
      };
      state.notebooks[next.id] = next;
      delta.notebooks = { [next.id]: { ...next, entries: [] } };
    } else if (op.kind === "notebook_delete") {
      delete state.notebooks[p.id];
      delta.notebooks = { [p.id]: null };
    } else {
      const id = p.id;
      const notebook = state.notebooks[id];
      if (!notebook) throw new Error("notebook_not_found");
      if (op.kind === "notebook_item") {
        const entry = p.entry;
        if (!notebook.entries.some((e) => e.id === entry.id) && notebook.entries.length >= 2e3)
          throw new Error("notebook_full");
        notebook.entries = [
          structuredClone(entry),
          ...notebook.entries.filter((e) => e.id !== entry.id)
        ];
        delta.entries = [{ notebookId: id, entry: structuredClone(entry) }];
      } else {
        notebook.entries = notebook.entries.filter((e) => e.id !== p.entryId);
        delta.entries = [{ notebookId: id, removed: p.entryId }];
      }
      notebook.updatedAt = op.client_ts;
      delta.notebooks = { [id]: { ...structuredClone(notebook), entries: [] } };
    }
    return delta;
  }
  function bumpProgress(state, day, values) {
    const row = state.daily[day] || {
      day,
      met: 0,
      judged: 0,
      reviews: 0,
      watchMin: 0
    };
    for (const key of ["met", "judged", "reviews", "watchMin"])
      row[key] += values[key] || 0;
    state.daily[day] = row;
    return { [day]: { ...row } };
  }
  function applyLearnDelta(state, delta) {
    Object.assign(state.words, delta.words);
    Object.assign(state.daily, delta.daily);
    Object.assign(state.settings, delta.settings);
    for (const [id, nb] of Object.entries(delta.notebooks || {})) {
      if (nb) state.notebooks[id] = { ...nb, entries: state.notebooks[id]?.entries || [] };
      else delete state.notebooks[id];
    }
    for (const change of delta.entries || []) {
      const notebook = state.notebooks[change.notebookId];
      if (!notebook) continue;
      const id = change.entry?.id ?? change.removed;
      notebook.entries = notebook.entries.filter((e) => e.id !== id);
      if (change.entry) notebook.entries.unshift(change.entry);
    }
  }

  // web/src/lib/learn-protocol/validate.ts
  var object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  var plain = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
  var text = (v, max = 200) => plain(v, max) && !["__proto__", "constructor", "prototype"].includes(v);
  var num = (v, max = 1e9) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
  var PUBLIC_SETTINGS = {
    pauseMode: (v) => ["copilot", "pause", "off"].includes(v),
    cooldownSec: (v) => num(v, 120),
    maxCardsPerHour: (v) => num(v, 60),
    targetLevel: (v) => num(v, 5) && Number(v) >= 1,
    autoResumeSec: (v) => num(v, 120),
    displayScript: (v) => ["romaji", "kana", "kanji", "romaji-kana"].includes(v),
    learningDirection: (v) => ["en-ja", "ja-en"].includes(v),
    autoSpeak: (v) => typeof v === "boolean",
    subLens: (v) => typeof v === "boolean",
    subLensPeek: (v) => typeof v === "boolean",
    transcribeModel: (v) => text(v, 100),
    sites: (v) => object(v) && Object.keys(v).every(
      (k) => ["youtube", "netflix", "generic"].includes(k)
    ) && ["youtube", "netflix", "generic"].every((k) => typeof v[k] === "boolean")
  };
  function publicSettings(raw) {
    return Object.fromEntries(
      Object.entries(raw).filter(
        ([k, v]) => Object.prototype.hasOwnProperty.call(PUBLIC_SETTINGS, k) && PUBLIC_SETTINGS[k](v)
      )
    );
  }

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

  // src/lib/learn-cache.ts
  var LEARN_KEYS = [
    "learnOutbox",
    "learnOwner",
    "learnOwnerToken",
    "learnCursor",
    "learnRemote",
    "learnInitialized",
    "learnLegacy",
    "learnEpoch",
    "syncToken",
    "vocab",
    "stats",
    "settings"
  ];
  function localImportOps(raw) {
    const snapshot = normalizeAnimeVocabExport(raw);
    return [
      ...snapshot.words.map((word) => newLearnOp("import_local", { word })),
      ...snapshot.daily.map((daily) => newLearnOp("import_local", { daily })),
      newLearnOp("import_local", { settings: publicSettings(snapshot.settings) })
    ];
  }
  async function learningPatch(before, patch, intent = "seen", review) {
    const stored = await chrome.storage.local.get(LEARN_KEYS);
    const next = normalizeAnimeVocabExport({ ...before, ...patch });
    const previous = normalizeAnimeVocabExport(before);
    const ops = [];
    if (patch.settings) {
      const changed = Object.fromEntries(
        Object.entries(publicSettings(patch.settings)).filter(
          ([k, v]) => JSON.stringify(v) !== JSON.stringify(previous.settings[k])
        )
      );
      if (Object.keys(changed).length)
        ops.push(newLearnOp("settings", { settings: changed }));
    }
    if (patch.vocab) {
      const prior = new Map(previous.words.map((w) => [w.base, w]));
      for (const word of next.words) {
        const old = prior.get(word.base);
        if (JSON.stringify(word) === JSON.stringify(old)) continue;
        if (review?.base === word.base && old) continue;
        ops.push(
          newLearnOp("word", {
            word,
            intent,
            seenDelta: Math.max(0, word.seenCount - (old?.seenCount || 0)),
            shownDelta: Math.max(0, word.shownCount - (old?.shownCount || 0))
          })
        );
      }
    }
    if (review) ops.push(newLearnOp("review", review));
    if (patch.stats) {
      const prior = new Map(previous.daily.map((d) => [d.day, d]));
      for (const row of next.daily) {
        const old = prior.get(row.day);
        const delta = {};
        for (const key of ["met", "judged", "reviews", "watchMin"]) {
          const n = row[key] - (old?.[key] || 0) - (review && review.day === row.day && (key === "judged" || key === "reviews") ? 1 : 0);
          if (n > 0) delta[key] = n;
        }
        if (Object.keys(delta).length)
          ops.push(newLearnOp("progress", { day: row.day, delta }));
      }
    }
    const pending = stored.learnOutbox || [];
    const token = String(stored.learnOwnerToken || stored.syncToken || "");
    const ownerId = typeof stored.learnOwner === "string" ? stored.learnOwner : null;
    const result = {
      ...patch,
      learnOutbox: [...pending, ...ops.map((op) => ({ token, ownerId, op }))]
    };
    if (!stored.learnInitialized && !stored.learnLegacy)
      result.learnLegacy = structuredClone({
        vocab: before.vocab ?? stored.vocab,
        stats: before.stats ?? stored.stats,
        settings: before.settings ?? stored.settings
      });
    return result;
  }
  function cacheFromState(remote, pending, token, deviceSettings) {
    const view = structuredClone(remote);
    for (const item of pending.filter((p) => p.token === token)) {
      try {
        projectLearnOp(view, item.op);
      } catch {
      }
    }
    const data2 = cloudSnapshotToAnimeVocabExport({
      ...normalizeAnimeVocabExport({}),
      words: Object.values(view.words),
      daily: Object.values(view.daily),
      settings: view.settings
    });
    return {
      vocab: data2.vocab,
      stats: data2.stats,
      settings: { ...deviceSettings, ...data2.settings }
    };
  }
  function mergeLearnChanges(remote, pending, token, changes) {
    const state = structuredClone(remote || emptyLearnState());
    for (const change of changes) applyLearnDelta(state, change.delta);
    const seen = new Set(changes.map((c) => c.op_id));
    return {
      state,
      pending: pending.filter((p) => p.token !== token || !seen.has(p.op.op_id))
    };
  }

  // src/lib/log.ts
  var log = (...args) => console.log("[AVC]", ...args);
  var warn = (...args) => console.warn("[AVC]", ...args);

  // src/config.ts
  var BACKEND_URL = "https://api.animevocab.com";
  var WEB_URL = "https://animevocab.com";
  var CWS_EXTENSION_ID = "lkjbomofgfonjjbemobacegffepbdnel";

  // src/lib/account-cache.ts
  var ACCOUNT_CACHE_CLEARED = "accountCacheClearedAt";
  var SIGN_OUT_SUPPRESSION_MS = 5 * 60 * 1e3;

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

  // src/lib/dictionary.ts
  var data = null;
  function lookup(base) {
    if (!data) return null;
    const entry = data[base];
    if (!entry) return null;
    return {
      reading: entry.r,
      glosses: entry.g,
      level: entry.l,
      freqRank: entry.f
    };
  }

  // src/lib/priority-words.ts
  var ESSENTIAL_WORDS = {
    \u3042\u308A\u304C\u3068\u3046: { boost: 0.38, jlpt: "N5" },
    \u3069\u3046\u3082: { boost: 0.28, jlpt: "N5" },
    \u3059\u307F\u307E\u305B\u3093: { boost: 0.36, jlpt: "N5" },
    \u3054\u3081\u3093: { boost: 0.3, jlpt: "N5" },
    \u3054\u3081\u3093\u306A\u3055\u3044: { boost: 0.34, jlpt: "N5" },
    \u304A\u9858\u3044: { boost: 0.34, jlpt: "N5" },
    \u304A\u9858\u3044\u3057\u307E\u3059: { boost: 0.4, jlpt: "N5" },
    \u304F\u3060\u3055\u3044: { boost: 0.32, jlpt: "N5" },
    \u304A\u306F\u3088\u3046: { boost: 0.3, jlpt: "N5" },
    \u3053\u3093\u306B\u3061\u306F: { boost: 0.3, jlpt: "N5" },
    \u3053\u3093\u3070\u3093\u306F: { boost: 0.28, jlpt: "N5" },
    \u3055\u3088\u3046\u306A\u3089: { boost: 0.26, jlpt: "N5" },
    \u3058\u3083\u3042\u306D: { boost: 0.24, jlpt: "N5" },
    \u304A\u3084\u3059\u307F: { boost: 0.28, jlpt: "N5" },
    \u306F\u3044: { boost: 0.22, jlpt: "N5" },
    \u3044\u3044\u3048: { boost: 0.22, jlpt: "N5" },
    \u5927\u4E08\u592B: { boost: 0.32, jlpt: "N5" },
    \u5206\u304B\u308B: { boost: 0.3, jlpt: "N5" },
    \u5206\u304B\u3089\u306A\u3044: { boost: 0.3, jlpt: "N5" },
    \u597D\u304D: { boost: 0.28, jlpt: "N5" },
    \u5ACC\u3044: { boost: 0.24, jlpt: "N5" },
    \u6B32\u3057\u3044: { boost: 0.28, jlpt: "N5" },
    \u884C\u304F: { boost: 0.26, jlpt: "N5" },
    \u6765\u308B: { boost: 0.26, jlpt: "N5" },
    \u898B\u308B: { boost: 0.24, jlpt: "N5" },
    \u805E\u304F: { boost: 0.26, jlpt: "N5" },
    \u8A00\u3046: { boost: 0.26, jlpt: "N5" },
    \u98DF\u3079\u308B: { boost: 0.28, jlpt: "N5" },
    \u98F2\u3080: { boost: 0.26, jlpt: "N5" },
    \u52C9\u5F37: { boost: 0.24, jlpt: "N5" },
    \u5B66\u6821: { boost: 0.24, jlpt: "N5" },
    \u5148\u751F: { boost: 0.26, jlpt: "N5" },
    \u53CB\u9054: { boost: 0.26, jlpt: "N5" },
    \u540D\u524D: { boost: 0.24, jlpt: "N5" },
    \u672C\u5F53: { boost: 0.28, jlpt: "N5" },
    \u30DE\u30B8: { boost: 0.22, jlpt: "N5" },
    \u3084\u3070\u3044: { boost: 0.24, jlpt: "N5" },
    \u9811\u5F35\u308B: { boost: 0.28, jlpt: "N5" },
    \u5F85\u3064: { boost: 0.24, jlpt: "N4" },
    \u601D\u3046: { boost: 0.24, jlpt: "N4" },
    \u77E5\u308B: { boost: 0.26, jlpt: "N5" },
    \u4F1A\u3046: { boost: 0.24, jlpt: "N5" }
  };
  function isEssentialWord(base) {
    return base in ESSENTIAL_WORDS;
  }

  // src/lib/english-essentials.ts
  var ENGLISH_ESSENTIALS = {
    please: { gloss: "\u304A\u9858\u3044\u3057\u307E\u3059\uFF0F\u3069\u3046\u305E", level: 5 },
    thanks: { gloss: "\u3042\u308A\u304C\u3068\u3046", level: 5 },
    thank: { gloss: "\u611F\u8B1D\u3059\u308B", level: 5 },
    sorry: { gloss: "\u3054\u3081\u3093\uFF0F\u3059\u307F\u307E\u305B\u3093", level: 5 },
    hello: { gloss: "\u3053\u3093\u306B\u3061\u306F", level: 5 },
    goodbye: { gloss: "\u3055\u3088\u3046\u306A\u3089", level: 5 },
    love: { gloss: "\u611B\u3059\u308B\uFF0F\u5927\u597D\u304D", level: 5 },
    like: { gloss: "\u597D\u304D\uFF0F\u301C\u307F\u305F\u3044", level: 5 },
    want: { gloss: "\u6B32\u3057\u3044\uFF0F\u3057\u305F\u3044", level: 5 },
    need: { gloss: "\u5FC5\u8981\u3060", level: 5 },
    know: { gloss: "\u77E5\u3063\u3066\u3044\u308B", level: 5 },
    think: { gloss: "\u601D\u3046", level: 5 },
    feel: { gloss: "\u611F\u3058\u308B", level: 5 },
    come: { gloss: "\u6765\u308B", level: 5 },
    go: { gloss: "\u884C\u304F", level: 5 },
    see: { gloss: "\u898B\u308B", level: 5 },
    look: { gloss: "\u898B\u308B\uFF0F\u69D8\u5B50", level: 5 },
    hear: { gloss: "\u805E\u304F", level: 5 },
    listen: { gloss: "\u8033\u3092\u50BE\u3051\u308B", level: 5 },
    speak: { gloss: "\u8A71\u3059", level: 5 },
    talk: { gloss: "\u8A71\u3059", level: 5 },
    say: { gloss: "\u8A00\u3046", level: 5 },
    tell: { gloss: "\u4F1D\u3048\u308B", level: 5 },
    ask: { gloss: "\u5C0B\u306D\u308B", level: 5 },
    give: { gloss: "\u4E0E\u3048\u308B", level: 5 },
    take: { gloss: "\u53D6\u308B", level: 5 },
    make: { gloss: "\u4F5C\u308B", level: 5 },
    get: { gloss: "\u5F97\u308B\uFF0F\u306A\u308B", level: 5 },
    find: { gloss: "\u898B\u3064\u3051\u308B", level: 5 },
    help: { gloss: "\u52A9\u3051\u308B", level: 5 },
    wait: { gloss: "\u5F85\u3064", level: 5 },
    stop: { gloss: "\u6B62\u3081\u308B", level: 5 },
    start: { gloss: "\u59CB\u3081\u308B", level: 5 },
    leave: { gloss: "\u53BB\u308B", level: 5 },
    stay: { gloss: "\u6B8B\u308B\uFF0F\u6CCA\u307E\u308B", level: 5 },
    open: { gloss: "\u958B\u3051\u308B\uFF0F\u958B\u3044\u305F", level: 5 },
    close: { gloss: "\u9589\u3081\u308B\uFF0F\u8FD1\u3044", level: 4 },
    friend: { gloss: "\u53CB\u9054", level: 5 },
    family: { gloss: "\u5BB6\u65CF", level: 5 },
    school: { gloss: "\u5B66\u6821", level: 5 },
    home: { gloss: "\u5BB6", level: 5 },
    house: { gloss: "\u5BB6\uFF0F\u4F4F\u5B85", level: 5 },
    world: { gloss: "\u4E16\u754C", level: 5 },
    life: { gloss: "\u4EBA\u751F\uFF0F\u751F\u6D3B", level: 5 },
    time: { gloss: "\u6642\u9593", level: 5 },
    day: { gloss: "\u65E5\uFF0F\u663C\u9593", level: 5 },
    night: { gloss: "\u591C", level: 5 },
    morning: { gloss: "\u671D", level: 5 },
    today: { gloss: "\u4ECA\u65E5", level: 5 },
    tomorrow: { gloss: "\u660E\u65E5", level: 5 },
    yesterday: { gloss: "\u6628\u65E5", level: 5 },
    people: { gloss: "\u4EBA\u3005", level: 5 },
    person: { gloss: "\u4EBA", level: 5 },
    man: { gloss: "\u7537\uFF0F\u4EBA", level: 5 },
    woman: { gloss: "\u5973", level: 5 },
    child: { gloss: "\u5B50\u4F9B", level: 5 },
    kid: { gloss: "\u5B50\u4F9B", level: 5 },
    boy: { gloss: "\u5C11\u5E74", level: 5 },
    girl: { gloss: "\u5C11\u5973", level: 5 },
    heart: { gloss: "\u5FC3\uFF0F\u5FC3\u81D3", level: 4 },
    dream: { gloss: "\u5922", level: 4 },
    power: { gloss: "\u529B", level: 4 },
    fight: { gloss: "\u6226\u3046\uFF0F\u55A7\u5629", level: 4 },
    battle: { gloss: "\u6226\u3044", level: 4 },
    enemy: { gloss: "\u6575", level: 4 },
    danger: { gloss: "\u5371\u967A", level: 4 },
    safe: { gloss: "\u5B89\u5168\u306A", level: 4 },
    truth: { gloss: "\u771F\u5B9F", level: 4 },
    lie: { gloss: "\u5618", level: 4 },
    secret: { gloss: "\u79D8\u5BC6", level: 4 },
    promise: { gloss: "\u7D04\u675F", level: 4 },
    believe: { gloss: "\u4FE1\u3058\u308B", level: 4 },
    remember: { gloss: "\u899A\u3048\u3066\u3044\u308B", level: 4 },
    forget: { gloss: "\u5FD8\u308C\u308B", level: 4 },
    understand: { gloss: "\u7406\u89E3\u3059\u308B", level: 4 },
    change: { gloss: "\u5909\u3048\u308B\uFF0F\u5909\u5316", level: 4 },
    happen: { gloss: "\u8D77\u3053\u308B", level: 4 },
    forever: { gloss: "\u6C38\u9060\u306B", level: 3 },
    together: { gloss: "\u4E00\u7DD2\u306B", level: 5 },
    alone: { gloss: "\u4E00\u4EBA\u3067", level: 5 },
    always: { gloss: "\u3044\u3064\u3082", level: 5 },
    never: { gloss: "\u6C7A\u3057\u3066\u301C\u306A\u3044", level: 5 },
    really: { gloss: "\u672C\u5F53\u306B", level: 5 },
    maybe: { gloss: "\u305F\u3076\u3093", level: 5 },
    because: { gloss: "\u306A\u305C\u306A\u3089", level: 5 },
    right: { gloss: "\u6B63\u3057\u3044\uFF0F\u53F3", level: 5 },
    wrong: { gloss: "\u9593\u9055\u3063\u305F", level: 5 },
    good: { gloss: "\u826F\u3044", level: 5 },
    bad: { gloss: "\u60AA\u3044", level: 5 },
    great: { gloss: "\u7D20\u6674\u3089\u3057\u3044", level: 5 },
    beautiful: { gloss: "\u7F8E\u3057\u3044", level: 4 },
    happy: { gloss: "\u5E78\u305B\u306A", level: 5 },
    sad: { gloss: "\u60B2\u3057\u3044", level: 5 },
    angry: { gloss: "\u6012\u3063\u305F", level: 4 },
    scared: { gloss: "\u6016\u304C\u3063\u3066\u3044\u308B", level: 4 },
    strong: { gloss: "\u5F37\u3044", level: 5 },
    weak: { gloss: "\u5F31\u3044", level: 5 },
    important: { gloss: "\u5927\u5207\u306A", level: 4 },
    different: { gloss: "\u9055\u3046", level: 4 },
    same: { gloss: "\u540C\u3058", level: 5 }
  };

  // src/lib/direction.ts
  function normalizeDirection(value) {
    return value === "ja-en" ? "ja-en" : "en-ja";
  }

  // src/lib/scoring.ts
  var ELIGIBLE_POS = ["\u540D\u8A5E", "\u52D5\u8A5E", "\u5F62\u5BB9\u8A5E", "\u526F\u8A5E", "CONTENT"];
  var EXCLUDED_NOUN_POS1 = ["\u4EE3\u540D\u8A5E", "\u6570", "\u63A5\u5C3E", "\u975E\u81EA\u7ACB", "\u56FA\u6709\u540D\u8A5E"];
  function hasKanji(base) {
    return /[\u4E00-\u9FFF]/.test(base);
  }
  function lookupForDirection(base, direction, overlay) {
    if (overlay?.[base]) return overlay[base];
    if (normalizeDirection(direction) === "ja-en") {
      const hit = ENGLISH_ESSENTIALS[base];
      if (!hit) return null;
      return {
        reading: "",
        glosses: [hit.gloss],
        level: hit.level,
        freqRank: Math.round((6 - hit.level) * 2e3)
      };
    }
    return lookup(base);
  }
  function checkEligibility(token, wordStates, targetedSet, now = Date.now(), direction = "en-ja", overlay) {
    const { base, pos, pos1 } = token;
    const dir = normalizeDirection(direction);
    const isEnglish = dir === "ja-en" || pos === "CONTENT";
    if (!ELIGIBLE_POS.includes(pos)) {
      return { eligible: false, countSeen: false };
    }
    if (!isEnglish && pos === "\u540D\u8A5E" && EXCLUDED_NOUN_POS1.includes(pos1)) {
      return { eligible: false, countSeen: false };
    }
    if (!isEnglish && base.length < 2 && !hasKanji(base) && !isEssentialWord(base)) {
      return { eligible: false, countSeen: false };
    }
    if (isEnglish && base.length < 2) {
      return { eligible: false, countSeen: false };
    }
    const entry = lookupForDirection(base, dir, overlay);
    if (!entry) {
      return { eligible: false, countSeen: false };
    }
    const rec = wordStates[base];
    const state = rec?.state;
    if (state === "known" || state === "ignored") {
      return { eligible: false, countSeen: true, entry };
    }
    if (state === "learning") {
      const due = !!rec?.srs && rec.srs.dueAt <= now;
      if (!due) return { eligible: false, countSeen: true, entry };
    }
    if (targetedSet && targetedSet.has(base)) {
      return { eligible: false, countSeen: true, entry };
    }
    return { eligible: true, countSeen: true, entry };
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
  var SIGNIN_FEATURE_EVENTS = [
    "signin_gate_shown",
    "signin_started",
    "signin_completed",
    "signin_gate_dismissed"
  ];
  var SIGNIN_SURFACES = [
    "content_chip",
    "popup",
    "start_page",
    "install",
    "startup"
  ];
  var FEATURE_EVENTS = [
    "card_shown",
    "card_known",
    "card_learn",
    "word_saved",
    "review_done",
    "listening_started",
    "install_first_run",
    "extension_linked",
    ...SIGNIN_FEATURE_EVENTS
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
  var SIGNIN_EVENT_SET = new Set(SIGNIN_FEATURE_EVENTS);
  var SIGNIN_SURFACE_SET = new Set(SIGNIN_SURFACES);
  function isSigninEvent(v) {
    return typeof v === "string" && SIGNIN_EVENT_SET.has(v);
  }
  function isSigninSurface(v) {
    return typeof v === "string" && SIGNIN_SURFACE_SET.has(v);
  }
  var TRACK_SIGNIN_MESSAGE = "avc-track-signin";
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
  async function sendSigninBeacon(event, surface) {
    if (!isSigninEvent(event) || !isSigninSurface(surface)) return;
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
    if (typeof document !== "undefined") return chrome.runtime.sendMessage({ type: "avc-learning-write", method: "setSettings", args: [partial] }).then(unwrapLearningReply);
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["settings"]);
      const before = { ...structuredClone(r), settings: { ...withDefaults(r.settings || {}) } };
      const settings = { ...withDefaults(r.settings || {}), ...partial };
      await chrome.storage.local.set(await learningPatch(before, { settings: { ...settings } }));
      return settings;
    });
  }
  function setWordState(base, state) {
    if (typeof document !== "undefined") return chrome.runtime.sendMessage({ type: "avc-learning-write", method: "setWordState", args: [base, state] }).then(unwrapLearningReply);
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab"]);
      const before = structuredClone(r);
      const vocab = r.vocab || {};
      if (!vocab[base]) return;
      vocab[base].state = state;
      if (state === "learning") {
        vocab[base].srs = { stage: 1, dueAt: Date.now() + SRS_INTERVALS[1], lapses: 0 };
      } else {
        vocab[base].srs = null;
      }
      await chrome.storage.local.set(await learningPatch(before, { vocab }, "state"));
    });
  }
  function recordSeen(tokens, wordStates, targetedSet, direction = "en-ja", overlay) {
    if (typeof document !== "undefined") return chrome.runtime.sendMessage({ type: "avc-learning-write", method: "recordSeen", args: [tokens, wordStates, [...targetedSet], direction, overlay] }).then(unwrapLearningReply);
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const before = structuredClone(r);
      const vocab = { ...r.vocab || {} };
      const stats = r.stats || emptyStats();
      const day = todayKey();
      const daily = ensureDaily(stats, day);
      let changed = false;
      for (const token of tokens) {
        const eligibility = checkEligibility(token, wordStates, targetedSet, Date.now(), direction, overlay);
        if (!eligibility.countSeen) continue;
        const entry = lookupForDirection(token.base, direction, overlay);
        if (!entry) continue;
        if (!vocab[token.base]) {
          vocab[token.base] = {
            state: "new",
            reading: entry.reading,
            gloss: entry.glosses[0] || "",
            level: entry.level,
            freqRank: entry.freqRank,
            seenCount: 1,
            shownCount: 0,
            firstSeenAt: Date.now(),
            lastSeenAt: Date.now(),
            srs: null
          };
          daily.met += 1;
          changed = true;
        } else {
          vocab[token.base].seenCount += 1;
          vocab[token.base].lastSeenAt = Date.now();
          changed = true;
        }
      }
      if (changed) {
        await chrome.storage.local.set(await learningPatch(before, { vocab, stats }));
        void stampOnboarding("watchedAt");
      }
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
  function judgeWord(base, judgment, meta, source) {
    if (typeof document !== "undefined") return chrome.runtime.sendMessage({ type: "avc-learning-write", method: "judgeWord", args: [base, judgment, meta, source] }).then(unwrapLearningReply);
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const before = structuredClone(r);
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
      await chrome.storage.local.set(await learningPatch(
        before,
        { vocab, stats },
        judgment === "dismiss" ? "seen" : "save",
        judgment === "review-pass" || judgment === "review-fail" ? { base, result: judgment === "review-pass" ? "pass" : "fail", day } : void 0
      ));
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
  function recordCardShown(base) {
    if (typeof document !== "undefined") return chrome.runtime.sendMessage({ type: "avc-learning-write", method: "recordCardShown", args: [base] }).then(unwrapLearningReply);
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const before = structuredClone(r);
      const vocab = r.vocab || {};
      const stats = r.stats || emptyStats();
      const now = Date.now();
      stats.cardTimestamps = pruneTimestamps(stats.cardTimestamps);
      stats.cardTimestamps.push(now);
      if (vocab[base]) {
        vocab[base].shownCount = (vocab[base].shownCount || 0) + 1;
      }
      await chrome.storage.local.set(await learningPatch(before, { vocab, stats }));
      await trackExtensionMilestone("first_card_created");
      void stampOnboarding("cardShownAt");
      void trackFeature("card_shown");
    });
  }
  function recordWatchTick() {
    if (typeof document !== "undefined") return chrome.runtime.sendMessage({ type: "avc-learning-write", method: "recordWatchTick", args: [] }).then(unwrapLearningReply);
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["stats"]);
      const before = structuredClone(r);
      const stats = r.stats || emptyStats();
      const day = todayKey();
      const daily = ensureDaily(stats, day);
      daily.watchMin += 1;
      await chrome.storage.local.set(await learningPatch(before, { stats }));
    });
  }
  function getSyncToken() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["syncToken"], (r) => {
          if (chrome.runtime.lastError) {
            resolve("");
            return;
          }
          resolve(typeof r?.syncToken === "string" ? r.syncToken : "");
        });
      } catch {
        resolve("");
      }
    });
  }
  function setSyncToken(token) {
    return enqueue2(async () => {
      if (token) {
        const r = await chrome.storage.local.get([...LEARN_KEYS, "pendingSignoutExports"]);
        const patch = {};
        if (typeof r.syncToken === "string" && r.syncToken && r.syncToken !== token && !r.learnOwner) {
          const legacy = r.learnLegacy || { vocab: r.vocab, stats: r.stats, settings: r.settings };
          const { openaiKey: _key, ...settings } = legacy.settings || {};
          const pending = r.pendingSignoutExports || [];
          pending.push({ id: crypto.randomUUID(), token: r.syncToken, appliedWebReviewSeq: 0, export: { settings, vocab: legacy.vocab || {}, stats: legacy.stats || emptyStats(), exportedAt: (/* @__PURE__ */ new Date()).toISOString() } });
          Object.assign(patch, { pendingSignoutExports: pending, vocab: {}, stats: emptyStats(), settings: { openaiKey: r.settings?.openaiKey || "" }, learnLegacy: null, learnInitialized: false, learnCursor: 0, learnRemote: null, learnOwnerToken: null });
        }
        await chrome.storage.local.set({
          ...patch,
          syncToken: token,
          relinkNeeded: false,
          syncAuthFailures: 0
        });
      } else {
        await chrome.storage.local.set({ syncToken: "", syncProfile: null, syncStatus: { ...EMPTY_SYNC_STATUS } });
      }
    });
  }
  function clearSignedOutCache() {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["syncToken", "settings", "vocab", "stats", "webReviewSeq", "pendingSignoutExports", "learnInitialized"]);
      const settings = r.settings || {};
      const pending = r.pendingSignoutExports || [];
      if (typeof r.syncToken === "string" && r.syncToken && !r.learnInitialized) {
        const { openaiKey: _key, ...cloudSettings } = settings;
        pending.push({ id: crypto.randomUUID(), token: r.syncToken, appliedWebReviewSeq: Number(r.webReviewSeq) || 0, export: {
          settings: cloudSettings,
          vocab: r.vocab || {},
          stats: r.stats || emptyStats(),
          exportedAt: (/* @__PURE__ */ new Date()).toISOString()
        } });
      }
      await chrome.storage.local.set({
        pendingSignoutExports: pending,
        learnSigninPrompted: false,
        learnOwner: null,
        learnOwnerToken: null,
        learnCursor: 0,
        learnRemote: null,
        learnInitialized: false,
        learnLegacy: null,
        learnEpoch: null,
        syncToken: "",
        syncProfile: null,
        relinkNeeded: false,
        syncAuthFailures: 0,
        syncStatus: { ...EMPTY_SYNC_STATUS },
        autoLinkSuppressedUntil: Date.now() + SIGN_OUT_SUPPRESSION_MS,
        [ACCOUNT_CACHE_CLEARED]: Date.now(),
        vocab: {},
        stats: emptyStats(),
        settings: { openaiKey: settings.openaiKey || "" },
        webReviewSeq: 0
      });
    });
  }
  function acknowledgeSignoutExport(sent) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get("pendingSignoutExports");
      const pending = r.pendingSignoutExports || [];
      await chrome.storage.local.set({ pendingSignoutExports: pending.filter((p) => p.id !== sent.id) });
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
  function unwrapLearningReply(reply) {
    if (!reply || reply.error) throw new Error(reply?.error || "Could not save learning data.");
    return reply.value;
  }
  function prepareLearnSync(token, ownerId, epoch) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(LEARN_KEYS);
      if (r.syncToken !== token) return;
      let pending = r.learnOutbox || [];
      const switched = r.learnOwner && r.learnOwner !== ownerId;
      const reset = !switched && !!r.learnOwner && typeof epoch === "number" && typeof r.learnEpoch === "number" && r.learnEpoch !== epoch;
      const imports = !r.learnInitialized && !switched ? localImportOps(r.learnLegacy || { vocab: r.vocab, stats: r.stats, settings: r.settings }) : [];
      const adopted = pending.map((item) => !item.token || item.ownerId === ownerId ? { ...item, token, ownerId } : item);
      pending = [...imports.map((op) => ({ token, ownerId, op })), ...adopted];
      if (reset) pending = pending.filter((item) => item.token !== token);
      const patch = { learnOwner: ownerId, learnOwnerToken: token, learnOutbox: pending, learnInitialized: true, learnLegacy: null };
      if (typeof epoch === "number") patch.learnEpoch = epoch;
      if (switched || reset || !r.learnOwner) {
        patch.learnCursor = 0;
        patch.learnRemote = emptyLearnState();
        if (switched || reset) Object.assign(patch, cacheFromState(emptyLearnState(), pending, token, { openaiKey: r.settings?.openaiKey || "" }));
      }
      await chrome.storage.local.set(patch);
    });
  }
  function rejectLearnOps(token, rejected) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["learnOutbox", "learnRejected"]);
      const ids = new Set(rejected.map((x) => x.op.op_id));
      warn("cloud rejected learning operations:", rejected.map((x) => `${x.op.kind}:${x.reason}`).join(", "));
      await chrome.storage.local.set({
        learnOutbox: (r.learnOutbox || []).filter((p) => p.token !== token || !ids.has(p.op.op_id)),
        learnRejected: [...r.learnRejected || [], ...rejected.map((x) => ({ ...x, at: (/* @__PURE__ */ new Date()).toISOString() }))].slice(-50)
      });
    });
  }
  function applyLearnChanges(token, changes, cursor) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(LEARN_KEYS);
      if (r.syncToken !== token || r.learnOwnerToken !== token) return;
      const { state, pending } = mergeLearnChanges(r.learnRemote, r.learnOutbox || [], token, changes);
      const cache = cacheFromState(state, pending, token, r.settings || {});
      cache.stats.cardTimestamps = r.stats?.cardTimestamps || [];
      const patch = { learnRemote: state, learnCursor: cursor, learnOutbox: pending };
      for (const [key, value] of Object.entries(cache)) if (JSON.stringify(r[key]) !== JSON.stringify(value)) patch[key] = value;
      await chrome.storage.local.set(patch);
    });
  }
  function acknowledgeDetachedLearnOps(token, ids) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get("learnOutbox");
      const set = new Set(ids);
      await chrome.storage.local.set({ learnOutbox: (r.learnOutbox || []).filter((p) => p.token !== token || !set.has(p.op.op_id)) });
    });
  }
  function discardDeletedAccountWrites() {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get([...LEARN_KEYS, "pendingSignoutExports"]);
      const pending = (r.learnOutbox || []).filter((p) => p.token !== r.syncToken && (!r.learnOwner || p.ownerId !== r.learnOwner));
      const cache = cacheFromState(emptyLearnState(), [], "", { openaiKey: r.settings?.openaiKey || "" });
      await chrome.storage.local.set({
        learnOutbox: pending,
        pendingSignoutExports: (r.pendingSignoutExports || []).filter((p) => p.token !== r.syncToken),
        learnInitialized: true,
        learnLegacy: null,
        learnCursor: 0,
        learnRemote: emptyLearnState(),
        learnEpoch: null,
        ...cache,
        stats: { ...cache.stats, cardTimestamps: [] }
      });
      sendBadge({ daily: {} });
    });
  }

  // src/lib/cloud-sync.ts
  var Rejected = class extends Error {
  };
  var running = null;
  var queued = false;
  async function request(token, path, body) {
    return fetch(WEB_URL + "/api/learn/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + token,
        ...body ? { "Content-Type": "application/json" } : {}
      },
      ...body ? { body: JSON.stringify(body) } : {},
      signal: AbortSignal.timeout(1e4)
    });
  }
  async function permanentRejection(res) {
    if (![400, 404, 409, 413].includes(res.status)) return null;
    const error = (await res.json().catch(() => null))?.error;
    if (res.status === 409 && error !== "operation_id_reused") return null;
    return typeof error === "string" ? error : `HTTP ${res.status}`;
  }
  async function checked(token, path, body) {
    const res = await request(token, path, body);
    if (res.status === 401 && await getSyncToken() === token) {
      const n = await getSyncAuthFailures() + 1;
      await setSyncAuthFailures(n);
      if (n >= 3) {
        await setSyncToken("");
        await setRelinkNeeded(true);
      }
    }
    if (!res.ok) {
      const reason = body && await permanentRejection(res);
      if (reason) throw new Rejected(reason);
      throw new Error(`Cloud returned HTTP ${res.status}.`);
    }
    return res;
  }
  async function sendOps(token, ops, epoch) {
    try {
      await checked(token, "ops", { ops, epoch });
      return [];
    } catch (err) {
      if (!(err instanceof Rejected)) throw err;
      if (ops.length === 1) return [{ op: ops[0], reason: err.message }];
      const rejected = [];
      for (const op of ops) rejected.push(...await sendOps(token, [op], epoch));
      return rejected;
    }
  }
  function syncWithCloud() {
    if (running) {
      queued = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          queued = false;
          await syncOnce();
        } while (queued);
      } finally {
        running = null;
      }
    })();
    const foreground = running;
    return Promise.all([foreground, syncPendingSignouts()]).then(() => {
    });
  }
  var pullSettingsFromCloud = syncWithCloud;
  async function syncOnce() {
    const token = await getSyncToken();
    if (!token) return;
    const prior = await getSyncStatus();
    const at = Date.now();
    await setSyncStatus({
      state: "syncing",
      lastAttemptAt: at,
      lastSuccessAt: prior.lastSuccessAt,
      error: null
    });
    try {
      const identity2 = await (await checked(token, "changes?since=0&limit=0")).json();
      await prepareLearnSync(token, identity2.userId, identity2.epoch);
      if (await getSyncToken() !== token) return;
      const captured = await chrome.storage.local.get("learnOutbox");
      const pending = (captured.learnOutbox || []).filter(
        (p) => p.token === token
      );
      for (let i = 0; i < pending.length; i += 50) {
        if (await getSyncToken() !== token) return;
        const rejected = await sendOps(
          token,
          pending.slice(i, i + 50).map((p) => p.op),
          identity2.epoch
        );
        if (rejected.length) await rejectLearnOps(token, rejected);
      }
      let more = true;
      while (more) {
        const r = await chrome.storage.local.get("learnCursor");
        const data2 = await (await checked(token, "changes?since=" + Number(r.learnCursor || 0))).json();
        if (await getSyncToken() !== token) return;
        await applyLearnChanges(token, data2.changes, data2.cursor);
        more = data2.hasMore;
      }
      if (await getSyncToken() !== token) return;
      await setSyncAuthFailures(0);
      await setSyncStatus({
        state: "ok",
        lastAttemptAt: at,
        lastSuccessAt: Date.now(),
        error: null
      });
    } catch (err) {
      if (await getSyncToken() !== token) return;
      await setSyncStatus({
        state: "error",
        lastAttemptAt: at,
        lastSuccessAt: prior.lastSuccessAt,
        error: err instanceof Error ? err.message : "Cloud sync failed."
      });
    }
  }
  var detachedRunning = null;
  function syncPendingSignouts() {
    if (detachedRunning) return detachedRunning;
    detachedRunning = flushDetached().finally(() => {
      detachedRunning = null;
    });
    return detachedRunning;
  }
  async function flushDetached() {
    const r = await chrome.storage.local.get([
      "learnOutbox",
      "syncToken",
      "pendingSignoutExports"
    ]);
    const outbox = r.learnOutbox || [];
    const tokens = [
      ...new Set(
        outbox.filter((p) => p.token && p.token !== r.syncToken).map((p) => p.token)
      )
    ];
    for (const token of tokens) {
      const items = outbox.filter((p) => p.token === token);
      try {
        for (let i = 0; i < items.length; i += 50) {
          const batch = items.slice(i, i + 50).map((p) => p.op);
          const rejected = await sendOps(token, batch);
          if (rejected.length) await rejectLearnOps(token, rejected);
          await acknowledgeDetachedLearnOps(
            token,
            batch.map((o) => o.op_id)
          );
        }
      } catch {
      }
    }
    for (const pending of r.pendingSignoutExports || []) {
      try {
        const ops = localImportOps(pending.export);
        for (let i = 0; i < ops.length; i += 50)
          await sendOps(pending.token, ops.slice(i, i + 50));
        await acknowledgeSignoutExport(pending);
      } catch {
      }
    }
  }

  // src/lib/account-link.ts
  var TOKEN_URL = WEB_URL + "/api/sync/token";
  var AUTO_LINK_COOLDOWN_MS = 60 * 60 * 1e3;
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
    const data2 = body || {};
    const token = typeof data2.token === "string" ? data2.token : "";
    if (!token) return { status: "error", detail: "no token in response" };
    const p = data2.profile && typeof data2.profile === "object" ? data2.profile : {};
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
    const suppressionNow = await getAutoLinkSuppressedUntil();
    if (suppressionNow != null && Date.now() < suppressionNow) {
      return { linked: false, outcome: "throttled" };
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
      const data2 = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data2.error || `http_${res.status}` };
      return { ok: true, result: data2.result };
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
        const data2 = await res.json().catch(() => ({}));
        return { ok: false, error: data2.error || `http_${res.status}` };
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
      const data2 = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data2.error || `http_${res.status}` };
      const word = data2.result?.word;
      if (!word) return { ok: false, error: "empty_pick" };
      sessionCache.set(key, word);
      return { ok: true, word, cached: data2.cached };
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
      const data2 = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data2.error || `http_${res.status}` };
      const words = data2.result?.words;
      if (!words?.length) return { ok: false, error: "empty_extract" };
      sessionCache2.set(key, words);
      return { ok: true, words, cached: data2.cached };
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
      const data2 = await res.json();
      const ctx = (data2.context || "").trim();
      if (ctx) sessionCache3.set(clean.toLowerCase(), ctx);
      return ctx || null;
    } catch {
      return null;
    }
  }

  // src/lib/tts-client.ts
  async function fetchCloudTts(text3, token) {
    const res = await fetch(WEB_URL + "/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ text: text3 })
    });
    if (res.status === 429) {
      const data2 = await res.json().catch(() => ({}));
      return { blob: null, error: data2.error || "auto_quota_exhausted" };
    }
    if (!res.ok) return { blob: null, error: `http_${res.status}` };
    return { blob: await res.blob() };
  }
  async function fetchByoTts(text3, key) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model: "tts-1", voice: "nova", input: text3, response_format: "mp3" })
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
  async function fetchTtsAudio(text3) {
    const trimmed = (text3 || "").trim();
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

  // src/lib/signin-gate.ts
  var SIGNIN_CHIP_DISMISSED_KEY = "signinChipDismissed";
  var SIGNIN_UPGRADE_NOTICE_KEY = "signinUpgradeNotice";
  var SIGNIN_RETURN_TAB_KEY = "signinReturnTab";
  var SIGNIN_START_TAB_KEY = "signinStartTab";
  var SIGNIN_SURFACE_KEY = "signinSurface";
  function isSignedIn(token) {
    return typeof token === "string" && token.length > 0;
  }
  function isBeforeAccountGate(version) {
    if (!/^\d+(\.\d+){0,3}$/.test(version)) return false;
    const parts = version.split(".").map((p) => Number(p));
    if (!parts.length || parts.some((n) => !Number.isInteger(n) || n < 0)) return false;
    const [major = 0, minor = 0, patch = 0] = parts;
    if (major !== 0) return false;
    if (minor !== 7) return minor < 7;
    return patch < 2;
  }
  function signinStartPath(from) {
    return `/start?from=${encodeURIComponent(from)}`;
  }
  var LISTEN_SIGNIN_REQUIRED = "Listening needs a free account. Sign in at animevocab.com/start, then try again.";

  // src/lib/notify.ts
  function toastTab(tabId, text3, kind = "info") {
    chrome.tabs.sendMessage(tabId, { type: "avc-toast", text: text3, kind }).catch(() => {
    });
  }

  // src/lib/course-listening.ts
  var ID = /^[a-z0-9][a-z0-9-]{0,127}$/;
  var obj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  var text2 = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max;
  function courseLessonFromState(state) {
    if (!obj(state) || !obj(state.lesson)) return null;
    const l = state.lesson;
    if (!text2(l.id, 128) || !ID.test(l.id) || l.script !== "romaji" && l.script !== "kana" || !text2(l.canDo, 500)) return null;
    if (!Array.isArray(l.vocabulary) || l.vocabulary.length > 20) return null;
    const words = [];
    for (const v of l.vocabulary) {
      if (!obj(v) || !text2(v.id, 128) || !text2(v.reading, 120) || !text2(v.meaning, 250)) return null;
      const kana = text2(v.kana, 120) ? v.kana : l.script === "kana" ? v.reading : "";
      words.push({ id: v.id, reading: v.reading, meaning: v.meaning, kana });
    }
    const unit = Number.isSafeInteger(l.unit) && l.unit >= 1 && l.unit <= 99 ? l.unit : null;
    const episode = obj(l.episode) && Number.isSafeInteger(l.episode.number) && text2(l.episode.title, 120) ? { number: l.episode.number, title: l.episode.title } : null;
    const ids = new Set(words.map((w) => w.id));
    const heard = Array.isArray(l.heard) ? l.heard.filter((id) => typeof id === "string" && ids.has(id)) : [];
    return {
      id: l.id,
      unit,
      title: text2(l.title, 120) ? l.title : null,
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
  async function request2(token, path, body) {
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
        const saved = await request2(token, "/heard", { lessonId, wordIds: wordIds.slice(0, 20) });
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
        await request2(token, "/events", { episodeId: event.episodeId, kind: "watch_complete", idempotencyKey: event.idempotencyKey });
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
      const state = await request2(who.token, "/extension/state");
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
      const data2 = await res.json().catch(() => ({}));
      if (!res.ok || !data2.result || typeof data2.result.en !== "string") return { ok: false, error: data2.error || `http_${res.status}` };
      const readings = {};
      if (data2.result.readings && typeof data2.result.readings === "object") {
        for (const [k, v] of Object.entries(data2.result.readings)) {
          if (/^\d{1,3}$/.test(k) && typeof v === "string" && /^[ぁ-ゖァ-ヺー]{1,30}$/.test(v)) readings[k] = v;
        }
      }
      return { ok: true, result: { en: data2.result.en.slice(0, 400), readings } };
    } catch {
      return { ok: false, error: "network" };
    }
  }
  async function fetchSubBatch(req) {
    const token = await getSyncToken();
    if (!token) return { ok: false, error: "not_linked" };
    try {
      const res = await fetch(WEB_URL + "/api/ai/translate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ title: req.title || void 0, lines: req.lines, context: req.context }),
        signal: AbortSignal.timeout(3e4)
      });
      const data2 = await res.json().catch(() => ({}));
      const en = data2.result?.en;
      if (!res.ok || !Array.isArray(en) || en.length !== req.lines.length) return { ok: false, error: data2.error || `http_${res.status}` };
      const names = {};
      if (data2.result?.names && typeof data2.result.names === "object") {
        for (const [k, v] of Object.entries(data2.result.names)) {
          if (k.length <= 20 && typeof v === "string" && /^[\u3041-\u3096\u30a1-\u30faー]{1,30}$/.test(v)) names[k] = v;
        }
      }
      return { ok: true, result: { en: en.map((e) => typeof e === "string" ? e.slice(0, 400) : ""), names } };
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
    cancelAll() {
      const tabs = [...this.pending.keys()];
      this.pending.clear();
      return tabs;
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
  var openingSignin = null;
  function openSigninFromGate(msg, sender) {
    if (openingSignin) return openingSignin;
    openingSignin = runSigninFromGate(msg, sender).finally(() => {
      openingSignin = null;
    });
    return openingSignin;
  }
  async function runSigninFromGate(msg, sender) {
    const surface = msg.from === "popup" ? "popup" : "content_chip";
    let returnTabId = typeof msg.tabId === "number" ? msg.tabId : sender.tab?.id;
    if (returnTabId == null) {
      const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      returnTabId = active?.id;
    }
    const remembered = { [SIGNIN_SURFACE_KEY]: surface };
    if (returnTabId != null) remembered[SIGNIN_RETURN_TAB_KEY] = returnTabId;
    try {
      await chrome.storage.session.set(remembered);
    } catch {
    }
    const result = await linkAccount("signin_gate", { force: true });
    if (result.linked) return { ok: true, linked: true, opened: false };
    try {
      const tab = await chrome.tabs.create({ url: WEB_URL + signinStartPath(surface) });
      if (tab.id != null) {
        try {
          await chrome.storage.session.set({ [SIGNIN_START_TAB_KEY]: tab.id });
        } catch {
        }
      }
      return { ok: true, linked: false, opened: true };
    } catch (err) {
      return { ok: false, linked: false, opened: false, error: String(err?.message || err) };
    }
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
      void (async () => {
        await chrome.storage.session.remove([SIGNIN_RETURN_TAB_KEY, SIGNIN_START_TAB_KEY]);
        await chrome.storage.session.set({
          [SIGNIN_SURFACE_KEY]: "install"
        });
        const tab = await chrome.tabs.create({ url: WEB_URL + signinStartPath("install") });
        if (tab.id != null) await chrome.storage.session.set({ [SIGNIN_START_TAB_KEY]: tab.id });
        await linkAccount("install");
      })().catch(() => {
      });
    }
    if (details.reason === "update" && isBeforeAccountGate(details.previousVersion || "")) {
      void (async () => {
        try {
          const r = await chrome.storage.local.get(["syncToken", "vocab"]);
          const words = r.vocab && typeof r.vocab === "object" ? Object.keys(r.vocab).length : 0;
          if (!isSignedIn(r.syncToken) && words > 0) {
            await chrome.storage.local.set({ [SIGNIN_UPGRADE_NOTICE_KEY]: true });
          }
        } catch {
        }
      })();
    }
    void ensureSyncBridgeInOpenTabs();
  });
  void ensureSyncBridgeInOpenTabs();
  var SYNC_ALARM = "avc-cloud-sync";
  var syncDebounce = null;
  function scheduleSync(delayMs = 250) {
    if (syncDebounce) return;
    syncDebounce = setTimeout(() => {
      syncDebounce = null;
      syncWithCloud().catch(() => {
      });
    }, delayMs);
  }
  chrome.runtime.onStartup.addListener(() => {
    void chrome.storage.session.set({ [SIGNIN_SURFACE_KEY]: "startup" });
    syncWithCloud().catch(() => {
    });
    void retryPendingN5();
    void linkAccount("startup");
  });
  chrome.runtime.onInstalled.addListener(() => chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 1 }));
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) {
      syncWithCloud().catch(() => {
      });
      void retryPendingN5();
    }
  });
  async function completeSignin() {
    let surface = "startup";
    let returnTabId = null;
    let startTabId = null;
    try {
      const s = await chrome.storage.session.get([
        SIGNIN_SURFACE_KEY,
        SIGNIN_RETURN_TAB_KEY,
        SIGNIN_START_TAB_KEY
      ]);
      if (isSigninSurface(s[SIGNIN_SURFACE_KEY])) surface = s[SIGNIN_SURFACE_KEY];
      if (typeof s[SIGNIN_RETURN_TAB_KEY] === "number") returnTabId = s[SIGNIN_RETURN_TAB_KEY];
      if (typeof s[SIGNIN_START_TAB_KEY] === "number") startTabId = s[SIGNIN_START_TAB_KEY];
    } catch {
    }
    void sendSigninBeacon("signin_completed", surface);
    syncWithCloud().catch(() => {
    });
    if (returnTabId != null) {
      try {
        const tab = await chrome.tabs.get(returnTabId);
        await chrome.tabs.update(returnTabId, { active: true });
        if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
      } catch {
      }
    }
    if (surface !== "install" && startTabId != null && startTabId !== returnTabId) {
      try {
        await chrome.tabs.remove(startTabId);
      } catch {
      }
    }
    try {
      await chrome.storage.session.remove([
        SIGNIN_SURFACE_KEY,
        SIGNIN_RETURN_TAB_KEY,
        SIGNIN_START_TAB_KEY
      ]);
    } catch {
    }
    await chrome.storage.local.remove(SIGNIN_UPGRADE_NOTICE_KEY);
  }
  async function handleSignOut() {
    const pending = captureStarts.cancelAll();
    try {
      const tabs = await getListening();
      await Promise.all(
        [.../* @__PURE__ */ new Set([...pending, ...Object.keys(tabs).filter((id) => tabs[Number(id)]).map(Number)])].map((id) => stopListening(id))
      );
    } catch {
    }
    await chrome.storage.local.remove([SIGNIN_CHIP_DISMISSED_KEY, SIGNIN_UPGRADE_NOTICE_KEY]);
    try {
      await chrome.storage.session.remove([
        SIGNIN_SURFACE_KEY,
        SIGNIN_RETURN_TAB_KEY,
        SIGNIN_START_TAB_KEY
      ]);
    } catch {
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const outbox = changes.learnOutbox;
    if (outbox && (Array.isArray(outbox.newValue) ? outbox.newValue.length : 0) > (Array.isArray(outbox.oldValue) ? outbox.oldValue.length : 0)) scheduleSync();
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
  async function deliverTranscript(tabId, text3, start, end) {
    const payload = {
      type: "avc-transcript",
      text: text3,
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
  async function startListening(tabId) {
    const generation = captureStarts.begin(tabId);
    const cancelled = () => !captureStarts.current(tabId, generation);
    const cancelledAck = { ok: false, error: "Listening start was cancelled." };
    const r = await chrome.storage.local.get(["settings"]);
    const settings = r.settings || {};
    const syncToken2 = await getSyncToken();
    if (!syncToken2) {
      return { ok: false, error: LISTEN_SIGNIN_REQUIRED };
    }
    let auth;
    if (settings.openaiKey?.trim()) {
      auth = { kind: "byo", key: settings.openaiKey.trim() };
    } else {
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
  async function noteStartPageSurface() {
    const s = await chrome.storage.session.get(SIGNIN_SURFACE_KEY);
    if (!isSigninSurface(s[SIGNIN_SURFACE_KEY])) {
      await chrome.storage.session.set({ [SIGNIN_SURFACE_KEY]: "start_page" });
    }
  }
  var ACCOUNT_REQUESTS = /* @__PURE__ */ new Set([
    "avc-coach",
    "avc-coach-chat",
    "avc-pick-word",
    "avc-translate-batch",
    "avc-translate",
    "avc-extract-words",
    "avc-anime-context",
    "avc-tts",
    "avc-usage"
  ]);
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "avc-learning-write") {
      const args = Array.isArray(msg.args) ? msg.args : [];
      const handlers = {
        setSettings: () => setSettings(args[0]),
        setWordState: () => setWordState(args[0], args[1]),
        recordSeen: () => recordSeen(args[0], args[1], new Set(args[2]), args[3], args[4]),
        judgeWord: () => judgeWord(args[0], args[1], args[2], args[3]),
        recordCardShown: () => recordCardShown(args[0]),
        recordWatchTick: () => recordWatchTick()
      };
      const handler = Object.prototype.hasOwnProperty.call(handlers, msg.method || "") ? handlers[msg.method] : null;
      if (!handler) {
        sendResponse({ error: "Unknown learning write." });
        return;
      }
      void handler().then(async (value) => {
        sendResponse({ value });
        if (msg.method === "judgeWord" && (args[1] === "learn" || args[1] === "know") && !await getSyncToken()) {
          const r = await chrome.storage.local.get("learnSigninPrompted");
          if (!r.learnSigninPrompted) {
            await chrome.storage.local.set({ learnSigninPrompted: true });
            void openSigninFromGate({ type: "avc-open-signin", from: "content_chip" }, sender);
          }
        }
      }, (error) => sendResponse({ error: String(error?.message || error) }));
      return true;
    }
    if (msg.type === "avc-device-key") {
      const url = sender.url || sender.tab?.url || "";
      if (!/^https:\/\/(www\.)?animevocab\.com\//.test(url) || typeof msg.value !== "string" || msg.value.length > 512) {
        sendResponse({ ok: false });
        return;
      }
      void setSettings({ openaiKey: msg.value.trim() }).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
      return true;
    }
    if (msg.type === "avc-delete-learning-data") {
      void discardDeletedAccountWrites().then(() => syncWithCloud().catch(() => {
      })).then(() => sendResponse({ ok: true }));
      return true;
    }
    if (msg.type === "avc-link-token" && typeof msg.token === "string") {
      void (msg.surface === "start_page" ? noteStartPageSurface() : Promise.resolve()).then(() => setSyncToken(msg.token)).then(async () => {
        if (msg.profile) await setSyncProfile(msg.profile);
        await syncWithCloud();
        sendResponse({ ok: true });
      }).catch(() => sendResponse({ ok: false }));
      return true;
    }
    if (ACCOUNT_REQUESTS.has(msg.type) || msg.type?.startsWith("avc-n5-")) {
      void getSyncToken().then((token) => {
        if (!token) sendResponse({ ok: false, error: "Sign in to your free account at animevocab.com/start." });
        else handleRuntimeMessage(msg, sender, sendResponse);
      }).catch(() => sendResponse({ ok: false, error: "Sign in to your free account at animevocab.com/start." }));
      return true;
    }
    return handleRuntimeMessage(msg, sender, sendResponse);
  });
  function handleRuntimeMessage(msg, sender, sendResponse) {
    if (msg.type === "avc-sign-out") {
      void clearSignedOutCache().then(() => {
        void syncWithCloud().catch(() => {
        });
        sendResponse({ ok: true });
      }, () => sendResponse({ ok: false }));
      return true;
    }
    if (typeof msg?.type === "string" && msg.type.startsWith("avc-n5-")) {
      void handleN5(msg, sender, async (tabId) => {
        await stopListening(tabId);
      }).then(sendResponse);
      return true;
    }
    if (msg.type === "avc-badge") {
      const text3 = (msg.count || 0) > 0 ? String(msg.count) : "";
      chrome.action.setBadgeText({ text: text3 });
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
    if (msg.type === TRACK_SIGNIN_MESSAGE) {
      if (isSigninEvent(msg.event) && isSigninSurface(msg.surface)) {
        void sendSigninBeacon(msg.event, msg.surface);
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
    if (msg.type === "avc-open-signin") {
      openSigninFromGate(msg, sender).then(sendResponse).catch((err) => sendResponse({ ok: false, linked: false, opened: false, error: String(err?.message || err) }));
      return true;
    }
    if (msg.type === "avc-signin-surface") {
      void (msg.surface === "start_page" ? noteStartPageSurface() : Promise.resolve()).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
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
    if (msg.type === "avc-translate-batch") {
      fetchSubBatch(msg.payload).then(sendResponse).catch(() => sendResponse({ ok: false, error: "network" }));
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
    if (msg.type === "avc-agent-pin" || msg.type === "avc-agent-show" || msg.type === "avc-agent-hide" || msg.type === "avc-agent-status" || msg.type === "avc-caption-status" || msg.type === "avc-subs-diag") {
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
  }
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "avc-chat-stream") return;
    port.onMessage.addListener((msg) => {
      void (async () => {
        if (!await getSyncToken()) {
          port.postMessage({ type: "error", error: "Sign in to your free account at animevocab.com/start." });
          return;
        }
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
  self.addEventListener("online", () => scheduleSync(0));
  function redirectRetiredPage(details) {
    if (details.frameId === 0 && details.url === chrome.runtime.getURL(["dashboard", "dashboard.html"].join("/"))) {
      void chrome.tabs.update(details.tabId, { url: WEB_URL + "/app#progress" });
    }
  }
  chrome.webNavigation.onBeforeNavigate.addListener(redirectRetiredPage);
  chrome.webNavigation.onErrorOccurred.addListener(redirectRetiredPage);
})();
