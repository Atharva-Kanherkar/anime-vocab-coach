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
  function localRecordSeen(tokens, targeted, direction = "en-ja", overlay) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const wordStates = r.vocab || {};
      const targetedSet = new Set(targeted);
      const vocab = { ...wordStates };
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
        await chrome.storage.local.set({ vocab, stats });
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
    resetProgress: localResetProgress
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
      const data2 = await exportAll();
      const blob = new Blob([JSON.stringify(data2, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animevocab-export-${todayKey2()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    byId("reset-btn").addEventListener("click", async () => {
      if (!confirm("Reset all vocab and stats? Settings will be kept.")) return;
      await resetProgress();
    });
  });
})();
