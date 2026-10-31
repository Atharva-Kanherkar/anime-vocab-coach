"use strict";
(() => {
  // src/lib/log.ts
  var log = (...args) => console.log("[AVC]", ...args);
  var warn = (...args) => console.warn("[AVC]", ...args);

  // src/config.ts
  var BACKEND_URL = "https://api.animevocab.com";
  var WEB_URL = "https://animevocab.com";
  function ownedWebUrl(path, campaign) {
    const url = new URL(path, WEB_URL);
    url.searchParams.set("utm_source", "animevocab_extension");
    url.searchParams.set("utm_medium", "extension");
    url.searchParams.set("utm_campaign", campaign);
    return url.toString();
  }
  function cloudAppUrl(section, campaign) {
    return ownedWebUrl(`/app#${section}`, campaign);
  }
  var CWS_EXTENSION_ID = "lkjbomofgfonjjbemobacegffepbdnel";

  // src/lib/account-cache.ts
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
  var loadPromise = null;
  var data = null;
  function load() {
    if (!loadPromise) {
      loadPromise = fetch(chrome.runtime.getURL("data/dictionary.json")).then((r) => r.json()).then((d) => {
        data = d;
        return d;
      }).catch((err) => {
        warn("dictionary load failed:", err);
        loadPromise = null;
        return {};
      });
    }
    return loadPromise;
  }
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
  function essentialBoost(base, targetLevel) {
    if (targetLevel < 4) return 0;
    return ESSENTIAL_WORDS[base]?.boost ?? 0;
  }
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
  function targetLang(direction) {
    return direction === "ja-en" ? "en" : "ja";
  }
  function audioLang(direction) {
    return targetLang(direction);
  }
  function contextLang(direction) {
    return direction === "ja-en" ? "ja" : "en";
  }
  function contextSubtitleLabel(direction) {
    return direction === "ja-en" ? "Japanese subtitle" : "English subtitle";
  }
  function chatPlaceholder(direction) {
    return direction === "ja-en" ? "\u3053\u306E\u30B7\u30FC\u30F3\u306E\u82F1\u8A9E\u306B\u3064\u3044\u3066\u805E\u304F\u2026" : "Ask about Japanese in this scene\u2026";
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
  function collectEligible(tokens, wordStates, targetedSet, direction = "en-ja", overlay) {
    const survivors = [];
    const now = Date.now();
    for (const token of tokens) {
      const check = checkEligibility(token, wordStates, targetedSet, now, direction, overlay);
      if (check.eligible && check.entry) {
        survivors.push({ token, entry: check.entry });
      }
    }
    const dueReviews = survivors.filter(({ token }) => {
      const rec = wordStates[token.base];
      return rec?.state === "learning" && rec.srs && rec.srs.dueAt <= now;
    });
    if (dueReviews.length) {
      dueReviews.sort((a, b) => {
        const aDue = wordStates[a.token.base].srs.dueAt;
        const bDue = wordStates[b.token.base].srs.dueAt;
        return aDue - bDue;
      });
      const pick = dueReviews[0];
      return {
        dueReview: { token: pick.token, entry: pick.entry, isReview: true },
        newWords: []
      };
    }
    return {
      dueReview: null,
      newWords: survivors.map(({ token, entry }) => ({ token, entry, isReview: false }))
    };
  }
  function pickTargetHeuristic(newWords, wordStates, settings) {
    let best = null;
    let bestScore = -1;
    const dir = normalizeDirection(settings.learningDirection);
    for (const { token, entry } of newWords) {
      const essential = dir === "ja-en" ? ENGLISH_ESSENTIALS[token.base] ? 0.25 : 0 : essentialBoost(token.base, settings.targetLevel);
      const freqScore = 1 - Math.min(entry.freqRank, 2e4) / 2e4;
      const levelScore = 1 - Math.abs(entry.level - settings.targetLevel) / 4;
      const familiarity = Math.min(wordStates[token.base]?.seenCount || 0, 5) / 5;
      const score = 0.35 * freqScore + 0.3 * levelScore + 0.15 * familiarity + essential;
      const minScore = essential > 0 ? 0.22 : 0.35;
      if (score < minScore) continue;
      if (!best || score > bestScore || score === bestScore && entry.freqRank < best.entry.freqRank) {
        bestScore = score;
        best = { token, entry, isReview: false };
      }
    }
    return best;
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
  async function trackPro(event, surface) {
    if (!isProFunnelEvent(event) || !isProSurface(surface)) return;
    if (inServiceWorker()) {
      await sendProBeacon(event, surface);
      return;
    }
    try {
      void chrome.runtime.sendMessage({ type: TRACK_PRO_MESSAGE, event, surface }).catch(() => {
      });
    } catch {
    }
  }
  async function trackSignin(event, surface) {
    if (!isSigninEvent(event) || !isSigninSurface(surface)) return;
    if (inServiceWorker()) {
      await sendSigninBeacon(event, surface);
      return;
    }
    try {
      void chrome.runtime.sendMessage({ type: TRACK_SIGNIN_MESSAGE, event, surface }).catch(() => {
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
  function isFirstCardTransition(oldValue, newValue) {
    return normalizeOnboarding(oldValue).firstCardAt === 0 && normalizeOnboarding(newValue).firstCardAt > 0;
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
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["settings"]);
      const settings = { ...withDefaults(r.settings || {}), ...partial };
      await chrome.storage.local.set({ settings });
      return settings;
    });
  }
  function setAgentPinned(pinned) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ agentPinned: pinned }, () => resolve());
    });
  }
  function getAgentPanelWidth() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["agentPanelWidth"], (r) => {
        const w = Number(r.agentPanelWidth);
        resolve(Number.isFinite(w) && w > 0 ? w : 340);
      });
    });
  }
  function setAgentPanelWidth(width) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ agentPanelWidth: width }, () => resolve());
    });
  }
  function getAgentPanelCollapsed() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["agentPanelCollapsed"], (r) => {
        resolve(r.agentPanelCollapsed === true);
      });
    });
  }
  function setAgentPanelCollapsed(collapsed2) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ agentPanelCollapsed: collapsed2 }, () => resolve());
    });
  }
  function getVocab() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["vocab"], (r) => resolve(r.vocab || {}));
    });
  }
  function getStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["stats"], (r) => {
        const stats = r.stats || emptyStats();
        stats.cardTimestamps = pruneTimestamps(stats.cardTimestamps);
        resolve(stats);
      });
    });
  }
  function recordSeen(tokens, wordStates, targetedSet, direction = "en-ja", overlay) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
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
  function judgeWord(base, judgment, meta, source) {
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
  function recordCardShown(base) {
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
  function recordWatchTick() {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["stats"]);
      const stats = r.stats || emptyStats();
      const day = todayKey();
      const daily = ensureDaily(stats, day);
      daily.watchMin += 1;
      await chrome.storage.local.set({ stats });
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

  // src/lib/tts-client.ts
  var activeAudio = null;
  async function playBlob(blob) {
    if (activeAudio) {
      activeAudio.pause();
      URL.revokeObjectURL(activeAudio.src);
      activeAudio = null;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    activeAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (activeAudio === audio) activeAudio = null;
    };
    await audio.play();
  }
  function base64ToBlob(b64, mime) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  async function speakText(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return { ok: false, error: "empty" };
    try {
      const res = await chrome.runtime.sendMessage({ type: "avc-tts", text: trimmed });
      if (res?.ok && res.b64) {
        await playBlob(base64ToBlob(res.b64, res.mime || "audio/mpeg"));
        return { ok: true };
      }
      return { ok: false, error: res?.error || "not_linked" };
    } catch {
      return { ok: false, error: "playback_failed" };
    }
  }

  // src/lib/romaji.ts
  var DIGRAPHS = {
    "\u304D\u3083": "kya",
    "\u304D\u3085": "kyu",
    "\u304D\u3087": "kyo",
    "\u3057\u3083": "sha",
    "\u3057\u3085": "shu",
    "\u3057\u3087": "sho",
    "\u3057\u3047": "she",
    "\u3061\u3083": "cha",
    "\u3061\u3085": "chu",
    "\u3061\u3087": "cho",
    "\u3061\u3047": "che",
    "\u306B\u3083": "nya",
    "\u306B\u3085": "nyu",
    "\u306B\u3087": "nyo",
    "\u3072\u3083": "hya",
    "\u3072\u3085": "hyu",
    "\u3072\u3087": "hyo",
    "\u307F\u3083": "mya",
    "\u307F\u3085": "myu",
    "\u307F\u3087": "myo",
    "\u308A\u3083": "rya",
    "\u308A\u3085": "ryu",
    "\u308A\u3087": "ryo",
    "\u304E\u3083": "gya",
    "\u304E\u3085": "gyu",
    "\u304E\u3087": "gyo",
    "\u3058\u3083": "ja",
    "\u3058\u3085": "ju",
    "\u3058\u3087": "jo",
    "\u3058\u3047": "je",
    "\u3062\u3083": "ja",
    "\u3062\u3085": "ju",
    "\u3062\u3087": "jo",
    "\u3073\u3083": "bya",
    "\u3073\u3085": "byu",
    "\u3073\u3087": "byo",
    "\u3074\u3083": "pya",
    "\u3074\u3085": "pyu",
    "\u3074\u3087": "pyo",
    "\u3075\u3041": "fa",
    "\u3075\u3043": "fi",
    "\u3075\u3047": "fe",
    "\u3075\u3049": "fo",
    "\u3066\u3043": "ti",
    "\u3067\u3043": "di",
    "\u3068\u3045": "tu",
    "\u3069\u3045": "du",
    "\u3046\u3043": "wi",
    "\u3046\u3047": "we",
    "\u3046\u3049": "wo",
    "\u3064\u3041": "tsa",
    "\u3064\u3043": "tsi",
    "\u3064\u3047": "tse",
    "\u3064\u3049": "tso",
    "\u3094\u3041": "va",
    "\u3094\u3043": "vi",
    "\u3094\u3047": "ve",
    "\u3094\u3049": "vo"
  };
  var MONOGRAPHS = {
    "\u3042": "a",
    "\u3044": "i",
    "\u3046": "u",
    "\u3048": "e",
    "\u304A": "o",
    "\u304B": "ka",
    "\u304D": "ki",
    "\u304F": "ku",
    "\u3051": "ke",
    "\u3053": "ko",
    "\u304C": "ga",
    "\u304E": "gi",
    "\u3050": "gu",
    "\u3052": "ge",
    "\u3054": "go",
    "\u3055": "sa",
    "\u3057": "shi",
    "\u3059": "su",
    "\u305B": "se",
    "\u305D": "so",
    "\u3056": "za",
    "\u3058": "ji",
    "\u305A": "zu",
    "\u305C": "ze",
    "\u305E": "zo",
    "\u305F": "ta",
    "\u3061": "chi",
    "\u3064": "tsu",
    "\u3066": "te",
    "\u3068": "to",
    "\u3060": "da",
    "\u3062": "ji",
    "\u3065": "zu",
    "\u3067": "de",
    "\u3069": "do",
    "\u306A": "na",
    "\u306B": "ni",
    "\u306C": "nu",
    "\u306D": "ne",
    "\u306E": "no",
    "\u306F": "ha",
    "\u3072": "hi",
    "\u3075": "fu",
    "\u3078": "he",
    "\u307B": "ho",
    "\u3070": "ba",
    "\u3073": "bi",
    "\u3076": "bu",
    "\u3079": "be",
    "\u307C": "bo",
    "\u3071": "pa",
    "\u3074": "pi",
    "\u3077": "pu",
    "\u307A": "pe",
    "\u307D": "po",
    "\u307E": "ma",
    "\u307F": "mi",
    "\u3080": "mu",
    "\u3081": "me",
    "\u3082": "mo",
    "\u3084": "ya",
    "\u3086": "yu",
    "\u3088": "yo",
    "\u3089": "ra",
    "\u308A": "ri",
    "\u308B": "ru",
    "\u308C": "re",
    "\u308D": "ro",
    "\u308F": "wa",
    "\u3090": "i",
    "\u3091": "e",
    "\u3092": "o",
    "\u3093": "n",
    "\u3094": "vu",
    "\u3041": "a",
    "\u3043": "i",
    "\u3045": "u",
    "\u3047": "e",
    "\u3049": "o",
    "\u3083": "ya",
    "\u3085": "yu",
    "\u3087": "yo",
    "\u308E": "wa",
    "\u3002": ". ",
    "\u3001": ", ",
    "\uFF01": "! ",
    "\uFF1F": "? ",
    "\u30FB": " ",
    "\u300C": ' "',
    "\u300D": '" '
  };
  function kataToHira(s) {
    return (s || "").replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 96));
  }
  function toRomaji(kana) {
    const s = kataToHira(kana);
    let out = "";
    let sokuon = false;
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "\u3063") {
        sokuon = true;
        i++;
        continue;
      }
      if (ch === "\u30FC") {
        const m = out.match(/[aiueo](?=[^aiueo]*$)/);
        if (m) out += m[0];
        i++;
        continue;
      }
      let roma = null;
      const pair = s.slice(i, i + 2);
      if (DIGRAPHS[pair]) {
        roma = DIGRAPHS[pair];
        i += 2;
      } else if (MONOGRAPHS[ch]) {
        roma = MONOGRAPHS[ch];
        i += 1;
      } else {
        out += ch;
        i += 1;
        sokuon = false;
        continue;
      }
      if (sokuon) {
        out += roma.startsWith("ch") ? "t" : roma[0];
        sokuon = false;
      }
      out += roma;
    }
    return out.replace(/\s+/g, " ").trim();
  }
  function sentencePieces(tokens, highlightIndex) {
    return tokens.map((t, idx) => ({
      text: toRomaji(t.reading || t.surface),
      highlight: idx === highlightIndex
    })).filter((p) => p.text);
  }
  function speak(text) {
    void speakAsync(text);
  }
  async function speakAsync(raw) {
    const text = (raw || "").trim();
    if (!text) return;
    const cloud = await speakText(text);
    if (cloud.ok) return;
    try {
      const synth = window.top?.speechSynthesis ?? speechSynthesis;
      const voices = await loadVoices(synth);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = 0.85;
      const ja = voices.find((v) => v.lang === "ja-JP") || voices.find((v) => v.lang?.startsWith("ja")) || null;
      if (ja) u.voice = ja;
      synth.cancel();
      synth.speak(u);
    } catch (err) {
      warn("tts failed:", err);
    }
  }
  function preloadVoices() {
    try {
      const synth = window.top?.speechSynthesis ?? speechSynthesis;
      void loadVoices(synth);
    } catch {
    }
  }
  function loadVoices(synth) {
    return new Promise((resolve) => {
      const pick = () => synth.getVoices().filter(Boolean);
      const existing = pick();
      if (existing.length) {
        resolve(existing);
        return;
      }
      const done = () => {
        synth.removeEventListener("voiceschanged", done);
        resolve(pick());
      };
      synth.addEventListener("voiceschanged", done);
      setTimeout(() => {
        synth.removeEventListener("voiceschanged", done);
        resolve(pick());
      }, 800);
    });
  }

  // src/lib/tokenizer.ts
  var initPromise = null;
  var tokenizerInstance = null;
  function init() {
    if (initPromise) return initPromise;
    initPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: chrome.runtime.getURL("kuromoji/dict/") }).build((err, tk) => {
        if (err) {
          warn("tokenizer init failed:", err);
          initPromise = null;
          reject(err);
          return;
        }
        tokenizerInstance = tk;
        resolve(tk);
      });
    });
    return initPromise;
  }
  async function tokenize(text) {
    try {
      await init();
    } catch {
      return [];
    }
    if (!tokenizerInstance) return [];
    return tokenizerInstance.tokenize(text).map((t) => ({
      surface: t.surface_form,
      base: t.basic_form === "*" ? t.surface_form : t.basic_form,
      reading: kataToHira(t.reading || ""),
      pos: t.pos,
      pos1: t.pos_detail_1
    }));
  }

  // src/lib/english-tokenize.ts
  var STOPWORDS = /* @__PURE__ */ new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "then",
    "so",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "onto",
    "to",
    "with",
    "without",
    "about",
    "above",
    "after",
    "before",
    "between",
    "over",
    "under",
    "up",
    "down",
    "out",
    "off",
    "over",
    "again",
    "further",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "than",
    "too",
    "very",
    "can",
    "will",
    "just",
    "don",
    "should",
    "now",
    "i",
    "me",
    "my",
    "myself",
    "we",
    "our",
    "ours",
    "you",
    "your",
    "yours",
    "he",
    "him",
    "his",
    "she",
    "her",
    "hers",
    "it",
    "its",
    "they",
    "them",
    "their",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "am",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "having",
    "do",
    "does",
    "did",
    "doing",
    "would",
    "could",
    "ought",
    "i'm",
    "you're",
    "he's",
    "she's",
    "it's",
    "we're",
    "they're",
    "i've",
    "you've",
    "we've",
    "they've",
    "i'd",
    "you'd",
    "he'd",
    "she'd",
    "we'd",
    "they'd",
    "i'll",
    "you'll",
    "he'll",
    "she'll",
    "we'll",
    "they'll",
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
    "hasn't",
    "haven't",
    "hadn't",
    "doesn't",
    "don't",
    "didn't",
    "won't",
    "wouldn't",
    "shan't",
    "shouldn't",
    "can't",
    "cannot",
    "couldn't",
    "mustn't",
    "let's",
    "that's",
    "who's",
    "what's",
    "here's",
    "there's",
    "when's",
    "where's",
    "why's",
    "how's",
    "oh",
    "ah",
    "uh",
    "um",
    "yeah",
    "yes",
    "ok",
    "okay",
    "hey",
    "hi",
    "hello"
  ]);
  function lemmatize(raw) {
    const w = raw.toLowerCase();
    if (w.length <= 3) return w;
    if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
    if (w.endsWith("ves") && w.length > 4) return w.slice(0, -3) + "f";
    if (w.endsWith("ing") && w.length > 5) {
      const stem = w.slice(0, -3);
      if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) return stem.slice(0, -1);
      return stem;
    }
    if (w.endsWith("ed") && w.length > 4) {
      const stem = w.slice(0, -2);
      if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) return stem.slice(0, -1);
      return stem;
    }
    if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
    if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
    return w;
  }
  function tokenizeEnglish(text) {
    const tokens = [];
    const re = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const surface = m[0];
      const lower = surface.toLowerCase();
      if (STOPWORDS.has(lower)) continue;
      if (lower.length < 3 && !/[A-Z]/.test(surface)) continue;
      const base = lemmatize(lower);
      if (STOPWORDS.has(base) || base.length < 2) continue;
      tokens.push({
        surface,
        base,
        reading: "",
        pos: "CONTENT",
        pos1: "english"
      });
    }
    return tokens;
  }

  // src/lib/word-picker-client.ts
  var sessionCache = /* @__PURE__ */ new Map();
  function sessionKey(req) {
    const bases = req.candidates.map((c) => c.word).sort().join("|");
    return `${req.direction || "en-ja"}:${req.learnerLevel}:${req.line}:${bases}`;
  }
  async function requestWordPick(req) {
    const key = sessionKey(req);
    const hit = sessionCache.get(key);
    if (hit) return { ok: true, word: hit, cached: true };
    try {
      const res = await chrome.runtime.sendMessage({
        type: "avc-pick-word",
        payload: req
      });
      if (!res) return { ok: false, error: "no_response" };
      if (res.ok && res.word) sessionCache.set(key, res.word);
      return res;
    } catch {
      return { ok: false, error: "network" };
    }
  }

  // src/lib/levels.ts
  function commonnessLabel(level) {
    switch (level) {
      case 5:
        return "Very common";
      case 4:
        return "Common";
      case 3:
        return "Mid-frequency";
      case 2:
        return "Uncommon";
      default:
        return "Rare";
    }
  }

  // src/lib/markdown-lite.ts
  function renderMarkdown(container, markdown) {
    container.textContent = "";
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    let list = null;
    const flushList = () => {
      if (list) {
        container.appendChild(list);
        list = null;
      }
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        flushList();
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        if (!list) {
          list = document.createElement("ul");
          list.className = "avc-md-ul";
        }
        const li = document.createElement("li");
        appendInline(li, line.replace(/^[-*]\s+/, ""));
        list.appendChild(li);
        continue;
      }
      flushList();
      if (/^###\s+/.test(line)) {
        const h = document.createElement("div");
        h.className = "avc-md-h3";
        appendInline(h, line.replace(/^###\s+/, ""));
        container.appendChild(h);
        continue;
      }
      if (/^##\s+/.test(line)) {
        const h = document.createElement("div");
        h.className = "avc-md-h2";
        appendInline(h, line.replace(/^##\s+/, ""));
        container.appendChild(h);
        continue;
      }
      const p = document.createElement("p");
      p.className = "avc-md-p";
      appendInline(p, line);
      container.appendChild(p);
    }
    flushList();
  }
  function appendInline(parent, text) {
    const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0;
    let m;
    while (m = re.exec(text)) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      const tok = m[0];
      if (tok.startsWith("`")) {
        const code = document.createElement("code");
        code.className = "avc-md-code";
        code.textContent = tok.slice(1, -1);
        parent.appendChild(code);
      } else if (tok.startsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = tok.slice(2, -2);
        parent.appendChild(strong);
      } else {
        const em = document.createElement("em");
        em.textContent = tok.slice(1, -1);
        parent.appendChild(em);
      }
      last = m.index + tok.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  // src/lib/pausable-timer.ts
  var PausableTimer = class {
    constructor() {
      this.timer = null;
      this.isFrozen = false;
      /** Milliseconds banked while frozen; null when there is nothing to resume. */
      this.remaining = null;
      this.deadline = 0;
      this.fire = null;
    }
    /** Start (or restart) the countdown. While frozen, banks `ms` instead. */
    arm(ms, fire) {
      this.fire = fire;
      if (this.isFrozen) {
        this.remaining = ms;
        this.clearTimer();
        return;
      }
      this.start(ms);
    }
    /** Stop the clock, keeping whatever time was left. */
    freeze() {
      if (this.isFrozen) return;
      this.isFrozen = true;
      if (this.timer) {
        this.remaining = Math.max(0, this.deadline - Date.now());
        this.clearTimer();
      }
    }
    /** Resume from where the clock stopped. */
    thaw() {
      if (!this.isFrozen) return;
      this.isFrozen = false;
      const left = this.remaining;
      this.remaining = null;
      if (left !== null && this.fire) this.start(left);
    }
    /** Disarm completely; neither freeze nor thaw brings it back. */
    clear() {
      this.clearTimer();
      this.isFrozen = false;
      this.remaining = null;
      this.fire = null;
    }
    /** True once armed, whether it is currently counting or frozen. */
    get armed() {
      return this.fire !== null;
    }
    get frozen() {
      return this.isFrozen;
    }
    start(ms) {
      this.clearTimer();
      this.deadline = Date.now() + ms;
      this.timer = setTimeout(() => {
        const fire = this.fire;
        this.clear();
        fire?.();
      }, ms);
    }
    clearTimer() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    }
  };

  // src/lib/playback-hold.ts
  var PlaybackHold = class {
    constructor() {
      /**
       * The video the current hold was taken on, or null when nothing is held.
       *
       * A hold has to name its video, not just its existence. Players swap their
       * `<video>` between titles, and the resume paths resolve the element when
       * they fire rather than when the pause was taken — so a hold recorded as a
       * bare boolean let a peek-pause on the last episode start the next one, which
       * is issue #125's bleed wearing a different hat.
       */
      this.heldVideo = null;
      /**
       * One pause event we are still waiting for from our own `pause()` call.
       *
       * HTMLMediaElement.pause() flips `paused` synchronously but **queues** the
       * `pause` event, so the event lands after the call returns. A window that
       * only spans the call therefore mistakes our own pause for the learner's and
       * gives up a hold we do in fact own, which is how the peek-pause stopped
       * resuming at all. The expectation is a single pending flag instead: exactly
       * one pause event is ours, whenever it arrives.
       *
       * It cannot leak into a later learner pause, because a hold is only ever
       * taken on a playing video (both callers check), and pausing a playing video
       * always raises the event that consumes this.
       */
      this.ownPauseExpected = false;
    }
    /** Record that we are about to pause `video`, then pause through `doPause`. */
    hold(video, doPause) {
      this.ownPauseExpected = true;
      doPause();
      this.heldVideo = video;
    }
    owned() {
      return this.heldVideo !== null;
    }
    /**
     * A pause event arrived. Ours changes nothing; theirs means the learner has
     * stopped the video deliberately and we must never undo that.
     *
     * Returns whether the pause was ours, so a caller that also reacts to the
     * learner pausing (freezing a dismissal clock, say) can tell the two apart
     * from this one answer rather than keeping a second flag of its own that can
     * drift out of step with this one.
     */
    noticePause() {
      if (this.ownPauseExpected) {
        this.ownPauseExpected = false;
        return true;
      }
      this.heldVideo = null;
      return false;
    }
    /**
     * A play event. Judged against the video's state at the moment it is handled,
     * not by the event's arrival: media events are queued, so a play the learner
     * triggered just before we took a hold can land after it. Reading the state
     * makes a stale event harmless, where trusting the order would hand back a
     * pause we own and leave the learner stopped with nothing to resume it.
     */
    noticePlay(paused) {
      if (paused) return;
      this.heldVideo = null;
      this.ownPauseExpected = false;
    }
    /**
     * A seek. While paused this is #130's exact gesture: the learner stopped to
     * study and is now moving to another moment, still stopped. Seeking during
     * playback says nothing about who owns a pause.
     */
    noticeSeek(paused) {
      if (paused) this.heldVideo = null;
    }
    /**
     * Give the pause back, once. Returns **the video the hold was taken on**, so
     * a caller can only ever resume that element — resolving the video at resume
     * time instead is how a peek-pause on one episode started the next one. Null
     * when we no longer own a pause, and null on a second call, so two timers
     * cannot both resume the same hold.
     */
    release() {
      this.ownPauseExpected = false;
      const video = this.heldVideo;
      this.heldVideo = null;
      return video;
    }
    /**
     * Drop the claim without resuming.
     *
     * For the cases where the learner has gone somewhere else entirely: the tab
     * is hidden, so starting playback would be audio in a window they are not
     * looking at. Resuming is right when they are still here (the toolbar popup,
     * issue #131); it is not right when they have left.
     */
    forfeit() {
      this.ownPauseExpected = false;
      this.heldVideo = null;
    }
  };

  // src/lib/key-shield.ts
  var UI_HOST_ATTR = "data-avc-ui";
  var KEY_EVENTS = ["keydown", "keyup", "keypress"];
  function fromOurUi(e) {
    for (const node of e.composedPath()) {
      if (node instanceof Element && node.hasAttribute(UI_HOST_ATTR)) return true;
    }
    return false;
  }
  function originalTarget(e) {
    const path = e.composedPath();
    return path.length ? path[0] : e.target;
  }
  function isEditableTarget(node) {
    const el = node;
    if (!el || typeof el.tagName !== "string") return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
  }
  function isTypingEvent(e) {
    if (isEditableTarget(originalTarget(e))) return true;
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return isEditableTarget(active);
  }
  function keepFocusOnMouseClick(root2) {
    root2.addEventListener("mousedown", (e) => {
      const el = e.composedPath()[0];
      if (!el || typeof el.closest !== "function") return;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (el.closest("button, [role='button']")) e.preventDefault();
    });
  }
  function relay(e) {
    const target = originalTarget(e);
    if (!(target instanceof Node) || !(target.getRootNode() instanceof ShadowRoot)) return;
    const copy = new KeyboardEvent(e.type, {
      key: e.key,
      code: e.code,
      location: e.location,
      repeat: e.repeat,
      isComposing: e.isComposing,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      bubbles: true,
      cancelable: true,
      composed: false
    });
    if (!target.dispatchEvent(copy)) e.preventDefault();
  }
  function shield(e) {
    if (!e.isTrusted || !fromOurUi(e)) return;
    e.stopImmediatePropagation();
    relay(e);
  }
  function installKeyShield(win = window) {
    const w = win;
    if (w.__avcKeyShield) return false;
    w.__avcKeyShield = true;
    for (const type of KEY_EVENTS) win.addEventListener(type, shield, true);
    return true;
  }

  // src/lib/course-listening.ts
  function soundKey(text) {
    return kataToHira(text.normalize("NFKC")).replace(/[^ぁ-ゖー]/g, "");
  }
  function wordsHeard(tokens, words, baseReading = () => null) {
    const sounds = tokens.map((t) => soundKey(t.reading || t.surface));
    const bases = tokens.map((t) => {
      const kana = /^[ぁ-ヿー]+$/.test(t.base) ? t.base : baseReading(t.base);
      return kana ? soundKey(kana) : "";
    });
    const heard = [];
    for (const word of words) {
      const key = soundKey(word.kana);
      if (key.length < 2) {
        if (key && tokens.some((t, i) => sounds[i] === key && t.pos === "\u540D\u8A5E" && t.pos1 !== "\u63A5\u5C3E" && /[\u3400-\u9fff]/.test(t.surface))) heard.push(word.id);
        continue;
      }
      let found = bases.includes(key);
      for (let i = 0; !found && i < sounds.length; i++) {
        let run = "";
        for (let j = i; j < sounds.length; j++) {
          run += sounds[j];
          if (run === key) {
            found = true;
            break;
          }
          if (!key.startsWith(run)) break;
        }
      }
      if (found) heard.push(word.id);
    }
    return heard;
  }
  function coursePrompt(lesson) {
    if (!lesson.unit) return null;
    return {
      unit: lesson.unit,
      title: lesson.title || "",
      canDo: lesson.canDo,
      script: lesson.script,
      words: lesson.words.map((w) => `${w.reading} \u2014 ${w.meaning}`)
    };
  }
  var ID = /^[a-z0-9][a-z0-9-]{0,127}$/;
  function lessonUrl(lesson, step) {
    if (!ID.test(lesson.id)) throw new Error("Invalid lesson");
    return `https://animevocab.com/app/n5/lessons/${lesson.id}?script=${lesson.script}#${step}`;
  }

  // src/lib/agent-panel.ts
  var AMBIENT_AUTO_DISMISS_SEC = 15;
  var FOCUS_AUTO_DISMISS_SEC = 30;
  var shell = null;
  var mounted = false;
  var wordPending = false;
  var wordResolve = null;
  var wordCtx = null;
  var chatHistory = [];
  var chatPayload = null;
  var course = null;
  var courseActions = null;
  var courseMoment = null;
  var keyHandler = null;
  var autoTimer = new PausableTimer();
  var autoTimerMax = new PausableTimer();
  var userResumed = false;
  var activeVideo = null;
  var wasPlaying = false;
  var cardHold = new PlaybackHold();
  var videoWatchers = [];
  var currentJudgments = [];
  var collapsed = false;
  var CHAT_ENGAGED_MS = 3e4;
  var CHAT_DRAFT_HOLD_MS = 12e4;
  var chatActiveAt = 0;
  var chatStreaming = false;
  var chatStreamStartedAt = 0;
  var CHAT_STREAM_IDLE_MS = 3e4;
  var CHAT_STREAM_MAX_MS = 15e4;
  var PANEL_MIN_W = 280;
  var PANEL_MAX_W = 560;
  var PANEL_DEFAULT_W = 340;
  var PANEL_RAIL_W = 36;
  var PANEL_BOTTOM_CLEARANCE = "clamp(140px, 15vh, 190px)";
  var STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .avc-agent-layer {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    /* Owned by the layer so the ambient wash respects the same host-control
       clearance the sidebar does. Painting over those controls is half of
       issue #132; stopping only the click targets leaves the tint behind. */
    --avc-panel-bottom: ${PANEL_BOTTOM_CLEARANCE};
    --avc-panel-w: ${PANEL_DEFAULT_W}px;
  }
  .avc-agent-ambient {
    position: absolute; inset: 0; bottom: var(--avc-panel-bottom);
    pointer-events: none;
    transition: background 480ms ease;
  }
  .avc-agent-ambient.avc-focus {
    background: linear-gradient(
      to left,
      rgba(0, 0, 0, 0.12) 0%,
      rgba(0, 0, 0, 0.04) calc(var(--avc-panel-w, 340px) * 0.6),
      transparent var(--avc-panel-w, 340px)
    );
  }
  .avc-agent-sidebar {
    position: fixed; top: 0; right: 0; bottom: var(--avc-panel-bottom);
    width: var(--avc-panel-w);
    min-width: ${PANEL_MIN_W}px;
    max-width: min(${PANEL_MAX_W}px, 42vw);
    display: flex; flex-direction: column;
    /* The bar spans a 340px full-height strip but is mostly transparent, so it
       must not eat page clicks (the video player's fullscreen button etc.,
       P0 #9). The container is click-through; only the real controls opt back
       in (rule below), so the empty middle always passes clicks to the page. */
    pointer-events: none;
    background: rgba(8, 7, 10, 0.05);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    border-left: 1px solid rgba(255, 255, 255, 0.04);
    box-shadow: none;
    color: rgba(236, 234, 228, 0.3);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    overflow: hidden;
    transition:
      background 320ms ease,
      backdrop-filter 320ms ease,
      border-color 320ms ease,
      box-shadow 320ms ease,
      color 320ms ease;
  }
  /* Only the real controls take clicks; pointer-events inherits, so the
     transparent container and the empty scroll middle stay click-through and
     pass straight to the page. The resize grip, head (mode + Close), foot
     (know/ignore) and composer (chat) are always live regardless of whether a
     card is up \u2014 so chat/mode/Close/resize work in the idle state too. Inside
     the scroll, each content block is live except the idle hint (plain text),
     which stays click-through to maximize the pass-through area. */
  .avc-agent-resize,
  .avc-agent-head,
  .avc-agent-foot,
  .avc-agent-composer,
  .avc-agent-scroll > *:not(.avc-agent-idle) {
    pointer-events: auto;
  }
  .avc-agent-sidebar:hover,
  .avc-agent-sidebar:focus-within,
  .avc-agent-sidebar.avc-sidebar-active {
    background: rgba(8, 7, 10, 0.82);
    backdrop-filter: blur(20px) saturate(1.12);
    -webkit-backdrop-filter: blur(20px) saturate(1.12);
    border-left-color: rgba(255, 255, 255, 0.1);
    box-shadow: -16px 0 48px rgba(0, 0, 0, 0.18);
    color: rgba(236, 234, 228, 0.78);
  }
  .avc-agent-sidebar.avc-focus-sidebar:not(:hover):not(:focus-within):not(.avc-sidebar-active) {
    background: rgba(8, 7, 10, 0.07);
  }
  .avc-agent-sidebar.avc-focus-sidebar:hover,
  .avc-agent-sidebar.avc-focus-sidebar:focus-within,
  .avc-agent-sidebar.avc-focus-sidebar.avc-sidebar-active {
    background: rgba(8, 7, 10, 0.86);
    border-left-color: rgba(227, 186, 99, 0.14);
  }
  /* Collapsed: a rail on the right edge and nothing else. The card stays
     mounted behind it, so expanding brings the same word back. */
  .avc-agent-sidebar.avc-collapsed {
    width: ${PANEL_RAIL_W}px;
    min-width: ${PANEL_RAIL_W}px;
    max-width: ${PANEL_RAIL_W}px;
  }
  .avc-agent-sidebar.avc-collapsed .avc-agent-panel,
  .avc-agent-sidebar.avc-collapsed .avc-agent-resize {
    display: none;
  }
  .avc-agent-rail {
    display: none;
    position: absolute; inset: 0;
    flex-direction: column; align-items: center; justify-content: flex-start;
    gap: 10px; padding: 12px 0;
    pointer-events: auto; cursor: pointer;
    background: rgba(8, 7, 10, 0.55);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
  }
  .avc-agent-sidebar.avc-collapsed .avc-agent-rail { display: flex; }
  .avc-agent-rail:hover { background: rgba(8, 7, 10, 0.78); }
  .avc-agent-rail-mark {
    font-size: 10px; letter-spacing: 0.14em; color: rgba(227, 186, 99, 0.7);
    writing-mode: vertical-rl; text-transform: uppercase;
  }
  .avc-agent-rail-open {
    font-size: 13px; line-height: 1; color: rgba(236, 234, 228, 0.6);
  }
  /* A card waiting behind the rail. The mark alone was 0.7 -> 1.0 alpha of the
     same hue inside a 36px strip, which is not a notification; the whole rail
     takes the accent so the waiting state is visible without looking for it. */
  .avc-agent-sidebar.avc-collapsed.avc-has-card .avc-agent-rail {
    background: rgba(227, 186, 99, 0.16);
    border-left-color: rgba(227, 186, 99, 0.55);
    box-shadow: -6px 0 18px rgba(227, 186, 99, 0.18);
  }
  .avc-agent-sidebar.avc-collapsed.avc-has-card .avc-agent-rail-mark {
    color: rgba(227, 186, 99, 1);
  }
  .avc-agent-sidebar.avc-collapsed.avc-has-card .avc-agent-rail-open {
    color: rgba(236, 234, 228, 0.95);
  }
  .avc-agent-collapse {
    width: 26px; height: 26px; padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(236, 234, 228, 0.55);
    font-size: 13px; line-height: 1;
    cursor: pointer; font-family: inherit;
  }
  .avc-agent-collapse:hover {
    color: rgba(236, 234, 228, 0.9);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .avc-agent-resize {
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 6px; cursor: col-resize; z-index: 4;
    touch-action: none;
  }
  .avc-agent-resize::after {
    content: ""; position: absolute; left: 2px; top: 50%;
    width: 2px; height: 48px; margin-top: -24px;
    border-radius: 2px; background: rgba(255, 255, 255, 0.08);
    transition: background 120ms, height 120ms;
  }
  .avc-agent-resize:hover::after,
  .avc-agent-resize.avc-dragging::after {
    background: rgba(227, 186, 99, 0.45);
    height: 72px; margin-top: -36px;
  }
  .avc-agent-panel {
    display: flex; flex-direction: column;
    flex: 1; min-height: 0; height: 100%;
    background: transparent;
  }
  .avc-agent-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; padding: 14px 16px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }
  .avc-agent-brand {
    font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(227, 186, 99, 0.55);
  }
  .avc-agent-mode-select {
    font-size: 11px; letter-spacing: 0.04em;
    padding: 5px 28px 5px 10px; border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23b8b4aa' d='M1 1l4 4 4-4'/%3E%3C/svg%3E") no-repeat right 8px center;
    color: rgba(236, 234, 228, 0.75);
    cursor: pointer; appearance: none; -webkit-appearance: none;
    font-family: inherit;
  }
  .avc-agent-mode-select:focus {
    outline: none; border-color: rgba(227, 186, 99, 0.3);
  }
  .avc-agent-lens-toggle {
    height: 26px; padding: 0 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(236, 234, 228, 0.45);
    font-size: 11px; line-height: 1; letter-spacing: 0.04em;
    cursor: pointer; font-family: inherit;
    text-decoration: line-through;
  }
  .avc-agent-lens-toggle[aria-pressed="true"] {
    color: rgba(227, 186, 99, 0.95);
    border-color: rgba(227, 186, 99, 0.35);
    text-decoration: none;
  }
  .avc-agent-lens-toggle:hover { border-color: rgba(255, 255, 255, 0.22); }
  .avc-agent-head-actions {
    display: flex; align-items: center; gap: 6px; flex-shrink: 0;
  }
  .avc-agent-close {
    width: 26px; height: 26px; padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(236, 234, 228, 0.55);
    font-size: 16px; line-height: 1;
    cursor: pointer; font-family: inherit;
  }
  .avc-agent-close:hover {
    color: rgba(236, 234, 228, 0.92);
    border-color: rgba(255, 255, 255, 0.18);
  }
  .avc-agent-scroll {
    overflow-y: auto; padding: 12px 16px 8px;
    flex: 1; min-height: 0;
    display: flex; flex-direction: column;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,.12) transparent;
  }
  .avc-agent-idle {
    padding: 24px 8px 20px; text-align: center;
    color: rgba(236, 234, 228, 0.32);
    font-size: 12px; line-height: 1.6;
  }
  .avc-agent-idle strong { color: rgba(227, 186, 99, 0.5); font-weight: 500; }
  .avc-course { display: none; margin: 0 -2px 10px; padding: 12px; border-radius: 12px;
    background: rgba(6, 5, 9, 0.62); border: 1px solid rgba(255, 255, 255, 0.07);
    color: rgba(236, 234, 228, 0.82); font-size: 12px; line-height: 1.45; }
  .avc-course.avc-active { display: block; }
  .avc-course-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .avc-course-tag { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(227, 186, 99, 0.85); }
  .avc-course-link { background: none; border: 0; padding: 0; font: inherit; font-size: 11px; color: rgba(236, 234, 228, 0.55); cursor: pointer; text-decoration: underline; }
  .avc-course-goal { margin: 4px 0 8px; font-weight: 600; }
  .avc-course-words { display: flex; flex-wrap: wrap; gap: 4px; }
  .avc-course-word { padding: 2px 7px; border-radius: 999px; border: 1px dashed rgba(255, 255, 255, 0.16);
    color: rgba(236, 234, 228, 0.55); font-size: 11px; }
  .avc-course-word.avc-heard { border-style: solid; border-color: rgba(120, 200, 150, 0.55); color: rgb(160, 225, 180); }
  .avc-course-word.avc-just { background: rgba(120, 200, 150, 0.18); }
  .avc-course-count { margin-top: 6px; font-size: 10px; color: rgba(236, 234, 228, 0.42); }
  .avc-course-moment { margin-top: 8px; padding: 8px; border-radius: 8px; background: rgba(120, 200, 150, 0.08); }
  .avc-course-moment q { display: block; margin: 4px 0 6px; color: rgba(236, 234, 228, 0.7); }
  .avc-course-btn { padding: 6px 8px; font: inherit; font-size: 11px; cursor: pointer; border-radius: 6px;
    background: rgba(255, 255, 255, 0.05); color: rgba(236, 234, 228, 0.8); border: 1px solid rgba(255, 255, 255, 0.12); }
  .avc-course-btn:hover { background: rgba(255, 255, 255, 0.1); }
  .avc-course-btn:disabled { opacity: 0.45; cursor: default; }
  .avc-course-finish { display: block; width: 100%; margin-top: 10px; color: rgba(227, 186, 99, 0.95); border-color: rgba(227, 186, 99, 0.35); }
  .avc-course-status { margin-top: 6px; font-size: 11px; color: rgba(236, 234, 228, 0.6); }
  .avc-agent-word-block { display: none; }
  .avc-agent-word-block.avc-active { display: block; }
  /* Ambient: readable text on a small local card \u2014 sidebar background stays glassy */
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active {
    padding: 14px 12px 12px;
    margin: 0 -2px 10px;
    border-radius: 12px;
    background: linear-gradient(
      165deg,
      rgba(6, 5, 9, 0.78) 0%,
      rgba(6, 5, 9, 0.52) 55%,
      rgba(6, 5, 9, 0.42) 100%
    );
    backdrop-filter: blur(14px) saturate(1.08);
    -webkit-backdrop-filter: blur(14px) saturate(1.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-chip {
    color: rgba(236, 234, 228, 0.62);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-word {
    color: rgba(255, 252, 245, 0.97);
    text-shadow:
      0 0 1px rgba(0, 0, 0, 0.95),
      0 1px 2px rgba(0, 0, 0, 0.9),
      0 2px 10px rgba(0, 0, 0, 0.65),
      0 0 24px rgba(0, 0, 0, 0.4);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-word-kana {
    font-size: 16px;
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-reading {
    color: rgba(248, 244, 236, 0.82);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-gloss {
    color: rgba(248, 244, 236, 0.9);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-context,
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-sentence {
    color: rgba(240, 237, 230, 0.82);
    background: rgba(0, 0, 0, 0.22);
    border-left-color: rgba(227, 186, 99, 0.45);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-label {
    color: rgba(236, 234, 228, 0.55);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-romaji-line {
    color: rgba(236, 234, 228, 0.78);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-sentence mark,
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-romaji-line mark {
    color: rgba(255, 220, 140, 0.98);
    text-shadow:
      0 0 1px rgba(0, 0, 0, 0.9),
      0 1px 4px rgba(0, 0, 0, 0.75),
      0 0 16px rgba(227, 168, 72, 0.35);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-foot.avc-active {
    margin: 0 -2px 4px;
    padding: 10px 10px 8px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(6, 5, 9, 0.62);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.22);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-foot.avc-active .avc-agent-know {
    color: rgba(248, 244, 236, 0.88);
    background: rgba(255, 255, 255, 0.08);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-foot.avc-active .avc-agent-ignore {
    color: rgba(236, 234, 228, 0.62);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-foot.avc-active .avc-agent-hint {
    color: rgba(236, 234, 228, 0.45);
  }
  .avc-agent-chip {
    display: inline-block; font-size: 9px; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgba(236, 234, 228, 0.35);
    margin-bottom: 10px;
  }
  .avc-agent-chip-review { color: rgba(217, 108, 79, 0.65); }
  .avc-agent-word-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .avc-agent-word {
    font-size: 28px; font-weight: 600; line-height: 1.15;
    color: rgba(248, 244, 236, 0.82);
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
    font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif;
  }
  .avc-agent-speak {
    background: rgba(255, 255, 255, 0.05); color: rgba(236, 234, 228, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px;
    padding: 5px 12px; cursor: pointer; font-size: 11px;
    letter-spacing: 0.04em; transition: background 120ms, color 120ms;
    font-family: inherit;
  }
  .avc-agent-speak:hover { background: rgba(255, 255, 255, 0.1); color: rgba(248, 244, 236, 0.9); }
  .avc-agent-word-kana {
    font-size: 22px; font-weight: 500; line-height: 1.2;
    color: rgba(227, 186, 99, 0.78);
    margin: -2px 0 6px; letter-spacing: 0.02em;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
    font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif;
  }
  .avc-agent-reading { font-size: 13px; color: rgba(236, 234, 228, 0.42); margin-bottom: 6px; }
  .avc-agent-gloss { font-size: 14px; line-height: 1.45; color: rgba(236, 234, 228, 0.62); margin-bottom: 12px; }
  .avc-agent-context, .avc-agent-sentence {
    font-size: 12px; line-height: 1.55; color: rgba(236, 234, 228, 0.52);
    margin-bottom: 10px; padding: 8px 10px;
    background: rgba(255, 255, 255, 0.025);
    border-left: 1px solid rgba(227, 186, 99, 0.18);
    border-radius: 0 6px 6px 0;
  }
  .avc-agent-label {
    display: block; font-size: 9px; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgba(236, 234, 228, 0.28); margin-bottom: 4px;
  }
  .avc-agent-ja-line { font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif; font-size: 13px; line-height: 1.65; }
  .avc-agent-romaji-line { margin-bottom: 4px; font-size: 12px; color: rgba(236, 234, 228, 0.55); }
  .avc-agent-tok { cursor: pointer; border-bottom: 1px dotted rgba(236, 234, 228, 0.22); }
  .avc-agent-tok:hover { color: rgba(227, 186, 99, 0.85); }
  .avc-agent-sentence mark, .avc-agent-romaji-line mark {
    background: transparent; color: rgba(227, 186, 99, 0.88); font-weight: 600;
    text-shadow: 0 0 20px rgba(227, 168, 72, 0.25);
  }
  .avc-agent-lookup { margin-top: 6px; font-size: 11px; color: rgba(236, 234, 228, 0.5); }
  .avc-agent-ai { margin: 12px 0 10px; }
  .avc-agent-ai-btns { display: flex; gap: 6px; margin-bottom: 8px; }
  .avc-agent-ai-btn {
    flex: 1; padding: 6px 8px; font-size: 11px; cursor: pointer;
    background: rgba(255, 255, 255, 0.04); color: rgba(236, 234, 228, 0.68);
    border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px;
    transition: background 120ms; font-family: inherit;
  }
  .avc-agent-ai-btn:hover { background: rgba(255, 255, 255, 0.08); }
  .avc-agent-ai-btn:disabled { opacity: 0.4; cursor: default; }
  .avc-agent-ai-out { font-size: 12px; line-height: 1.5; color: rgba(236, 234, 228, 0.62); display: none; }
  .avc-agent-ai-out.avc-visible { display: block; }
  .avc-agent-ai-label {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
    color: rgba(236, 234, 228, 0.3); margin-top: 6px;
  }
  .avc-agent-ai-hooks { margin: 4px 0 0 14px; font-size: 12px; }
  .avc-agent-chat {
    margin-top: auto; padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }
  .avc-agent-chat-label {
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(236, 234, 228, 0.32); margin-bottom: 8px;
  }
  .avc-agent-chat-log {
    flex: 1; min-height: 80px; overflow-y: auto; margin-bottom: 0;
    display: flex; flex-direction: column; gap: 8px;
    scrollbar-width: thin;
  }
  .avc-agent-chat-msg {
    font-size: 12px; line-height: 1.52; padding: 8px 11px;
    border-radius: 10px; max-width: 92%; word-break: break-word;
  }
  .avc-agent-chat-msg.avc-user {
    align-self: flex-end;
    background: rgba(227, 186, 99, 0.1);
    border: 1px solid rgba(227, 186, 99, 0.14);
    color: rgba(248, 244, 236, 0.82);
    border-bottom-right-radius: 3px;
  }
  .avc-agent-chat-msg.avc-assistant {
    align-self: flex-start;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: rgba(236, 234, 228, 0.72);
    border-bottom-left-radius: 3px;
  }
  .avc-agent-chat-msg.avc-streaming::after {
    content: ""; display: inline-block; width: 5px; height: 11px;
    margin-left: 2px; background: rgba(227, 186, 99, 0.5);
    animation: avc-blink 900ms step-end infinite;
  }
  @keyframes avc-blink { 50% { opacity: 0; } }
  .avc-md-p { margin: 0 0 6px; }
  .avc-md-p:last-child { margin-bottom: 0; }
  .avc-md-h2 { font-weight: 600; font-size: 12px; margin: 8px 0 4px; color: rgba(227, 186, 99, 0.7); }
  .avc-md-h3 { font-weight: 600; font-size: 11px; margin: 6px 0 3px; color: rgba(236, 234, 228, 0.65); }
  .avc-md-ul { margin: 4px 0 6px 16px; }
  .avc-md-ul li { margin-bottom: 3px; }
  .avc-md-code {
    font-family: ui-monospace, monospace; font-size: 11px;
    background: rgba(255,255,255,.06); padding: 1px 5px; border-radius: 4px;
  }
  .avc-agent-composer {
    flex-shrink: 0; padding: 10px 14px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
    background: transparent;
    transition: background 320ms ease, border-color 320ms ease;
  }
  .avc-agent-sidebar:hover .avc-agent-composer,
  .avc-agent-sidebar:focus-within .avc-agent-composer,
  .avc-agent-sidebar.avc-sidebar-active .avc-agent-composer {
    border-top-color: rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.12);
  }
  .avc-agent-chat-row { display: flex; gap: 6px; align-items: flex-end; }
  .avc-agent-chat-input {
    flex: 1; resize: none; min-height: 36px; max-height: 96px;
    padding: 8px 10px; font-size: 12px; line-height: 1.4;
    border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.18); color: rgba(248, 244, 236, 0.85);
    font-family: inherit;
  }
  .avc-agent-chat-input:focus {
    outline: none; border-color: rgba(227, 186, 99, 0.25);
    background: rgba(0, 0, 0, 0.22);
  }
  .avc-agent-chat-input::placeholder { color: rgba(236, 234, 228, 0.28); }
  .avc-agent-chat-send {
    padding: 0 12px; height: 36px; border-radius: 8px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(236, 234, 228, 0.78); font-size: 11px;
    transition: background 120ms; font-family: inherit;
  }
  .avc-agent-chat-send:hover { background: rgba(255, 255, 255, 0.1); }
  .avc-agent-chat-send:disabled { opacity: 0.35; cursor: default; }
  .avc-agent-foot {
    padding: 10px 14px; flex-shrink: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: none;
  }
  .avc-agent-foot.avc-active { display: block; }
  .avc-agent-buttons { display: flex; gap: 5px; margin-bottom: 6px; }
  .avc-agent-buttons button {
    flex: 1; border-radius: 6px; padding: 8px 4px 6px; cursor: pointer;
    border: 1px solid transparent; font-family: inherit; font-size: 13px;
    transition: filter 120ms, background 120ms;
  }
  .avc-agent-buttons button:hover { filter: brightness(1.1); }
  .avc-agent-buttons button span {
    display: block; font-size: 9px; margin-top: 2px;
    letter-spacing: 0.02em; opacity: 0.5;
  }
  .avc-agent-know {
    background: rgba(255,255,255,.04); color: rgba(236,234,228,.7);
    border-color: rgba(255,255,255,.1);
  }
  .avc-agent-learn { background: rgba(196, 85, 58, 0.65); color: rgba(255,255,255,.92); }
  .avc-agent-ignore {
    background: transparent; color: rgba(236,234,228,.35);
    border-color: rgba(255,255,255,.06);
  }
  .avc-agent-review-pass { background: rgba(61, 138, 99, 0.65); color: rgba(255,255,255,.92); }
  .avc-agent-review-fail {
    background: transparent; color: rgba(201,106,90,.75);
    border-color: rgba(201,106,90,.25);
  }
  .avc-agent-show-answer {
    width: 100%; margin-bottom: 10px; padding: 7px 12px;
    border-radius: 6px; border: 1px solid rgba(255,255,255,.1);
    background: transparent; color: rgba(236,234,228,.65);
    font-size: 12px; cursor: pointer; font-family: inherit;
  }
  .avc-agent-hint {
    font-size: 9px; color: rgba(236, 234, 228, 0.22);
    text-align: center; letter-spacing: 0.03em;
  }

  /* \u2500\u2500 Limit-reached sheet \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
     Centered over the video rather than tucked in the sidebar: hitting a cap
     is the one moment the learner has to be told something, and the sidebar
     is transparent until hovered. Backdrop takes clicks so the page can't be
     driven behind it, but Escape / the backdrop / "Not now" all dismiss. */
  .avc-agent-paywall {
    position: fixed; inset: 0; z-index: 12;
    display: flex; align-items: center; justify-content: center;
    padding: 24px; pointer-events: auto;
    background: rgba(6, 5, 8, 0.62);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    opacity: 0; transition: opacity 200ms ease;
  }
  .avc-agent-paywall.avc-visible { opacity: 1; }
  .avc-agent-paywall-card {
    width: min(440px, 100%); max-height: 100%; overflow-y: auto;
    padding: 26px 26px 22px; border-radius: 16px;
    background: rgba(14, 12, 17, 0.97);
    border: 1px solid rgba(227, 186, 99, 0.18);
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.6);
    color: rgba(240, 238, 232, 0.92);
    transform: translateY(8px) scale(0.985);
    transition: transform 220ms cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  .avc-agent-paywall.avc-visible .avc-agent-paywall-card {
    transform: translateY(0) scale(1);
  }
  .avc-agent-paywall-kicker {
    font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
    color: rgba(227, 186, 99, 0.7);
  }
  .avc-agent-paywall-title {
    margin-top: 8px; font-size: 19px; line-height: 1.3; font-weight: 600;
  }
  .avc-agent-paywall-body {
    margin-top: 8px; font-size: 13px; line-height: 1.55;
    color: rgba(236, 234, 228, 0.62);
  }
  .avc-agent-meter { margin-top: 16px; }
  .avc-agent-meter + .avc-agent-meter { margin-top: 10px; }
  .avc-agent-meter-row {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 8px; font-size: 11px; letter-spacing: 0.03em;
    color: rgba(236, 234, 228, 0.5);
  }
  .avc-agent-meter-val { color: rgba(236, 234, 228, 0.8); font-variant-numeric: tabular-nums; }
  .avc-agent-meter-track {
    margin-top: 6px; height: 5px; border-radius: 3px; overflow: hidden;
    background: rgba(255, 255, 255, 0.07);
  }
  .avc-agent-meter-fill {
    height: 100%; border-radius: 3px; background: rgba(227, 186, 99, 0.75);
    transition: width 320ms ease;
  }
  .avc-agent-meter-fill.avc-meter-full { background: rgba(201, 106, 90, 0.85); }
  .avc-agent-plans { margin-top: 20px; display: flex; flex-direction: column; gap: 9px; }
  .avc-agent-plan {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; width: 100%; text-align: left;
    padding: 12px 14px; border-radius: 10px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: inherit; font-family: inherit;
    transition: border-color 140ms, background 140ms, transform 140ms;
  }
  .avc-agent-plan:hover { background: rgba(255, 255, 255, 0.06); transform: translateY(-1px); }
  .avc-agent-plan:focus-visible { outline: 2px solid rgba(227, 186, 99, 0.6); outline-offset: 2px; }
  .avc-agent-plan.avc-plan-featured {
    border-color: rgba(227, 186, 99, 0.42);
    background: rgba(227, 186, 99, 0.09);
  }
  .avc-agent-plan-name { font-size: 13px; font-weight: 600; }
  .avc-agent-plan-perk {
    margin-top: 2px; font-size: 11px; line-height: 1.45;
    color: rgba(236, 234, 228, 0.55);
  }
  .avc-agent-plan-price {
    flex-shrink: 0; font-size: 13px; font-weight: 600;
    color: rgba(227, 186, 99, 0.92); white-space: nowrap;
  }
  .avc-agent-paywall-foot {
    margin-top: 16px; display: flex; align-items: center;
    justify-content: space-between; gap: 12px;
  }
  .avc-agent-paywall-note {
    font-size: 10.5px; line-height: 1.45; color: rgba(236, 234, 228, 0.35);
  }
  .avc-agent-paywall-dismiss {
    flex-shrink: 0; padding: 7px 14px; border-radius: 7px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.12); background: transparent;
    color: rgba(236, 234, 228, 0.62); font-size: 12px; font-family: inherit;
    transition: background 140ms, color 140ms;
  }
  .avc-agent-paywall-dismiss:hover {
    background: rgba(255, 255, 255, 0.06); color: rgba(240, 238, 232, 0.9);
  }

  @media (prefers-reduced-motion: reduce) {
    .avc-agent-ambient { transition: none; }
    .avc-agent-chat-msg.avc-streaming::after { animation: none; }
    .avc-agent-paywall,
    .avc-agent-paywall-card,
    .avc-agent-meter-fill { transition: none; }
  }
`;
  function mountHost() {
    let host3 = document.getElementById("avc-overlay-host");
    const parent = document.fullscreenElement || document.body;
    if (!host3) {
      host3 = document.createElement("div");
      host3.id = "avc-overlay-host";
      host3.style.cssText = "all:initial; position:fixed; inset:0; z-index:2147483647; pointer-events:none;";
      host3.setAttribute(UI_HOST_ATTR, "");
      host3.attachShadow({ mode: "open" });
    }
    if (host3.parentElement !== parent) parent.appendChild(host3);
    return host3.shadowRoot;
  }
  function pauseModeToInteraction(mode) {
    return mode === "pause" ? "focus" : "ambient";
  }
  function applyInteractionMode(interaction) {
    if (!shell) return;
    const focus = interaction === "focus";
    shell.ambient.className = focus ? "avc-agent-ambient avc-focus" : "avc-agent-ambient";
    shell.sidebar.classList.toggle("avc-focus-sidebar", focus);
  }
  function clampPanelWidth(w) {
    return Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, Math.round(w)));
  }
  var expandedWidth = PANEL_DEFAULT_W;
  function setPanelWidth(sidebar, w) {
    const clamped = clampPanelWidth(w);
    expandedWidth = clamped;
    sidebar.style.setProperty("--avc-panel-w", `${clamped}px`);
    sidebar.style.width = `${clamped}px`;
    if (!collapsed) sidebar.parentElement?.style.setProperty("--avc-panel-w", `${clamped}px`);
  }
  function setCollapsed(next, persist = true) {
    if (!shell) return;
    collapsed = next;
    shell.sidebar.classList.toggle("avc-collapsed", next);
    shell.collapseBtn.setAttribute("aria-expanded", String(!next));
    shell.rail.setAttribute("aria-expanded", String(!next));
    shell.sidebar.parentElement?.style.setProperty(
      "--avc-panel-w",
      `${next ? PANEL_RAIL_W : expandedWidth}px`
    );
    if (persist) void setAgentPanelCollapsed(next);
  }
  function attachResizeHandle(sidebar, grip) {
    let dragging = false;
    let startX = 0;
    let startW = 0;
    const onMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      sidebar.classList.add("avc-sidebar-active");
      setPanelWidth(sidebar, startW + (startX - e.clientX));
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      grip.classList.remove("avc-dragging");
      sidebar.classList.remove("avc-sidebar-active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const w = sidebar.offsetWidth;
      void setAgentPanelWidth(w);
    };
    grip.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      grip.classList.add("avc-dragging");
      sidebar.classList.add("avc-sidebar-active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }
  function wordDisplays(token, entry, displayScript, direction) {
    if (normalizeDirection(direction) === "ja-en") {
      return {
        big: token.surface || token.base,
        secondary: entry.reading || token.base
      };
    }
    const roma = toRomaji(entry.reading);
    if (displayScript === "kana") return { big: entry.reading, secondary: `${roma} \xB7 ${token.surface}` };
    if (displayScript === "kanji") return { big: token.surface, secondary: `${entry.reading} \xB7 ${roma}` };
    if (displayScript === "romaji-kana") {
      return {
        big: roma,
        kana: entry.reading,
        secondary: token.surface === entry.reading ? "" : token.surface
      };
    }
    const secondary = token.surface === entry.reading ? entry.reading : `${entry.reading} \xB7 ${token.surface}`;
    return { big: roma, secondary };
  }
  function showLookup(out, tk, entry) {
    out.textContent = "";
    out.style.display = "";
    const w = document.createElement("span");
    w.textContent = entry.reading && entry.reading !== tk.surface ? `${tk.surface}\uFF08${entry.reading}\uFF09` : tk.surface;
    w.style.fontWeight = "600";
    const g = document.createElement("span");
    g.textContent = " \u2014 " + entry.glosses.slice(0, 3).join("; ");
    g.style.opacity = "0.7";
    out.appendChild(w);
    out.appendChild(g);
  }
  function buildTappableJa(tokens, targetIndex, lookupOut) {
    const line = document.createElement("div");
    line.className = "avc-agent-ja-line";
    tokens.forEach((tk, idx) => {
      if (idx === targetIndex) {
        const m = document.createElement("mark");
        m.textContent = tk.surface;
        line.appendChild(m);
        return;
      }
      const entry = lookup(tk.base);
      if (entry) {
        const s = document.createElement("span");
        s.className = "avc-agent-tok";
        s.textContent = tk.surface;
        s.addEventListener("click", (e) => {
          e.stopPropagation();
          showLookup(lookupOut, tk, entry);
        });
        line.appendChild(s);
      } else {
        line.appendChild(document.createTextNode(tk.surface));
      }
    });
    return line;
  }
  function buildSentence(sentence, tokens, targetIndex, surface, displayScript, direction = "en-ja") {
    const el = document.createElement("div");
    el.className = "avc-agent-sentence";
    const label = document.createElement("span");
    label.className = "avc-agent-label";
    label.textContent = tokens?.length ? "In this line" : "Line";
    el.appendChild(label);
    if (tokens?.length) {
      const romajiSentence = displayScript === "romaji" || displayScript === "romaji-kana";
      if (normalizeDirection(direction) === "en-ja" && romajiSentence) {
        const pieces = sentencePieces(tokens, targetIndex ?? -1);
        const romajiLine = document.createElement("div");
        romajiLine.className = "avc-agent-romaji-line";
        pieces.forEach((p, idx) => {
          if (p.highlight) {
            const node = document.createElement("mark");
            node.textContent = p.text;
            romajiLine.appendChild(node);
          } else {
            romajiLine.appendChild(document.createTextNode(p.text));
          }
          if (idx < pieces.length - 1) romajiLine.appendChild(document.createTextNode(" "));
        });
        el.appendChild(romajiLine);
      }
      const lookupOut = document.createElement("div");
      lookupOut.className = "avc-agent-lookup";
      lookupOut.style.display = "none";
      el.appendChild(buildTappableJa(tokens, targetIndex, lookupOut));
      el.appendChild(lookupOut);
      return el;
    }
    const parts = sentence.split(surface);
    parts.forEach((part, idx) => {
      el.appendChild(document.createTextNode(part));
      if (idx < parts.length - 1) {
        const mark = document.createElement("mark");
        mark.textContent = surface;
        el.appendChild(mark);
      }
    });
    return el;
  }
  function limitKindFromError(error) {
    if (error === "quota_exceeded" || error === "ai_quota_exhausted") return "ai";
    if (error === "auto_quota_exhausted") return "auto";
    return null;
  }
  function coachErrorText(resp) {
    if (!resp || resp.ok) return "";
    if (resp.error === "not_linked" || resp.error === "unauthorized") return "Sign in at animevocab.com to use AI.";
    if (resp.error === "quota_exceeded" || resp.error === "ai_quota_exhausted") return "Monthly AI limit reached.";
    if (resp.error === "auto_quota_exhausted") return "Monthly word-picking limit reached.";
    if (resp.error === "ai_not_configured") return "AI is not configured on the server yet.";
    return "AI unavailable. Try again.";
  }
  function surfaceQuotaError(resp) {
    if (!resp || resp.ok) return;
    const kind = limitKindFromError(resp.error);
    if (kind) void reportLimitReached(kind);
  }
  function appendAiLine(out, label, body) {
    const l = document.createElement("div");
    l.className = "avc-agent-ai-label";
    l.textContent = label;
    const p = document.createElement("div");
    p.textContent = body;
    out.appendChild(l);
    out.appendChild(p);
  }
  function renderCoachOut(out, mode, resp) {
    out.textContent = "";
    out.classList.add("avc-visible");
    if (!resp?.ok) {
      out.textContent = coachErrorText(resp) || "AI unavailable.";
      return;
    }
    const r = resp.result || {};
    if (mode === "explain") {
      if (r.meaning) appendAiLine(out, "Meaning", r.meaning);
      if (r.nuance) appendAiLine(out, "In this scene", r.nuance);
      if (!r.meaning && !r.nuance) out.textContent = "No explanation returned.";
    } else if (Array.isArray(r.hooks) && r.hooks.length) {
      const ul = document.createElement("ul");
      ul.className = "avc-agent-ai-hooks";
      for (const h of r.hooks) {
        const li = document.createElement("li");
        li.textContent = h;
        ul.appendChild(li);
      }
      out.appendChild(ul);
    } else {
      out.textContent = "No hooks returned.";
    }
  }
  function appendChatBubble(log2, role, text, streaming = false) {
    const bubble = document.createElement("div");
    bubble.className = `avc-agent-chat-msg avc-${role}${streaming ? " avc-streaming" : ""}`;
    if (role === "user") {
      bubble.textContent = text;
    } else {
      const body = document.createElement("div");
      renderMarkdown(body, text);
      bubble.appendChild(body);
    }
    log2.appendChild(bubble);
    log2.scrollTop = log2.scrollHeight;
    return bubble;
  }
  function updateStreamBubble(bubble, text) {
    let body = bubble.querySelector(":scope > div");
    if (!body) {
      body = document.createElement("div");
      bubble.appendChild(body);
    }
    renderMarkdown(body, text);
    bubble.classList.add("avc-streaming");
    if (shell) shell.chatLog.scrollTop = shell.chatLog.scrollHeight;
  }
  function finishStreamBubble(bubble, text) {
    updateStreamBubble(bubble, text);
    bubble.classList.remove("avc-streaming");
  }
  function payloadFromCtx(ctx) {
    return {
      word: ctx.token.base,
      reading: ctx.entry.reading,
      gloss: ctx.entry.glosses[0] || "",
      line: ctx.sentence,
      level: ctx.entry.level,
      title: ctx.title,
      animeContext: ctx.options.animeContext ?? null,
      learnerLevel: ctx.options.learnerLevel ?? null,
      wordsKnown: ctx.options.wordsKnown ?? null,
      direction: normalizeDirection(ctx.options.learningDirection),
      course: course ? coursePrompt(course) : null
    };
  }
  function clearWordTimers() {
    autoTimer.clear();
    autoTimerMax.clear();
    for (const off of videoWatchers) off();
    videoWatchers = [];
    if (keyHandler) {
      window.removeEventListener("keydown", keyHandler, true);
      shell?.root.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
  }
  function resumeVideoIfNeeded() {
    const held = cardHold.release();
    if (held && held === activeVideo && wasPlaying && !userResumed && held.paused && !document.hidden) {
      held.play().catch(() => {
      });
    }
    activeVideo = null;
    wasPlaying = false;
    userResumed = false;
  }
  function finishWord(judgment) {
    const fn = wordResolve;
    wordPending = false;
    wordResolve = null;
    wordCtx = null;
    clearWordTimers();
    resumeVideoIfNeeded();
    if (shell) {
      shell.wordActive.classList.remove("avc-active");
      shell.wordIdle.style.display = "";
      shell.foot.classList.remove("avc-active");
      shell.buttons.textContent = "";
      shell.sidebar.classList.remove("avc-has-card");
    }
    currentJudgments = [];
    if (fn) fn(judgment);
  }
  function effectiveAutoDismissSec(opts2) {
    const configured = opts2.autoResumeSec ?? 0;
    if (configured > 0) return configured;
    return opts2.interaction === "focus" ? FOCUS_AUTO_DISMISS_SEC : AMBIENT_AUTO_DISMISS_SEC;
  }
  var CHAT_HOLD_RECHECK_MS = 5e3;
  function bumpAutoTimer(opts2) {
    const sec = effectiveAutoDismissSec(opts2);
    autoTimer.arm(sec * 1e3, () => dismissUnlessChatting(autoTimer));
    if (!autoTimerMax.armed) {
      const capSec = Math.max(sec + 10, 45);
      autoTimerMax.arm(capSec * 1e3, () => dismissUnlessChatting(autoTimerMax));
    }
  }
  function dismissUnlessChatting(timer) {
    if (isChatEngaged()) {
      timer.arm(CHAT_HOLD_RECHECK_MS, () => dismissUnlessChatting(timer));
      return;
    }
    finishWord("dismiss");
  }
  function isChatEngaged() {
    if (!shell || !mounted) return false;
    if (chatStreaming && Date.now() - chatStreamStartedAt < CHAT_STREAM_MAX_MS) return true;
    const since = Date.now() - chatActiveAt;
    if (since < CHAT_ENGAGED_MS) return true;
    return since < CHAT_DRAFT_HOLD_MS && shell.chatInput.value.trim() !== "";
  }
  function freezeAutoTimers() {
    autoTimer.freeze();
    autoTimerMax.freeze();
  }
  function thawAutoTimers() {
    autoTimer.thaw();
    autoTimerMax.thaw();
  }
  async function submitChat(question, about) {
    if (!shell || chatStreaming) return;
    const payload = about || chatPayload || {
      word: "general",
      line: "The learner is watching anime with Japanese subtitles.",
      gloss: "",
      title: null,
      course: course ? coursePrompt(course) : null
    };
    const text = (question ?? shell.chatInput.value).trim();
    if (!text) return;
    if (question === void 0) shell.chatInput.value = "";
    appendChatBubble(shell.chatLog, "user", text);
    chatHistory.push({ role: "user", content: text });
    shell.chatSend.disabled = true;
    shell.chatInput.disabled = true;
    chatStreaming = true;
    chatStreamStartedAt = chatActiveAt = Date.now();
    const streamBubble = appendChatBubble(shell.chatLog, "assistant", "", true);
    let full = "";
    let raf = 0;
    const flush = () => {
      raf = 0;
      updateStreamBubble(streamBubble, full);
    };
    try {
      const port = chrome.runtime.connect({ name: "avc-chat-stream" });
      let idleTimer = null;
      await new Promise((resolve, reject) => {
        const armIdle = () => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            try {
              port.disconnect();
            } catch {
            }
            if (full) resolve();
            else reject(new Error("timeout"));
          }, CHAT_STREAM_IDLE_MS);
        };
        armIdle();
        port.onMessage.addListener((msg) => {
          armIdle();
          if (msg.type === "chunk" && typeof msg.delta === "string") {
            full += msg.delta;
            if (!raf) raf = requestAnimationFrame(flush);
          } else if (msg.type === "error") {
            reject(new Error(msg.error || "stream_error"));
          } else if (msg.type === "done") {
            resolve();
          }
        });
        port.onDisconnect.addListener(() => {
          if (full) resolve();
          else reject(new Error(chrome.runtime.lastError?.message || "disconnected"));
        });
        port.postMessage({
          message: text,
          history: chatHistory.slice(0, -1),
          payload
        });
      }).finally(() => {
        if (idleTimer) clearTimeout(idleTimer);
      });
      if (raf) cancelAnimationFrame(raf);
      if (!full.trim()) {
        finishStreamBubble(streamBubble, coachErrorText({ ok: false, error: "openai_empty" }) || "No reply.");
      } else {
        finishStreamBubble(streamBubble, full);
        chatHistory.push({ role: "assistant", content: full });
      }
    } catch (err) {
      if (raf) cancelAnimationFrame(raf);
      if (full.trim()) {
        finishStreamBubble(streamBubble, full);
        chatHistory.push({ role: "assistant", content: full });
      } else {
        const msg = err instanceof Error ? err.message : "network";
        finishStreamBubble(streamBubble, coachErrorText({ ok: false, error: msg }) || "Network error.");
        surfaceQuotaError({ ok: false, error: msg });
      }
    } finally {
      chatStreaming = false;
      chatActiveAt = Date.now();
      if (shell) {
        shell.chatSend.disabled = false;
        shell.chatInput.disabled = false;
        shell.chatInput.focus();
      }
    }
  }
  async function askCoach(mode) {
    if (!shell || !wordCtx) return;
    shell.explainBtn.disabled = true;
    shell.hookBtn.disabled = true;
    shell.aiOut.classList.add("avc-visible");
    shell.aiOut.textContent = "Thinking\u2026";
    bumpAutoTimer(wordCtx.options);
    try {
      const resp = await chrome.runtime.sendMessage({
        type: "avc-coach",
        mode,
        payload: payloadFromCtx(wordCtx)
      });
      renderCoachOut(shell.aiOut, mode, resp);
      surfaceQuotaError(resp);
    } catch {
      shell.aiOut.textContent = "AI unavailable.";
      shell.aiOut.classList.add("avc-visible");
    } finally {
      shell.explainBtn.disabled = false;
      shell.hookBtn.disabled = false;
    }
  }
  function renderJudgmentButtons(ctx) {
    if (!shell) return;
    shell.buttons.textContent = "";
    shell.foot.classList.add("avc-active");
    let judgments;
    if (ctx.isReview) {
      judgments = [
        { cls: "avc-agent-review-pass", ja: "\u899A\u3048\u3066\u305F", en: "Got it", val: "review-pass", key: "1" },
        { cls: "avc-agent-review-fail", ja: "\u5FD8\u308C\u305F", en: "Forgot", val: "review-fail", key: "2" }
      ];
      shell.hint.textContent = "1 / 2 to judge";
    } else {
      judgments = [
        { cls: "avc-agent-know", ja: "\u77E5\u3063\u3066\u308B", en: "Know it", val: "know", key: "1" },
        { cls: "avc-agent-learn", ja: "\u5B66\u3076", en: "Learn", val: "learn", key: "2" },
        { cls: "avc-agent-ignore", ja: "\u7121\u8996", en: "Skip", val: "ignore", key: "3" }
      ];
      shell.hint.textContent = "1 / 2 / 3 to judge";
    }
    currentJudgments = judgments.map((j) => ({ val: j.val, key: j.key }));
    judgments.forEach((j) => {
      const btn = document.createElement("button");
      btn.className = j.cls;
      btn.innerHTML = `${j.ja}<span>${j.en}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        finishWord(j.val);
      });
      shell.buttons.appendChild(btn);
    });
  }
  function populateWordSection(ctx) {
    if (!shell) return;
    const { token, entry, sentence, isReview, options: opts2 } = ctx;
    const direction = normalizeDirection(opts2.learningDirection);
    const displayScript = opts2.displayScript || "romaji";
    shell.wordIdle.style.display = "none";
    shell.wordActive.classList.add("avc-active");
    shell.wordActive.textContent = "";
    shell.aiOut.classList.remove("avc-visible");
    shell.aiOut.textContent = "";
    chatHistory = [];
    shell.chatLog.textContent = "";
    chatPayload = payloadFromCtx(ctx);
    shell.chatInput.placeholder = chatPlaceholder(direction);
    const chip = document.createElement("div");
    chip.className = isReview ? "avc-agent-chip avc-agent-chip-review" : "avc-agent-chip";
    chip.textContent = isReview ? "Review" : `${isEssentialWord(token.base) ? "Essential \xB7 " : ""}${commonnessLabel(entry.level)} \xB7 #${entry.freqRank.toLocaleString()}${opts2.fromAudio ? " \xB7 heard" : ""}`;
    const displays = wordDisplays(token, entry, displayScript, direction);
    const wordRow = document.createElement("div");
    wordRow.className = "avc-agent-word-row";
    const wordEl = document.createElement("div");
    wordEl.className = "avc-agent-word";
    wordEl.textContent = displays.big;
    const speakText2 = entry.reading || token.reading || token.surface;
    const speakBtn = document.createElement("button");
    speakBtn.className = "avc-agent-speak";
    speakBtn.type = "button";
    speakBtn.textContent = "Hear word";
    speakBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      speak(speakText2);
    });
    wordRow.appendChild(wordEl);
    wordRow.appendChild(speakBtn);
    const kanaEl = displays.kana ? document.createElement("div") : null;
    if (kanaEl) {
      kanaEl.className = "avc-agent-word-kana";
      kanaEl.textContent = displays.kana;
    }
    const readingEl = document.createElement("div");
    readingEl.className = "avc-agent-reading";
    readingEl.textContent = displays.secondary;
    const hasSecondary = !!displays.secondary;
    if (!hasSecondary) readingEl.style.display = "none";
    const glossEl = document.createElement("div");
    glossEl.className = "avc-agent-gloss";
    glossEl.textContent = entry.glosses.join(" \xB7 ");
    shell.wordActive.appendChild(chip);
    shell.wordActive.appendChild(wordRow);
    if (kanaEl) shell.wordActive.appendChild(kanaEl);
    if (isReview) {
      readingEl.style.display = "none";
      glossEl.style.display = "none";
      if (kanaEl) kanaEl.style.display = "none";
      const showBtn = document.createElement("button");
      showBtn.className = "avc-agent-show-answer";
      showBtn.type = "button";
      showBtn.textContent = "Show answer";
      showBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (hasSecondary) readingEl.style.display = "";
        glossEl.style.display = "";
        if (kanaEl) kanaEl.style.display = "";
        showBtn.remove();
      });
      shell.wordActive.appendChild(showBtn);
    }
    shell.wordActive.appendChild(readingEl);
    shell.wordActive.appendChild(glossEl);
    if (opts2.contextEn) {
      const ctxEl = document.createElement("div");
      ctxEl.className = "avc-agent-context";
      const lbl = document.createElement("span");
      lbl.className = "avc-agent-label";
      lbl.textContent = contextSubtitleLabel(direction);
      ctxEl.appendChild(lbl);
      ctxEl.appendChild(document.createTextNode(opts2.contextEn));
      shell.wordActive.appendChild(ctxEl);
    }
    shell.wordActive.appendChild(
      buildSentence(sentence, opts2.tokens, opts2.targetIndex, token.surface, displayScript, direction)
    );
    renderJudgmentButtons(ctx);
    if (opts2.autoSpeak && opts2.interaction === "focus") {
      setTimeout(() => speak(entry.reading || token.reading || token.surface), 250);
    }
    bumpAutoTimer(opts2);
  }
  function buildShell(root2) {
    const layer = document.createElement("div");
    layer.className = "avc-agent-layer";
    const ambient = document.createElement("div");
    ambient.className = "avc-agent-ambient";
    const sidebar = document.createElement("div");
    sidebar.className = "avc-agent-sidebar";
    sidebar.setAttribute("role", "complementary");
    sidebar.setAttribute("aria-label", "AnimeVocab learning agent");
    const resize = document.createElement("div");
    resize.className = "avc-agent-resize";
    resize.setAttribute("aria-label", "Resize panel");
    resize.title = "Drag to resize";
    attachResizeHandle(sidebar, resize);
    const panel = document.createElement("div");
    panel.className = "avc-agent-panel";
    const head = document.createElement("div");
    head.className = "avc-agent-head";
    const brand = document.createElement("div");
    brand.className = "avc-agent-brand";
    brand.textContent = "AnimeVocab";
    const modeSelect = document.createElement("select");
    modeSelect.className = "avc-agent-mode-select";
    modeSelect.setAttribute("aria-label", "Learning mode");
    for (const [val, label] of [
      ["copilot", "Ambient"],
      ["pause", "Focus"],
      ["off", "Off"]
    ]) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      modeSelect.appendChild(opt);
    }
    modeSelect.addEventListener("change", async (e) => {
      e.stopPropagation();
      const mode = modeSelect.value;
      await setSettings({ pauseMode: mode });
      applyInteractionMode(pauseModeToInteraction(mode));
    });
    modeSelect.addEventListener("click", (e) => e.stopPropagation());
    const lensBtn = document.createElement("button");
    lensBtn.className = "avc-agent-lens-toggle";
    lensBtn.type = "button";
    lensBtn.textContent = "CC";
    lensBtn.setAttribute("aria-label", "Dual subtitles");
    lensBtn.setAttribute("aria-pressed", "true");
    lensBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void getSettings().then((s) => setSettings({ subLens: s.subLens === false }));
    });
    const closeBtn = document.createElement("button");
    closeBtn.className = "avc-agent-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close copilot");
    closeBtn.title = "Close copilot";
    closeBtn.textContent = "\xD7";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAgentByUser();
    });
    const collapseBtn = document.createElement("button");
    collapseBtn.className = "avc-agent-collapse";
    collapseBtn.type = "button";
    collapseBtn.setAttribute("aria-label", "Collapse copilot to a rail, keeping the current word");
    collapseBtn.setAttribute("aria-expanded", "true");
    collapseBtn.title = "Collapse to the edge (keeps the current word)";
    collapseBtn.textContent = "\u203A";
    collapseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setCollapsed(true);
    });
    const headActions = document.createElement("div");
    headActions.className = "avc-agent-head-actions";
    headActions.appendChild(lensBtn);
    headActions.appendChild(modeSelect);
    headActions.appendChild(collapseBtn);
    headActions.appendChild(closeBtn);
    head.appendChild(brand);
    head.appendChild(headActions);
    const scrollArea = document.createElement("div");
    scrollArea.className = "avc-agent-scroll";
    const courseBox = document.createElement("div");
    courseBox.className = "avc-course";
    courseBox.setAttribute("role", "region");
    courseBox.setAttribute("aria-label", "N5 course lesson");
    const wordIdle = document.createElement("div");
    wordIdle.className = "avc-agent-idle";
    wordIdle.innerHTML = "Watching. New words appear here.<br><strong>Ask anything</strong> in the chat below.";
    const wordActive = document.createElement("div");
    wordActive.className = "avc-agent-word-block";
    const ai = document.createElement("div");
    ai.className = "avc-agent-ai";
    const btns = document.createElement("div");
    btns.className = "avc-agent-ai-btns";
    const explainBtn = document.createElement("button");
    explainBtn.className = "avc-agent-ai-btn";
    explainBtn.type = "button";
    explainBtn.textContent = "Explain";
    const hookBtn = document.createElement("button");
    hookBtn.className = "avc-agent-ai-btn";
    hookBtn.type = "button";
    hookBtn.textContent = "Memory hooks";
    const aiOut = document.createElement("div");
    aiOut.className = "avc-agent-ai-out";
    explainBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void askCoach("explain");
    });
    hookBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void askCoach("hooks");
    });
    btns.appendChild(explainBtn);
    btns.appendChild(hookBtn);
    ai.appendChild(btns);
    ai.appendChild(aiOut);
    wordActive.appendChild(ai);
    const chat = document.createElement("div");
    chat.className = "avc-agent-chat";
    const chatLabel = document.createElement("div");
    chatLabel.className = "avc-agent-chat-label";
    chatLabel.textContent = "Copilot chat";
    const chatLog = document.createElement("div");
    chatLog.className = "avc-agent-chat-log";
    chat.appendChild(chatLabel);
    chat.appendChild(chatLog);
    scrollArea.appendChild(courseBox);
    scrollArea.appendChild(wordIdle);
    scrollArea.appendChild(wordActive);
    scrollArea.appendChild(chat);
    const foot = document.createElement("div");
    foot.className = "avc-agent-foot";
    const buttons = document.createElement("div");
    buttons.className = "avc-agent-buttons";
    const hint = document.createElement("div");
    hint.className = "avc-agent-hint";
    foot.appendChild(buttons);
    foot.appendChild(hint);
    const composer = document.createElement("div");
    composer.className = "avc-agent-composer";
    const chatRow = document.createElement("div");
    chatRow.className = "avc-agent-chat-row";
    const chatInput = document.createElement("textarea");
    chatInput.className = "avc-agent-chat-input";
    chatInput.rows = 1;
    chatInput.placeholder = "Ask about Japanese in this scene\u2026";
    const chatSend = document.createElement("button");
    chatSend.className = "avc-agent-chat-send";
    chatSend.type = "button";
    chatSend.textContent = "Send";
    chatSend.addEventListener("click", (e) => {
      e.stopPropagation();
      void submitChat();
    });
    chatInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void submitChat();
      }
    });
    chatInput.addEventListener("input", () => {
      chatActiveAt = Date.now();
    });
    chatInput.addEventListener("focus", () => {
      chatActiveAt = Date.now();
    });
    chatInput.addEventListener("click", (e) => e.stopPropagation());
    chatRow.appendChild(chatInput);
    chatRow.appendChild(chatSend);
    composer.appendChild(chatRow);
    panel.appendChild(head);
    panel.appendChild(scrollArea);
    panel.appendChild(foot);
    panel.appendChild(composer);
    const rail = document.createElement("div");
    rail.className = "avc-agent-rail";
    rail.setAttribute("role", "button");
    rail.setAttribute("tabindex", "0");
    rail.setAttribute("aria-label", "Expand AnimeVocab copilot");
    rail.setAttribute("aria-expanded", "true");
    rail.title = "Expand copilot";
    const railMark = document.createElement("span");
    railMark.className = "avc-agent-rail-mark";
    railMark.textContent = "AnimeVocab";
    const railOpen = document.createElement("span");
    railOpen.className = "avc-agent-rail-open";
    railOpen.textContent = "\u2039";
    rail.appendChild(railOpen);
    rail.appendChild(railMark);
    const expand = (e) => {
      e.stopPropagation();
      setCollapsed(false);
    };
    rail.addEventListener("click", expand);
    rail.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      expand(e);
    });
    sidebar.appendChild(resize);
    sidebar.appendChild(panel);
    sidebar.appendChild(rail);
    layer.appendChild(ambient);
    layer.appendChild(sidebar);
    root2.appendChild(layer);
    sidebar.addEventListener("click", (e) => e.stopPropagation());
    keepFocusOnMouseClick(root2);
    sidebar.addEventListener("dblclick", (e) => e.stopPropagation());
    document.addEventListener("fullscreenchange", () => {
      if (mounted) mountHost();
    });
    return {
      root: root2,
      ambient,
      sidebar,
      panel,
      modeSelect,
      lensBtn,
      wordSection: scrollArea,
      scrollArea,
      course: courseBox,
      wordIdle,
      wordActive,
      foot,
      buttons,
      hint,
      chatLog,
      chatInput,
      chatSend,
      aiOut,
      explainBtn,
      hookBtn,
      collapseBtn,
      rail
    };
  }
  function showToast(text, kind = "info", action) {
    if (!text) return;
    const root2 = mountHost();
    let layer = root2.getElementById("avc-toast-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "avc-toast-layer";
      layer.style.cssText = "position:fixed; top:16px; left:50%; transform:translateX(-50%);z-index:2147483647; display:flex; flex-direction:column; gap:8px;align-items:center; pointer-events:none;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;";
      root2.appendChild(layer);
    }
    const accent = kind === "error" ? "#f87171" : "#e3ba63";
    const toast = document.createElement("div");
    toast.style.cssText = `pointer-events:auto; max-width:min(380px, 92vw); padding:11px 14px; border-radius:10px;background:rgba(18,16,22,0.95); color:rgba(240,238,232,0.96); font-size:13px; line-height:1.45;border:1px solid ${accent}44; border-left:3px solid ${accent};box-shadow:0 10px 30px rgba(0,0,0,0.45); cursor:pointer;backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);opacity:0; transform:translateY(-6px); transition:opacity 180ms ease, transform 180ms ease;`;
    toast.textContent = text;
    if (action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.style.cssText = `display:block; margin-top:9px; padding:5px 11px; border-radius:7px; cursor:pointer;border:1px solid ${accent}; background:transparent; color:${accent};font:inherit; font-size:12px; font-weight:600;`;
      btn.addEventListener("click", () => action.onClick());
      toast.appendChild(btn);
    }
    layer.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-6px)";
      setTimeout(() => toast.remove(), 200);
    };
    toast.addEventListener("click", remove);
    setTimeout(remove, 6500);
  }
  var limitShown = /* @__PURE__ */ new Set();
  var paywallEl = null;
  var paywallKeyHandler = null;
  var paywallRoot = null;
  function planLabel(plan) {
    if (plan === "max") return "Max";
    if (plan === "pro") return "Pro";
    return "Free";
  }
  function hoursLabel(minutes) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  function buildMeter(label, used, limit, unit) {
    const wrap = document.createElement("div");
    wrap.className = "avc-agent-meter";
    const row = document.createElement("div");
    row.className = "avc-agent-meter-row";
    const name = document.createElement("span");
    name.textContent = label;
    const val = document.createElement("span");
    val.className = "avc-agent-meter-val";
    val.textContent = unit === "minutes" ? `${hoursLabel(Math.min(used, limit))} / ${hoursLabel(limit)}` : `${Math.min(used, limit).toLocaleString()} / ${limit.toLocaleString()}`;
    row.appendChild(name);
    row.appendChild(val);
    const track = document.createElement("div");
    track.className = "avc-agent-meter-track";
    const fill = document.createElement("div");
    const pct = limit > 0 ? Math.min(100, Math.round(used / limit * 100)) : 0;
    fill.className = pct >= 100 ? "avc-agent-meter-fill avc-meter-full" : "avc-agent-meter-fill";
    fill.style.width = `${pct}%`;
    track.appendChild(fill);
    wrap.appendChild(row);
    wrap.appendChild(track);
    return wrap;
  }
  function limitCopy(kind, usage) {
    const plan = planLabel(usage?.plan || "free");
    if (kind === "listening") {
      const hours = usage?.listening ? hoursLabel(usage.listening.limit) : "this month's";
      return {
        title: "Listening Mode is out of hours",
        body: `You've used all ${hours} of Listening Mode on ${plan} this month. Subtitle capture, reviews and your saved words all keep working \u2014 only live audio transcription is paused.`
      };
    }
    if (kind === "auto") {
      return {
        title: "Smart word picking is paused",
        body: `You've used this month's ${plan} allowance for automatic word picking and pronunciation audio. AnimeVocab falls back to its offline picker and your browser's voice, so cards keep coming \u2014 they're just less finely chosen.`
      };
    }
    const limit = usage?.ai ? usage.ai.limit.toLocaleString() : "this month's";
    return {
      title: "You're out of AI messages",
      body: `That's all ${limit} coach explanations, memory hooks and chat replies on ${plan} for this month. Everything else \u2014 cards, reviews, Listening Mode \u2014 keeps working.`
    };
  }
  function buildPlanButton(tier, featured) {
    if (!tier.checkoutUrl) return null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = featured ? "avc-agent-plan avc-plan-featured" : "avc-agent-plan";
    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "avc-agent-plan-name";
    name.textContent = tier.name;
    const perk = document.createElement("div");
    perk.className = "avc-agent-plan-perk";
    perk.textContent = `${tier.aiCallsPerMonth.toLocaleString()} AI messages \xB7 ${hoursLabel(tier.listeningMinutes)} Listening`;
    left.appendChild(name);
    left.appendChild(perk);
    const price = document.createElement("div");
    price.className = "avc-agent-plan-price";
    price.textContent = tier.priceLabel;
    btn.appendChild(left);
    btn.appendChild(price);
    btn.addEventListener("click", () => {
      trackExtensionEvent("upgrade_prompt_clicked");
      trackExtensionEvent("checkout_started");
      void trackPro("pro_prompt_clicked", "ext_limit_sheet");
      void trackPro("pro_checkout_started", "ext_limit_sheet");
      chrome.runtime.sendMessage({ type: "avc-open-url", url: tier.checkoutUrl }).catch(() => {
      });
      dismissLimitSheet();
    });
    return btn;
  }
  function dismissLimitSheet() {
    if (paywallKeyHandler) {
      window.removeEventListener("keydown", paywallKeyHandler, true);
      paywallRoot?.removeEventListener("keydown", paywallKeyHandler);
      paywallKeyHandler = null;
      paywallRoot = null;
    }
    const el = paywallEl;
    if (!el) return;
    paywallEl = null;
    el.classList.remove("avc-visible");
    setTimeout(() => el.remove(), 220);
  }
  function showLimitSheet(kind, usage) {
    const root2 = mountHost();
    if (!root2.querySelector("style")) root2.innerHTML = `<style>${STYLES}</style>`;
    dismissLimitSheet();
    const overlay = document.createElement("div");
    overlay.className = "avc-agent-paywall";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Monthly limit reached");
    const card = document.createElement("div");
    card.className = "avc-agent-paywall-card";
    card.addEventListener("click", (e) => e.stopPropagation());
    const kicker = document.createElement("div");
    kicker.className = "avc-agent-paywall-kicker";
    kicker.textContent = `${planLabel(usage?.plan || "free")} plan \xB7 monthly limit`;
    const copy = limitCopy(kind, usage);
    const title = document.createElement("div");
    title.className = "avc-agent-paywall-title";
    title.textContent = copy.title;
    const body = document.createElement("div");
    body.className = "avc-agent-paywall-body";
    body.textContent = copy.body;
    card.appendChild(kicker);
    card.appendChild(title);
    card.appendChild(body);
    if (usage) {
      const all = {
        ai: ["AI messages", usage.ai, "calls"],
        auto: ["Word picking & audio", usage.auto, "calls"],
        listening: ["Listening Mode", usage.listening, "minutes"]
      };
      const order = [kind, ...["ai", "auto", "listening"].filter((k) => k !== kind)];
      for (const k of order) {
        const [label, m, unit] = all[k];
        if (m && m.limit > 0) card.appendChild(buildMeter(label, m.used, m.limit, unit));
      }
    }
    const upgrades = [];
    if (usage?.tiers) {
      if (usage.plan === "free") {
        const pro = buildPlanButton(usage.tiers.pro, true);
        if (pro) upgrades.push(pro);
      }
      if (usage.plan === "free" || usage.plan === "pro") {
        const max = buildPlanButton(usage.tiers.max, usage.plan === "pro");
        if (max) upgrades.push(max);
      }
    }
    if (upgrades.length) {
      trackExtensionEvent("upgrade_prompt_shown");
      void trackPro("pro_prompt_shown", "ext_limit_sheet");
      const plans = document.createElement("div");
      plans.className = "avc-agent-plans";
      for (const u of upgrades) plans.appendChild(u);
      card.appendChild(plans);
    }
    const foot = document.createElement("div");
    foot.className = "avc-agent-paywall-foot";
    const note = document.createElement("div");
    note.className = "avc-agent-paywall-note";
    note.textContent = upgrades.length ? "Cancel anytime. Your saved words stay yours either way." : "Your allowance resets at the start of next month.";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "avc-agent-paywall-dismiss";
    dismiss.textContent = "Not now";
    dismiss.addEventListener("click", dismissLimitSheet);
    foot.appendChild(note);
    foot.appendChild(dismiss);
    card.appendChild(foot);
    overlay.appendChild(card);
    overlay.addEventListener("click", dismissLimitSheet);
    root2.appendChild(overlay);
    paywallEl = overlay;
    paywallKeyHandler = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      dismissLimitSheet();
    };
    window.addEventListener("keydown", paywallKeyHandler, true);
    paywallRoot = root2;
    root2.addEventListener("keydown", paywallKeyHandler);
    requestAnimationFrame(() => overlay.classList.add("avc-visible"));
    dismiss.focus();
  }
  async function reportLimitReached(kind) {
    if (limitShown.has(kind)) return false;
    limitShown.add(kind);
    let usage = null;
    try {
      const res = await chrome.runtime.sendMessage({ type: "avc-usage" });
      if (res?.ok && res.usage) usage = res.usage;
    } catch {
    }
    showLimitSheet(kind, usage);
    return true;
  }
  var visibilityListener = null;
  function onAgentVisibility(listener) {
    visibilityListener = listener;
  }
  function announceVisibility(open) {
    try {
      visibilityListener?.(open);
    } catch {
    }
  }
  function ensureAgentMounted() {
    const root2 = mountHost();
    if (!root2.querySelector("style")) {
      root2.innerHTML = `<style>${STYLES}</style>`;
    }
    if (mounted && shell) return;
    shell = buildShell(root2);
    collapsed = false;
    mounted = true;
    renderCourse();
    preloadVoices();
    announceVisibility(true);
    void Promise.all([getSettings(), getAgentPanelWidth(), getAgentPanelCollapsed()]).then(
      ([s, w, collapsed2]) => {
        if (!shell) return;
        applyPanelSettings(s);
        setPanelWidth(shell.sidebar, w || PANEL_DEFAULT_W);
        if (collapsed2) setCollapsed(true, false);
      }
    );
  }
  function applyPanelSettings(s) {
    if (!shell) return;
    shell.modeSelect.value = s.pauseMode;
    if (!wordPending) applyInteractionMode(pauseModeToInteraction(s.pauseMode));
    const lensOn = normalizeDirection(s.learningDirection) === "en-ja" && s.subLens !== false;
    shell.lensBtn.setAttribute("aria-pressed", String(lensOn));
    shell.lensBtn.title = lensOn ? "Dual subtitles on (romaji + English) \u2014 click to hide them and just listen" : "Dual subtitles off \u2014 click to show romaji + English";
    shell.lensBtn.hidden = normalizeDirection(s.learningDirection) !== "en-ja";
  }
  function setCourse(next, actions) {
    const changed = next?.id !== course?.id;
    course = next;
    courseActions = next ? actions : null;
    if (changed) courseMoment = null;
    if (chatPayload) chatPayload = { ...chatPayload, course: course ? coursePrompt(course) : null };
    renderCourse();
    if (shell) void getSettings().then(applyPanelSettings);
  }
  function courseHeard(wordIds, line) {
    if (!course || !wordIds.length) return;
    course = { ...course, heard: [.../* @__PURE__ */ new Set([...course.heard, ...wordIds])] };
    courseMoment = { wordIds, line };
    renderCourse();
  }
  function renderCourse() {
    if (!shell) return;
    const box = shell.course;
    box.replaceChildren();
    box.classList.toggle("avc-active", !!course);
    shell.wordIdle.innerHTML = course ? "Listening along with your lesson.<br>Unit words light up when they're spoken. <strong>Ask anything</strong> below." : "Watching. New words appear here.<br><strong>Ask anything</strong> in the chat below.";
    if (!course) return;
    const lesson = course;
    const el = (tag2, cls, text) => {
      const node = document.createElement(tag2);
      node.className = cls;
      if (text !== void 0) node.textContent = text;
      return node;
    };
    const ja = lesson.script === "kana" ? "ja" : "";
    const top = el("div", "avc-course-top");
    const tag = [lesson.unit ? `N5 \xB7 Unit ${lesson.unit}` : "N5 course", lesson.episode ? `Episode ${lesson.episode.number}` : ""].filter(Boolean).join(" \xB7 ");
    top.appendChild(el("span", "avc-course-tag", tag));
    const link = el("button", "avc-course-link", "Lesson \u2197");
    link.type = "button";
    link.title = "Open this lesson on animevocab.com";
    link.addEventListener("click", (e) => {
      e.stopPropagation();
      courseActions?.openLesson();
    });
    top.appendChild(link);
    box.appendChild(top);
    box.appendChild(el("div", "avc-course-goal", lesson.canDo));
    const words = el("div", "avc-course-words");
    for (const w of lesson.words) {
      const heard = lesson.heard.includes(w.id);
      const chip = el("span", "avc-course-word" + (heard ? " avc-heard" : "") + (courseMoment?.wordIds.includes(w.id) ? " avc-just" : ""), (heard ? "\u2713 " : "") + w.reading);
      if (ja) chip.lang = ja;
      chip.title = w.meaning;
      words.appendChild(chip);
    }
    box.appendChild(words);
    const count = lesson.words.filter((w) => lesson.heard.includes(w.id)).length;
    box.appendChild(el("div", "avc-course-count", `Heard ${count} of ${lesson.words.length} unit words \xB7 saved to your account`));
    if (courseMoment) {
      const moment = el("div", "avc-course-moment");
      moment.setAttribute("aria-live", "polite");
      const heardWords = lesson.words.filter((w) => courseMoment.wordIds.includes(w.id));
      const said = el("div", "");
      said.append("Heard ");
      heardWords.forEach((w, i) => {
        if (i) said.append(", ");
        const b = el("strong", "", w.reading);
        if (ja) b.lang = ja;
        said.append(b, ` (${w.meaning})`);
      });
      moment.appendChild(said);
      const q = el("q", "", courseMoment.line);
      q.lang = "ja";
      moment.appendChild(q);
      const explain = el("button", "avc-course-btn", "Explain this line");
      explain.type = "button";
      const line = courseMoment.line;
      explain.addEventListener("click", (e) => {
        e.stopPropagation();
        const first = heardWords[0];
        void submitChat(`Explain this line for my unit: ${line}`, {
          word: first ? first.kana || first.reading : line.slice(0, 20),
          reading: first?.reading,
          gloss: first?.meaning || "",
          line,
          title: null,
          course: coursePrompt(lesson)
        });
      });
      moment.appendChild(explain);
      box.appendChild(moment);
    }
    if (lesson.episode) {
      const finish = el("button", "avc-course-btn avc-course-finish", `Finish episode ${lesson.episode.number} \xB7 practise`);
      finish.type = "button";
      const status = el("div", "avc-course-status");
      status.setAttribute("aria-live", "polite");
      finish.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!courseActions) return;
        finish.disabled = true;
        status.textContent = "Saving and opening practice\u2026";
        courseActions.finish().then(
          () => {
            status.textContent = "Practice opened in a new tab.";
          },
          (err) => {
            status.textContent = err instanceof Error ? err.message : "Please try again.";
          }
        ).finally(() => {
          finish.disabled = false;
        });
      });
      box.appendChild(finish);
      box.appendChild(status);
    }
  }
  var closedByUser = false;
  function closeAgentByUser() {
    closedByUser = true;
    hideAgent();
  }
  function openAgent() {
    closedByUser = false;
    ensureAgentMounted();
  }
  function isClosedByUser() {
    return closedByUser;
  }
  function hideAgent() {
    if (wordPending) finishWord("dismiss");
    chatHistory = [];
    chatPayload = null;
    const host3 = document.getElementById("avc-overlay-host");
    if (host3) host3.remove();
    shell = null;
    const was = mounted;
    mounted = false;
    if (was) announceVisibility(false);
  }
  function isAgentActive() {
    return mounted;
  }
  function isOpen() {
    return wordPending;
  }
  function dismissAgent() {
    if (wordPending) finishWord("dismiss");
  }
  function showAgentPanel(target, sentence, video, options) {
    ensureAgentMounted();
    return presentWord(target, sentence, video, options);
  }
  function presentWord(target, sentence, video, options) {
    ensureAgentMounted();
    if (wordPending) finishWord("dismiss");
    const ctx = {
      token: target.token,
      entry: target.entry,
      sentence,
      title: options.title || null,
      isReview: target.isReview,
      options
    };
    wasPlaying = !!(video && !video.paused && !video.ended);
    activeVideo = video;
    userResumed = false;
    if (options.interaction === "focus" && wasPlaying && video && !collapsed && !document.hidden) {
      cardHold.hold(video, () => video.pause());
    }
    if (video) {
      const on = (type, fn) => {
        video.addEventListener(type, fn);
        videoWatchers.push(() => video.removeEventListener(type, fn));
      };
      on("play", () => {
        userResumed = true;
        cardHold.noticePlay(video.paused);
        thawAutoTimers();
      });
      on("pause", () => {
        if (cardHold.noticePause()) return;
        freezeAutoTimers();
      });
      on("seeking", () => cardHold.noticeSeek(video.paused));
      on("seeked", () => cardHold.noticeSeek(video.paused));
      if (video.paused && !cardHold.owned()) freezeAutoTimers();
      if (document.hidden) freezeAutoTimers();
      const onVisibility = () => {
        if (document.hidden) {
          freezeAutoTimers();
          return;
        }
        if (!video.paused || cardHold.owned()) thawAutoTimers();
      };
      document.addEventListener("visibilitychange", onVisibility);
      videoWatchers.push(() => document.removeEventListener("visibilitychange", onVisibility));
    }
    wordCtx = ctx;
    wordPending = true;
    populateWordSection(ctx);
    shell?.sidebar.classList.add("avc-has-card");
    applyInteractionMode(options.interaction);
    keyHandler = (e) => {
      if (!wordPending) return;
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingEvent(e)) return;
      const match = currentJudgments.find((j) => j.key === e.key);
      if (match) {
        e.preventDefault();
        e.stopPropagation();
        finishWord(match.val);
      }
    };
    window.addEventListener("keydown", keyHandler, true);
    shell?.root.addEventListener("keydown", keyHandler);
    return new Promise((resolve) => {
      wordResolve = resolve;
    });
  }

  // src/lib/anime-context-client.ts
  var sessionCache2 = /* @__PURE__ */ new Map();
  async function requestAnimeContext(title) {
    const clean = (title || "").trim();
    if (!clean) return null;
    const cached = sessionCache2.get(clean.toLowerCase());
    if (cached) return cached;
    try {
      const res = await chrome.runtime.sendMessage({
        type: "avc-anime-context",
        title: clean
      });
      const ctx = (res?.context || "").trim();
      if (ctx) sessionCache2.set(clean.toLowerCase(), ctx);
      return ctx || null;
    } catch {
      return null;
    }
  }
  function peekAnimeContext(title) {
    const clean = (title || "").trim();
    if (!clean) return null;
    return sessionCache2.get(clean.toLowerCase()) || null;
  }

  // src/lib/pick-target.ts
  function countProgress(vocab) {
    let n = 0;
    for (const rec of Object.values(vocab)) {
      if (rec.state === "known" || rec.state === "learning") n++;
    }
    return n;
  }
  async function pickTargetSmart(tokens, wordStates, settings, targetedSet, line, title, overlay) {
    const direction = normalizeDirection(settings.learningDirection);
    const { dueReview, newWords } = collectEligible(
      tokens,
      wordStates,
      targetedSet,
      direction,
      overlay
    );
    if (dueReview) return dueReview;
    if (!newWords.length) return null;
    if (newWords.length === 1) return newWords[0];
    const candidates = newWords.slice(0, 12).map(({ token, entry }) => ({
      word: token.base,
      reading: entry.reading,
      gloss: entry.glosses[0] || "",
      level: entry.level,
      essential: direction === "ja-en" ? !!ENGLISH_ESSENTIALS[token.base] : isEssentialWord(token.base)
    }));
    const ai = await requestWordPick({
      line,
      candidates,
      learnerLevel: settings.targetLevel,
      wordsKnown: countProgress(wordStates),
      title,
      animeContext: peekAnimeContext(title),
      direction
    });
    if (ai.ok && ai.word) {
      const match = newWords.find((t) => t.token.base === ai.word || t.token.surface === ai.word);
      if (match) return match;
    }
    if (!ai.ok && ai.error === "auto_quota_exhausted") {
      void reportLimitReached("auto");
    }
    return pickTargetHeuristic(newWords, wordStates, settings);
  }

  // src/lib/dual-line.ts
  var PUNCT = {
    "\u3002": ".",
    "\u3001": ",",
    "\uFF01": "!",
    "\uFF1F": "?",
    "!": "!",
    "?": "?",
    "\u2026": "\u2026",
    "\u2025": "\u2026",
    "\u30FB": " ",
    "\u300C": "\u201C",
    "\u300D": "\u201D",
    "\u300E": "\u201C",
    "\u300F": "\u201D",
    "\uFF08": "(",
    "\uFF09": ")",
    "\u301C": "~",
    "\uFF5E": "~",
    "\u30FC": "-",
    "\u2015": "-"
  };
  var HONORIFICS = /* @__PURE__ */ new Set(["\u3055\u3093", "\u3061\u3083\u3093", "\u304F\u3093", "\u541B", "\u69D8", "\u3055\u307E", "\u5148\u8F29", "\u305B\u3093\u3071\u3044", "\u5148\u751F", "\u305B\u3093\u305B\u3044", "\u6BBF", "\u6C0F"]);
  var COPULA = /* @__PURE__ */ new Set(["\u3067\u3059", "\u3060"]);
  var OPENING = /* @__PURE__ */ new Set(["\u201C", "(", "\u300C", "\u300E", "\uFF08"]);
  function isPunct(t) {
    return t.pos === "\u8A18\u53F7" || /^[\s。、！？!?…‥・「」『』（）〜～ー―.,]+$/.test(t.surface);
  }
  function joins(t, prev) {
    if (!prev || isPunct(prev)) return false;
    const inflecting = prev.pos === "\u52D5\u8A5E" || prev.pos === "\u5F62\u5BB9\u8A5E" || prev.pos === "\u52A9\u52D5\u8A5E";
    if (t.pos === "\u52A9\u52D5\u8A5E") return inflecting && (!COPULA.has(t.base) || prev.pos === "\u52D5\u8A5E" && /[んい]$/.test(prev.surface));
    if (t.pos === "\u52D5\u8A5E" && t.pos1 === "\u975E\u81EA\u7ACB" && /^(て|で|ちゃ|じゃ|と|ど)/.test(t.surface)) return inflecting;
    if (t.pos === "\u52A9\u8A5E" && t.pos1 === "\u63A5\u7D9A\u52A9\u8A5E") return inflecting && /^(て|で|ば|ちゃ|じゃ)$/.test(t.surface);
    if (t.pos === "\u52D5\u8A5E" && t.pos1 === "\u63A5\u5C3E") return true;
    if (t.pos === "\u540D\u8A5E" && t.pos1 === "\u63A5\u5C3E") return true;
    if (t.pos === "\u540D\u8A5E" && t.pos1 === "\u975E\u81EA\u7ACB" && t.surface === "\u3093") return inflecting;
    return false;
  }
  function kanaOf(t, override, script) {
    if (override) return override;
    if (/^[\u3041-\u3096\u30a1-\u30faー]+$/.test(t.surface)) return script === "kana" ? t.surface : kataToHira(t.surface);
    return t.reading || t.surface;
  }
  function romajiOf(kana, head, single) {
    if (single && head.pos === "\u52A9\u8A5E") {
      if (head.surface === "\u306F") return "wa";
      if (head.surface === "\u3078") return "e";
    }
    const r = toRomaji(kana);
    return head.pos1 === "\u56FA\u6709\u540D\u8A5E" ? r.charAt(0).toUpperCase() + r.slice(1) : r;
  }
  function dualPieces(tokens, script, readings = {}) {
    if (script === "kanji") {
      return tokens.map((t, i) => ({ text: t.surface, token: isPunct(t) ? -1 : i, tokens: [i], attached: true }));
    }
    const groups = [];
    let opening = "";
    tokens.forEach((t, i) => {
      const last = groups[groups.length - 1];
      if (isPunct(t)) {
        for (const c of t.surface) {
          const mark = (script === "romaji" ? PUNCT[c] ?? c : c).trim();
          if (!mark) continue;
          if (OPENING.has(mark)) opening += mark;
          else if (last) last.after += mark;
          else groups.push({ head: -1, members: [i], kana: "", suffix: "", before: "", after: mark });
        }
        return;
      }
      if (readings[String(i)] === "" && last && last.head >= 0 && !last.after) {
        last.members.push(i);
        return;
      }
      const kana = kanaOf(t, readings[String(i)], script);
      const open = last && last.head >= 0 && !last.after && !opening;
      if (open && t.pos === "\u540D\u8A5E" && t.pos1 === "\u63A5\u5C3E" && HONORIFICS.has(t.surface)) {
        last.suffix += kana;
        last.members.push(i);
        return;
      }
      if (open && !last.suffix && joins(t, tokens[i - 1])) {
        last.kana += kana;
        last.members.push(i);
        return;
      }
      groups.push({ head: i, members: [i], kana, suffix: "", before: opening, after: "" });
      opening = "";
    });
    if (opening && groups.length) groups[groups.length - 1].after += opening;
    return groups.map((g, n) => {
      if (g.head < 0) return { text: g.after, token: -1, tokens: g.members, attached: true };
      const head = tokens[g.head];
      const word = script === "romaji" ? romajiOf(g.kana, head, g.members.length === 1) + (g.suffix ? "-" + toRomaji(g.suffix) : "") : g.kana + g.suffix;
      return { text: g.before + word + g.after, token: g.head, tokens: g.members, attached: n === 0 };
    });
  }
  function displayTexts(pieces, script) {
    if (script !== "romaji") return pieces.map((p) => p.text);
    let sentenceStart = true;
    return pieces.map((p) => {
      const text = sentenceStart ? p.text.replace(/^([^A-Za-z]*)([a-z])/, (_m, a, b) => a + b.toUpperCase()) : p.text;
      if (/[A-Za-z]/.test(p.text)) sentenceStart = false;
      if (/[.!?…][\u201d")]*$/.test(p.text)) sentenceStart = true;
      return text;
    });
  }

  // src/lib/gloss-link.ts
  var GLOSS_STOP = /* @__PURE__ */ new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "onto",
    "one",
    "ones",
    "thing",
    "things",
    "person",
    "someone",
    "something",
    "esp",
    "etc",
    "very",
    "not",
    "non",
    "out",
    "off",
    "away",
    "become",
    "becoming",
    "make",
    "making",
    "used",
    "usually",
    "often",
    "form",
    "state"
  ]);
  function glossWords(gloss) {
    return gloss.toLowerCase().replace(/\(.*?\)/g, " ").split(/[^a-z']+/).filter((w) => w.length >= 3 && !GLOSS_STOP.has(w));
  }
  function buildGlossIndex(tokens, lookupFn) {
    const index = /* @__PURE__ */ new Map();
    tokens.forEach((tk, i) => {
      const entry = lookupFn(tk.base);
      if (!entry) return;
      for (const gloss of entry.glosses.slice(0, 3)) {
        for (const word of glossWords(gloss)) {
          const lemma = lemmatize(word);
          if (!index.has(lemma)) index.set(lemma, i);
        }
      }
    });
    return index;
  }
  function linkEnglishWord(word, index) {
    const clean = word.toLowerCase().replace(/[^a-z']/g, "");
    if (clean.length < 3) return -1;
    const lemma = lemmatize(clean);
    for (const candidate of [clean, lemma, lemma + "e"]) {
      const idx = index.get(candidate);
      if (idx !== void 0) return idx;
    }
    return -1;
  }

  // src/lib/sub-lens.ts
  var AUTO_HIDE_MS = 12e3;
  var CLEAR_GRACE_MS = 250;
  var POINTER_LEAVE_DELAY_MS = 150;
  var PEEK_INTENT_MS = 250;
  var RESUME_DELAY_MS = 220;
  var STYLES2 = `
  :host { all: initial; }
  .lens {
    position: fixed; left: 0; top: 0; z-index: 2147483644;
    display: flex; flex-direction: column; align-items: center;
    pointer-events: none;
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif;
    opacity: 0; transition: opacity 160ms ease;
  }
  .lens.on { opacity: 1; }
  /* Plain subtitles, the way the player draws its own: white text with a dark
     outline that reads on any scene, no box. The two lines read as one
     subtitle. */
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    max-width: 100%;
    padding: 4px 12px;
    animation: lens-in 150ms ease-out;
  }
  @keyframes lens-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  .line {
    max-width: 100%;
    color: #fff;
    text-align: center;
    text-wrap: balance;
    text-shadow:
      0 0 2px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.95),
      0 1px 3px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.5);
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
  }
  .line.jp {
    font-size: clamp(20px, 2.5vw, 34px); font-weight: 600; line-height: 1.45;
    letter-spacing: 0.01em;
  }
  .line.jp.romaji { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .line.en {
    font-size: clamp(16px, 1.9vw, 26px); font-weight: 500; line-height: 1.35;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    animation: lens-in 150ms ease-out;
  }
  /* Words carry no colour of their own; hovering one lights it up. */
  .tok {
    pointer-events: auto; cursor: pointer; border-radius: 5px;
    padding: 0 2px;
    transition: background-color 90ms ease;
  }
  .tok:hover, .tok.linked-hot { background-color: rgba(255, 255, 255, 0.22); }
  .tip {
    position: fixed; z-index: 2; pointer-events: auto;
    min-width: 230px; max-width: 340px;
    padding: 12px 14px 12px; border-radius: 14px;
    background: rgba(20, 20, 20, 0.96);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
    color: rgba(246, 244, 239, 0.96); text-align: left;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    display: none;
  }
  .tip.on { display: block; animation: lens-in 120ms ease-out; }
  .tip-word {
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif;
    font-size: 24px; font-weight: 700; line-height: 1.25;
  }
  .tip-reading { font-size: 13px; color: rgba(255, 255, 255, 0.72); margin-top: 3px; }
  .tip-gloss { font-size: 13.5px; line-height: 1.45; margin-top: 8px; color: rgba(246, 244, 239, 0.9); }
  .tip-meta { font-size: 11px; color: rgba(236, 234, 228, 0.5); margin-top: 8px;
    display: flex; gap: 8px; align-items: center; }
  .tip-state { color: rgba(255, 255, 255, 0.8); }
  .tip-actions { display: flex; gap: 6px; margin-top: 11px; }
  .tip-btn {
    flex: 1; padding: 6px 8px; border-radius: 9px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05); color: rgba(246, 244, 239, 0.9);
    font-size: 12px; font-family: inherit; transition: background 120ms, border-color 120ms;
    white-space: nowrap;
  }
  .tip-btn:hover { background: rgba(255, 255, 255, 0.1); }
  .tip-btn.primary {
    border-color: #fff; background: #fff;
    color: #111; font-weight: 600;
  }
  .tip-btn.primary:hover { background: rgba(255, 255, 255, 0.85); }
  .tip-btn kbd {
    font-family: ui-monospace, monospace; font-size: 10px; opacity: .6;
    border: 1px solid rgba(236,234,228,.25); border-radius: 4px; padding: 0 3px;
    margin-left: 5px;
  }
  .tip-saved { color: rgba(255, 255, 255, 0.85); font-size: 12px;
    margin-top: 10px; font-weight: 600; }
  .tip-link { font-size: 11px; color: rgba(236, 234, 228, 0.55); margin-top: 4px; }
`;
  var host = null;
  var root = null;
  var lensEl = null;
  var tipEl = null;
  var opts = null;
  var vocabSnapshot = {};
  var hover = null;
  var hideTimer = null;
  var pointerLeaveTimer = null;
  var resumeTimer = null;
  var positionTimer = null;
  var clearTimer = null;
  var peekTimer = null;
  function cancelPeekIntent() {
    if (peekTimer) {
      clearTimeout(peekTimer);
      peekTimer = null;
    }
  }
  var peekHold = new PlaybackHold();
  var watchedVideo = null;
  var unwatch = null;
  var keysBound = false;
  var currentLine = "";
  var judgmentsInFlight = /* @__PURE__ */ new Set();
  var shown = null;
  function ensureMounted() {
    const parent = document.fullscreenElement || document.body;
    if (host && host.parentElement === parent) return;
    if (!host) {
      host = document.createElement("div");
      host.setAttribute("data-avc-sub-lens", "");
      host.setAttribute(UI_HOST_ATTR, "");
      root = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = STYLES2;
      root.appendChild(style);
      lensEl = document.createElement("div");
      lensEl.className = "lens";
      lensEl.addEventListener("mouseenter", onLensEnter);
      lensEl.addEventListener("mouseleave", onLensLeave);
      root.appendChild(lensEl);
      tipEl = document.createElement("div");
      tipEl.className = "tip";
      tipEl.addEventListener("mouseenter", onLensEnter);
      tipEl.addEventListener("mouseleave", onLensLeave);
      root.appendChild(tipEl);
      root.addEventListener("keydown", onKeyDown);
      keepFocusOnMouseClick(root);
      document.addEventListener("fullscreenchange", ensureMounted);
    }
    parent.appendChild(host);
  }
  var placedFor = "";
  var baseline = 0.76;
  function setLensBaseline(fraction) {
    if (fraction === baseline) return;
    baseline = fraction;
    placedFor = "";
    position();
  }
  function position() {
    if (!lensEl || !opts) return;
    const video = opts.getVideo();
    if (!video) return;
    const r = video.getBoundingClientRect();
    if (r.width < 200 || r.height < 120) return;
    const key = `${r.left}:${r.top}:${r.width}:${r.height}`;
    if (key === placedFor) return;
    placedFor = key;
    lensEl.style.left = `${r.left + r.width / 2}px`;
    lensEl.style.top = `${r.top + r.height * baseline}px`;
    lensEl.style.transform = "translate(-50%, -100%)";
    lensEl.style.maxWidth = `${Math.max(280, r.width * 0.86)}px`;
  }
  function armAutoHide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (hover) {
        armAutoHide();
        return;
      }
      lensEl?.classList.remove("on");
      currentLine = "";
    }, AUTO_HIDE_MS);
  }
  function cancelPendingClear() {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
  }
  function clearLensLine() {
    if (!currentLine || clearTimer) return;
    clearTimer = setTimeout(function tryClear() {
      if (hover) {
        clearTimer = setTimeout(tryClear, CLEAR_GRACE_MS);
        return;
      }
      clearTimer = null;
      lensEl?.classList.remove("on");
      currentLine = "";
    }, CLEAR_GRACE_MS);
  }
  function endLensLine() {
    if (!currentLine) return;
    if (hover) {
      clearLensLine();
      return;
    }
    cancelPendingClear();
    lensEl?.classList.remove("on");
    currentLine = "";
  }
  function watchVideo(video) {
    if (!video || video === watchedVideo) return;
    unwatch?.();
    watchedVideo = video;
    const onPause = () => {
      peekHold.noticePause();
    };
    const onPlay = () => peekHold.noticePlay(video.paused);
    const onSeek = () => peekHold.noticeSeek(video.paused);
    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);
    video.addEventListener("seeking", onSeek);
    video.addEventListener("seeked", onSeek);
    unwatch = () => {
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("seeking", onSeek);
      video.removeEventListener("seeked", onSeek);
      unwatch = null;
      watchedVideo = null;
    };
  }
  function releasePeekPause() {
    const video = peekHold.release();
    if (video && video.paused) video.play().catch(() => {
    });
  }
  function onLensEnter() {
    if (pointerLeaveTimer) {
      clearTimeout(pointerLeaveTimer);
      pointerLeaveTimer = null;
    }
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
    if (!opts?.peekPause || peekTimer || peekHold.owned()) return;
    peekTimer = setTimeout(() => {
      peekTimer = null;
      if (!opts?.peekPause) return;
      const video = opts.getVideo();
      watchVideo(video);
      if (video && !video.paused) {
        peekHold.hold(video, () => video.pause());
      }
    }, PEEK_INTENT_MS);
  }
  function onLensLeave() {
    cancelPeekIntent();
    if (pointerLeaveTimer) clearTimeout(pointerLeaveTimer);
    pointerLeaveTimer = setTimeout(() => {
      pointerLeaveTimer = null;
      hideTip();
      if (!peekHold.owned()) return;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        releasePeekPause();
      }, RESUME_DELAY_MS);
    }, POINTER_LEAVE_DELAY_MS);
  }
  function stateLabel(base) {
    const rec = vocabSnapshot[base];
    if (!rec) return "";
    if (rec.state === "learning") return "Learning";
    if (rec.state === "known") return "Known";
    return "";
  }
  function hideTip() {
    hover = null;
    tipEl?.classList.remove("on");
  }
  function showTip(ctx, linkedFrom) {
    if (!tipEl) return;
    hover = ctx;
    const { meta } = ctx;
    const romaji = meta.reading ? toRomaji(meta.reading) : "";
    const state = stateLabel(ctx.base);
    tipEl.innerHTML = "";
    const word = document.createElement("div");
    word.className = "tip-word";
    word.textContent = ctx.base;
    tipEl.appendChild(word);
    if (meta.reading && meta.reading !== ctx.base) {
      const reading = document.createElement("div");
      reading.className = "tip-reading";
      reading.textContent = romaji ? `${meta.reading} \xB7 ${romaji}` : meta.reading;
      tipEl.appendChild(reading);
    }
    if (linkedFrom) {
      const link = document.createElement("div");
      link.className = "tip-link";
      link.textContent = `\u201C${linkedFrom}\u201D in the English line \u21A9`;
      tipEl.appendChild(link);
    }
    const gloss = document.createElement("div");
    gloss.className = "tip-gloss";
    gloss.textContent = meta.gloss;
    tipEl.appendChild(gloss);
    const metaRow = document.createElement("div");
    metaRow.className = "tip-meta";
    const freq = document.createElement("span");
    freq.textContent = commonnessLabel(meta.level);
    metaRow.appendChild(freq);
    if (state) {
      const st = document.createElement("span");
      st.className = "tip-state";
      st.textContent = state;
      metaRow.appendChild(st);
    }
    tipEl.appendChild(metaRow);
    const rec = vocabSnapshot[ctx.base];
    if (rec && (rec.state === "learning" || rec.state === "known")) {
      const saved = document.createElement("div");
      saved.className = "tip-saved";
      saved.textContent = rec.state === "learning" ? "\u2713 In your deck" : "\u2713 Marked known";
      tipEl.appendChild(saved);
    } else {
      const actions = document.createElement("div");
      actions.className = "tip-actions";
      const mkBtn = (label, key, judgment, primary) => {
        const b = document.createElement("button");
        b.className = primary ? "tip-btn primary" : "tip-btn";
        b.innerHTML = `${label}<kbd>${key}</kbd>`;
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          void judgeHovered(judgment);
        });
        actions.appendChild(b);
      };
      mkBtn("\u5B66\u3076 Learn", "Q", "learn", true);
      mkBtn("\u77E5\u3063\u3066\u308B Know", "K", "know", false);
      mkBtn("\u7121\u8996 Skip", "X", "ignore", false);
      tipEl.appendChild(actions);
    }
    const tr = ctx.el.getBoundingClientRect();
    tipEl.classList.add("on");
    const tw = tipEl.offsetWidth || 260;
    const th = tipEl.offsetHeight || 140;
    const left = Math.max(8, Math.min(window.innerWidth - tw - 8, tr.left + tr.width / 2 - tw / 2));
    const top = Math.max(8, tr.top - th - 10);
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  }
  async function judgeHovered(judgment) {
    const ctx = hover;
    if (!ctx || judgmentsInFlight.has(ctx.base)) return;
    judgmentsInFlight.add(ctx.base);
    try {
      opts?.onJudgeStart?.();
      await judgeWord(ctx.base, judgment, ctx.meta, ctx.source);
      const state = judgment === "learn" ? "learning" : judgment === "know" ? "known" : "ignored";
      vocabSnapshot = { ...vocabSnapshot, [ctx.base]: { ...vocabSnapshot[ctx.base] || {}, state } };
      ctx.el.classList.remove("new", "learning");
      if (judgment === "learn") ctx.el.classList.add("saved");
      if (hover === ctx && ctx.el.isConnected) showTip(ctx);
      opts?.onJudged?.();
      log("sub-lens saved:", ctx.base, judgment);
    } catch (err) {
      warn("sub-lens save failed:", err);
    } finally {
      judgmentsInFlight.delete(ctx.base);
    }
  }
  function onKeyDown(e) {
    if (!hover || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingEvent(e)) return;
    const key = e.key.toLowerCase();
    const judgment = key === "q" ? "learn" : key === "k" ? "know" : key === "x" ? "ignore" : null;
    if (!judgment) return;
    e.preventDefault();
    e.stopPropagation();
    void judgeHovered(judgment);
  }
  function tokenClass(base) {
    const rec = vocabSnapshot[base];
    if (!rec || rec.state === "new") return "new";
    if (rec.state === "learning") return "learning";
    return "";
  }
  function paintEnglish(en) {
    if (!shown) return;
    const { tokens, pieces, source } = shown;
    source.en = en;
    const glossIndex = buildGlossIndex(tokens, lookup);
    const enLine = document.createElement("div");
    enLine.className = "line en";
    for (const piece of en.split(/(\s+)/)) {
      const idx = /\s/.test(piece) ? -1 : linkEnglishWord(piece, glossIndex);
      const jpSpan = idx >= 0 ? pieces.find((p) => p.piece.tokens.includes(idx))?.el ?? null : null;
      const token = idx >= 0 ? tokens[idx] : null;
      const entry = token ? lookup(token.base) : null;
      if (!token || !entry) {
        enLine.appendChild(document.createTextNode(piece));
        continue;
      }
      const s = document.createElement("span");
      s.className = "tok";
      s.textContent = piece;
      const ctx = {
        base: token.base,
        meta: {
          reading: entry.reading || token.reading,
          gloss: entry.glosses.slice(0, 3).join("; "),
          level: entry.level,
          freqRank: entry.freqRank
        },
        source,
        el: s
      };
      s.addEventListener("mouseenter", () => {
        jpSpan?.classList.add("linked-hot");
        showTip(ctx, piece);
      });
      s.addEventListener("mouseleave", () => jpSpan?.classList.remove("linked-hot"));
      s.addEventListener("click", (e) => {
        e.stopPropagation();
        showTip(ctx, piece);
        void judgeHovered("learn");
      });
      enLine.appendChild(s);
    }
    if (shown.enEl) shown.enEl.replaceWith(enLine);
    else shown.card.appendChild(enLine);
    shown.enEl = enLine;
    placedFor = "";
    position();
  }
  function updateLensLine(text, update) {
    if (!shown || shown.text !== text || currentLine !== text) return;
    if (update.readings && Object.keys(update.readings).length && shown.script !== "kanji") {
      const fixed = dualPieces(shown.tokens, shown.script, { ...update.readings, ...shown.readings });
      if (fixed.length === shown.pieces.length) {
        const texts = displayTexts(fixed, shown.script);
        fixed.forEach((piece, n) => {
          const slot = shown.pieces[n];
          slot.piece = piece;
          slot.el.textContent = texts[n];
        });
      }
    }
    if (update.en) paintEnglish(update.en);
  }
  function showLensLine(text, en, tokens, vocab, options) {
    opts = options;
    vocabSnapshot = vocab;
    cancelPendingClear();
    if (text === currentLine) return;
    currentLine = text;
    ensureMounted();
    if (!lensEl) return;
    hideTip();
    lensEl.innerHTML = "";
    const source = { title: options.getTitle(), line: text, en: en || null };
    const script = options.script ?? "kanji";
    const card = document.createElement("div");
    card.className = "card";
    const jpLine = document.createElement("div");
    jpLine.className = `line jp${script === "romaji" ? " romaji" : ""}`;
    if (script !== "romaji") jpLine.lang = "ja";
    const pieces = dualPieces(tokens, script, options.readings);
    const texts = displayTexts(pieces, script);
    const rendered = [];
    pieces.forEach((piece, n) => {
      if (n > 0 && !piece.attached && script !== "kanji") jpLine.appendChild(document.createTextNode(" "));
      const tk = piece.token >= 0 ? tokens[piece.token] : null;
      const entry = tk ? lookup(tk.base) : null;
      const s = document.createElement("span");
      s.textContent = texts[n];
      rendered.push({ piece, el: s });
      if (!tk || !entry) {
        jpLine.appendChild(s);
        return;
      }
      s.className = `tok ${tokenClass(tk.base)}`.trim();
      const ctx = {
        base: tk.base,
        meta: {
          reading: entry.reading || tk.reading,
          gloss: entry.glosses.slice(0, 3).join("; "),
          level: entry.level,
          freqRank: entry.freqRank
        },
        source,
        el: s
      };
      s.addEventListener("mouseenter", () => showTip(ctx));
      s.addEventListener("click", (e) => {
        e.stopPropagation();
        showTip(ctx);
        void judgeHovered("learn");
      });
      jpLine.appendChild(s);
    });
    card.appendChild(jpLine);
    shown = { text, tokens, script, source, card, pieces: rendered, enEl: null, readings: options.readings ?? {} };
    if (en) paintEnglish(en);
    lensEl.appendChild(card);
    placedFor = "";
    position();
    lensEl.classList.add("on");
    armAutoHide();
    if (!positionTimer) positionTimer = setInterval(position, 500);
    if (!keysBound) {
      keysBound = true;
      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("blur", () => {
        cancelPeekIntent();
        hideTip();
        releasePeekPause();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          cancelPeekIntent();
          hideTip();
          peekHold.forfeit();
        }
      });
    }
  }
  function hideLens() {
    currentLine = "";
    cancelPendingClear();
    cancelPeekIntent();
    if (pointerLeaveTimer) {
      clearTimeout(pointerLeaveTimer);
      pointerLeaveTimer = null;
    }
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
    hideTip();
    lensEl?.classList.remove("on");
    releasePeekPause();
  }

  // src/lib/netflix-tracks.ts
  var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  function decode(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  }
  function ttmlTime(expr, base) {
    if (!expr) return NaN;
    const s = expr.trim();
    let m = /^(\d+(?:\.\d+)?)(h|m|s|ms|f|t)$/.exec(s);
    if (m) {
      const n = parseFloat(m[1]);
      return m[2] === "h" ? n * 3600 : m[2] === "m" ? n * 60 : m[2] === "s" ? n : m[2] === "ms" ? n / 1e3 : m[2] === "f" ? n / base.frameRate : n / base.tickRate;
    }
    m = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+)|:(\d+(?:\.\d+)?))?$/.exec(s);
    if (m) {
      const secs = +m[1] * 3600 + +m[2] * 60 + +m[3];
      if (m[4]) return secs + parseFloat("0." + m[4]);
      if (m[5]) return secs + parseFloat(m[5]) / base.frameRate;
      return secs;
    }
    return NaN;
  }
  function attrs(raw) {
    const out = {};
    for (const m of raw.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = decode(m[3] ?? m[4] ?? "");
    return out;
  }
  var local = (name) => name.slice(name.indexOf(":") + 1);
  function attr(a, name) {
    for (const [k, v] of Object.entries(a)) if (local(k) === name) return v;
    return void 0;
  }
  function parseTtml(xml) {
    const head = /<tt\b([^>]*)>/.exec(xml);
    const ttAttrs = head ? attrs(head[1]) : {};
    const frameRate = parseFloat(attr(ttAttrs, "frameRate") || "30") || 30;
    const mult = (attr(ttAttrs, "frameRateMultiplier") || "1 1").split(/\s+/).map(Number);
    const base = {
      tickRate: parseFloat(attr(ttAttrs, "tickRate") || "") || frameRate * (mult[0] / (mult[1] || 1)),
      frameRate: frameRate * (mult[0] / (mult[1] || 1))
    };
    const styleRuby = /* @__PURE__ */ new Map();
    for (const m of xml.matchAll(/<(?:[\w-]+:)?style\b([^>]*)\/?>/g)) {
      const a = attrs(m[1]);
      const id = attr(a, "id");
      const ruby = attr(a, "ruby");
      if (id && ruby) styleRuby.set(id, ruby);
    }
    const body = xml.slice(xml.search(/<(?:[\w-]+:)?body\b/) >= 0 ? xml.search(/<(?:[\w-]+:)?body\b/) : 0);
    const cues = [];
    for (const p of body.matchAll(/<(?:[\w-]+:)?p\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?p>/g)) {
      const a = attrs(p[1]);
      const start = ttmlTime(attr(a, "begin"), base);
      let end = ttmlTime(attr(a, "end"), base);
      if (!Number.isFinite(end)) end = start + (ttmlTime(attr(a, "dur"), base) || 0);
      if (!Number.isFinite(start) || !(end > start)) continue;
      const stack = [];
      let text = "";
      let rubyBase = "";
      let rubyText = "";
      const ruby = [];
      for (const t of p[2].matchAll(/<(\/?)([\w:.-]+)([^>]*?)(\/?)>|([^<]+)/g)) {
        if (t[5] !== void 0) {
          const chunk = decode(t[5]).replace(/\s+/g, " ");
          const role = [...stack].reverse().find((r) => r) ?? "";
          if (role === "text" || role === "textContainer") rubyText += chunk;
          else if (role === "delimiter") continue;
          else {
            text += chunk;
            if (role === "base" || role === "baseContainer") rubyBase += chunk;
          }
          continue;
        }
        const name = local(t[2]);
        if (name === "br") {
          text += " ";
          continue;
        }
        if (name !== "span") continue;
        if (t[1]) {
          const role = stack.pop();
          if (role === "container" && rubyBase.trim() && rubyText.trim()) {
            ruby.push([rubyBase.trim(), rubyText.trim()]);
            rubyBase = rubyText = "";
          }
        } else {
          const sa = attrs(t[3]);
          const role = attr(sa, "ruby") ?? styleRuby.get((attr(sa, "style") ?? "").split(/\s+/)[0]) ?? "";
          if (!t[4]) stack.push(role);
          if (role === "container") rubyBase = rubyText = "";
        }
      }
      const clean = text.replace(/\s+/g, " ").trim();
      if (clean) cues.push({ start, end, text: clean, ruby });
    }
    return cues.sort((x, y) => x.start - y.start);
  }
  function parseVtt(vtt) {
    const cues = [];
    const time = (s) => {
      const m = /^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/.exec(s.trim());
      return m ? +(m[1] || 0) * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1e3 : NaN;
    };
    for (const block of vtt.replace(/\r/g, "").split(/\n{2,}/)) {
      const lines = block.split("\n");
      const at = lines.findIndex((l) => l.includes("-->"));
      if (at < 0) continue;
      const [a, b] = lines[at].split("-->");
      const start = time(a), end = time(b);
      if (!Number.isFinite(start) || !(end > start)) continue;
      const raw = lines.slice(at + 1).join(" ");
      const ruby = [];
      for (const m of raw.matchAll(/<ruby>([\s\S]*?)<rt>([\s\S]*?)<\/rt>\s*<\/ruby>/g)) {
        const written = decode(m[1].replace(/<[^>]+>/g, "")).trim();
        const reading = decode(m[2].replace(/<[^>]+>/g, "")).trim();
        if (written && reading) ruby.push([written, reading]);
      }
      const text = decode(raw.replace(/<rt>[\s\S]*?<\/rt>/g, "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
      if (text) cues.push({ start, end, text, ruby });
    }
    return cues.sort((x, y) => x.start - y.start);
  }
  function parseTimedText(text) {
    return /^﻿?WEBVTT/.test(text) ? parseVtt(text) : parseTtml(text);
  }
  function cueAt(cues, t) {
    let lo = 0, hi = cues.length - 1, found = -1;
    while (lo <= hi) {
      const mid = lo + hi >> 1;
      if (cues[mid].start <= t) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    for (let i = found; i >= 0 && i > found - 4; i--) if (t < cues[i].end) return i;
    return -1;
  }
  function englishFor(ja, en) {
    return ja.map((cue) => {
      const len = cue.end - cue.start;
      const parts = en.filter((e) => {
        const overlap = Math.min(e.end, cue.end) - Math.max(e.start, cue.start);
        return overlap > 0 && (overlap >= 0.4 * len || overlap >= 0.4 * (e.end - e.start));
      });
      return parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim();
    });
  }
  function chunkOrder(chunks, current2) {
    const now = Math.min(Math.max(current2, 0), Math.max(chunks - 1, 0));
    const out = [];
    for (let i = now; i < chunks; i++) out.push(i);
    for (let i = now - 1; i >= 0; i--) out.push(i);
    return out;
  }

  // src/lib/episode-subs.ts
  var CHUNK = 20;
  var PARALLEL = 4;
  var EpisodeSubs = class {
    constructor(cues, englishTrack, title, send) {
      this.cues = cues;
      this.title = title;
      this.send = send;
      /** Furigana and names: as written → reading. */
      this.glossary = /* @__PURE__ */ new Map();
      this.queue = [];
      this.running = 0;
      this.waiters = /* @__PURE__ */ new Map();
      this.stopped = false;
      this.lastError = null;
      for (const cue of cues) for (const [written, reading] of cue.ruby) this.glossary.set(written, reading);
      if (englishTrack && englishTrack.length) {
        this.source = "track";
        this.english = englishFor(cues, englishTrack);
        this.chunks = [];
      } else {
        this.source = "translation";
        this.english = cues.map(() => null);
        this.chunks = Array.from({ length: Math.ceil(cues.length / CHUNK) }, () => "idle");
      }
    }
    /** The English for cue `i` if it is known now. */
    englishAt(i) {
      return this.english[i] ?? null;
    }
    /** The English for cue `i` once it is known; null if it could not be had. */
    whenEnglish(i) {
      const now = this.english[i];
      if (now !== null && now !== void 0) return Promise.resolve(now);
      if (this.source === "track" || this.chunks[Math.floor(i / CHUNK)] === "failed" || this.stopped) return Promise.resolve(null);
      return new Promise((resolve) => {
        const list = this.waiters.get(i) ?? [];
        list.push(resolve);
        this.waiters.set(i, list);
        this.translateFrom(i);
      });
    }
    /** Translate from cue `i` onwards (then what came before). Cheap to call
     * on every cue: it only reorders what is still waiting. */
    translateFrom(i) {
      if (this.source === "track" || this.stopped) return;
      const order = chunkOrder(this.chunks.length, Math.floor(Math.max(i, 0) / CHUNK));
      this.queue = order.filter((c) => this.chunks[c] === "idle");
      while (this.running < PARALLEL && this.queue.length) this.runNext();
    }
    /** Chunks translated so far, of all. */
    progress() {
      return { done: this.chunks.filter((c) => c === "done").length, total: this.chunks.length };
    }
    /** Stop asking (another video, or the account is out of lines). */
    stop() {
      this.stopped = true;
      this.queue = [];
      for (const [i, list] of this.waiters) for (const resolve of list) resolve(this.english[i] ?? null);
      this.waiters.clear();
    }
    runNext() {
      const chunk = this.queue.shift();
      if (chunk === void 0 || this.chunks[chunk] !== "idle") return;
      this.chunks[chunk] = "loading";
      this.running++;
      const from = chunk * CHUNK;
      const lines = this.cues.slice(from, from + CHUNK).map((c) => c.text);
      const context = this.cues.slice(Math.max(0, from - 3), from).map((c) => c.text);
      this.send({ title: this.title, lines, context }).then((res) => {
        if (res?.ok && res.result.en.length === lines.length) {
          this.chunks[chunk] = "done";
          res.result.en.forEach((en, k) => this.settle(from + k, en));
          for (const [written, reading] of Object.entries(res.result.names)) {
            if (!this.glossary.has(written)) this.glossary.set(written, reading);
          }
        } else {
          this.fail(chunk, res && !res.ok ? res.error : "no_response");
        }
      }, () => this.fail(chunk, "network")).finally(() => {
        this.running--;
        if (!this.stopped) while (this.running < PARALLEL && this.queue.length) this.runNext();
      });
    }
    settle(i, en) {
      this.english[i] = en;
      const list = this.waiters.get(i);
      if (!list) return;
      this.waiters.delete(i);
      for (const resolve of list) resolve(en);
    }
    fail(chunk, error) {
      this.chunks[chunk] = "failed";
      this.lastError = error;
      if (/quota|not_linked|unauthorized/.test(error)) this.stop();
      const from = chunk * CHUNK;
      for (let i = from; i < from + CHUNK; i++) {
        const list = this.waiters.get(i);
        if (!list) continue;
        this.waiters.delete(i);
        for (const resolve of list) resolve(null);
      }
    }
  };
  function glossaryReadings(tokens, glossary) {
    const readings = {};
    if (!glossary.size) return readings;
    for (let i = 0; i < tokens.length; i++) {
      let joined = "";
      for (let j = i; j < Math.min(tokens.length, i + 4); j++) {
        joined += tokens[j].surface;
        const reading = glossary.get(joined);
        if (reading && /[㐀-鿿]/.test(joined)) {
          readings[String(i)] = reading;
          for (let k = i + 1; k <= j; k++) readings[String(k)] = "";
          i = j;
          break;
        }
        if (joined.length > 12) break;
      }
    }
    return readings;
  }

  // src/lib/subs-client.ts
  var MAX_REMEMBERED = 400;
  var KANJI = /[㐀-䶿一-鿿]/;
  function wordsToRead(tokens) {
    const out = [];
    tokens.forEach((t, i) => {
      if (KANJI.test(t.surface) && t.surface.length <= 20 && out.length < 40) out.push({ i, s: t.surface });
    });
    return out;
  }
  var SubTranslator = class {
    constructor(send) {
      this.send = send;
      this.lines = /* @__PURE__ */ new Map();
      this.recent = [];
      /** Why the last request failed, so the caller can say so once. */
      this.lastError = null;
    }
    /** The translation of `line`, from memory or the network; null if there is none. */
    translate(line, tokens, title) {
      const hit = this.lines.get(line);
      if (hit) {
        this.lines.delete(line);
        this.lines.set(line, hit);
        return hit;
      }
      const context = this.recent.slice(-3);
      this.recent = [...this.recent.filter((l) => l !== line), line].slice(-6);
      const pending = this.send({ line, context, title, words: wordsToRead(tokens) }).then(
        (res) => {
          if (res?.ok) {
            this.lastError = null;
            return res.result;
          }
          this.lastError = res?.error ?? "no_response";
          if (!/quota|not_linked|unauthorized/.test(this.lastError)) this.lines.delete(line);
          return null;
        },
        () => {
          this.lines.delete(line);
          this.lastError = "network";
          return null;
        }
      );
      this.lines.set(line, pending);
      while (this.lines.size > MAX_REMEMBERED) this.lines.delete(this.lines.keys().next().value);
      return pending;
    }
    /** Already answered, without asking: for painting a line that is due now. */
    peek(line) {
      return this.lines.get(line);
    }
    clear() {
      this.lines.clear();
      this.recent = [];
    }
  };

  // src/lib/subtitle-history.ts
  var MAX_ENTRIES = 300;
  var SubtitleHistory = class {
    constructor() {
      this.entries = [];
    }
    /** Note what is on screen at video time `t` (seconds). */
    record(t, text) {
      if (!Number.isFinite(t)) return;
      const last = this.entries[this.entries.length - 1];
      if (last && t < last.t) {
        this.entries = this.entries.filter((e) => e.t <= t);
      }
      const tail = this.entries[this.entries.length - 1];
      if (tail && tail.text === text) return;
      this.entries.push({ t, text });
      if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    /**
     * The subtitle for speech that began at `t`: the one on screen then, or —
     * when the screen was blank at that instant, since a subtitle often appears
     * a beat after the voice — the first one shown within `lookahead` seconds.
     * `null` when `t` is outside what was sampled, so the caller can fall back.
     */
    textAt(t, lookahead = 1.5) {
      if (!this.entries.length || !Number.isFinite(t) || t < this.entries[0].t) return null;
      let i = this.entries.length - 1;
      while (i > 0 && this.entries[i].t > t) i--;
      if (this.entries[i].text) return this.entries[i].text;
      for (let j = i + 1; j < this.entries.length && this.entries[j].t <= t + lookahead; j++) {
        if (this.entries[j].text) return this.entries[j].text;
      }
      return "";
    }
    /** Whether any line sampled so far passes `test`. */
    some(test) {
      return this.entries.some((e) => !!e.text && test(e.text));
    }
    clear() {
      this.entries = [];
    }
  };

  // src/lib/adapters/util.ts
  function coalesce(fn, ms) {
    let timer = null;
    return () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    };
  }
  function normalize(text) {
    return text.replace(/\s+/g, " ").trim();
  }
  var CUE_SEPARATOR_TAG = /<\s*\/?\s*(?:br|p|div)\b[^>]*>/gi;
  var CUE_INLINE_TAG = /<[^>]+>/g;
  function stripCueTags(text) {
    return text.replace(CUE_SEPARATOR_TAG, " ").replace(CUE_INLINE_TAG, "");
  }
  function hasJapanese(text) {
    return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/.test(text);
  }
  function hasEnglish(text) {
    return /[A-Za-z]{2,}/.test(text);
  }
  function matchesTargetScript(text, direction) {
    return normalizeDirection(direction) === "ja-en" ? hasEnglish(text) : hasJapanese(text);
  }
  var activeDirection = "en-ja";
  function setAdapterDirection(direction) {
    activeDirection = normalizeDirection(direction);
  }
  function getAdapterDirection() {
    return activeDirection;
  }

  // src/lib/cache-key.ts
  var ALLOWED_AUDIO_LANGS = /* @__PURE__ */ new Set(["ja", "en"]);
  function cacheKey(platform, contentId, audioLang2) {
    const lang = ALLOWED_AUDIO_LANGS.has(audioLang2) ? audioLang2 : "ja";
    if (platform === "generic") {
      return `fp:${contentId}:${lang}`;
    }
    return `${platform}:${contentId}:${lang}`;
  }
  function detectAudioLang(video, preferred) {
    if (preferred === "ja" || preferred === "en") return preferred;
    const v = video || document.querySelector("video");
    const tracks = v && v.audioTracks;
    if (tracks && tracks.length) {
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.enabled && track.language) {
          const code = track.language.slice(0, 2).toLowerCase();
          if (ALLOWED_AUDIO_LANGS.has(code)) return code;
        }
      }
    }
    return "ja";
  }
  function deriveContentId(platform) {
    switch (platform) {
      case "youtube": {
        const m = location.search.match(/[?&]v=([^&]+)/);
        if (m) return m[1];
        const pathMatch = location.pathname.match(/^\/(?:shorts|live)\/([^/?]+)/);
        return pathMatch ? pathMatch[1] : null;
      }
      case "netflix": {
        const watch = location.pathname.match(/\/watch\/(\d+)/);
        if (watch) return watch[1];
        const id = window.__avcNetflixVideoId;
        return id || null;
      }
      case "crunchyroll": {
        const parts = location.pathname.split("/").filter(Boolean);
        const watchIdx = parts.indexOf("watch");
        if (watchIdx >= 0) {
          for (let i = watchIdx + 1; i < parts.length; i++) {
            if (/^[A-Z0-9]{8,}$/.test(parts[i])) return parts[i];
          }
        }
        return null;
      }
      default:
        return null;
    }
  }
  function deriveCacheKey(platform, video, preferredLang) {
    const contentId = deriveContentId(platform);
    if (!contentId) return null;
    const lang = detectAudioLang(video, preferredLang);
    return { key: cacheKey(platform, contentId, lang), platform, contentId, audioLang: lang };
  }
  function sessionIdentity(platform, preferredLang) {
    const id = deriveContentId(platform);
    const lang = detectAudioLang(void 0, preferredLang);
    return id ? `${platform}:${id}:${lang}` : location.pathname;
  }

  // src/lib/caption-status.ts
  var UNKNOWN = { state: "unknown", lang: "ja" };
  var current = UNKNOWN;
  var listeners = /* @__PURE__ */ new Set();
  function reportCaptions(report) {
    const same = current.state === report.state && current.lang === report.lang && current.reason === report.reason && !!current.autoGenerated === !!report.autoGenerated;
    current = report;
    if (same) return;
    for (const listener of listeners) {
      try {
        listener(report);
      } catch {
      }
    }
  }
  function captionReport() {
    return current;
  }
  function resetCaptions() {
    reportCaptions(UNKNOWN);
  }
  function onCaptions(listener) {
    listeners.add(listener);
  }
  var LANG_NAME = { ja: "Japanese", en: "English" };
  function captionNoticeText(report, opts2) {
    if (report.state !== "missing") return null;
    if (opts2.listening) return null;
    if (!opts2.cardsOn && !opts2.lensOn) return null;
    const lang = LANG_NAME[report.lang];
    return `No ${lang} captions on this video, so there are no words to pull from the subtitles. Start Listening Mode from the AnimeVocab toolbar icon to learn from the audio instead, or pick a video that offers ${lang} subtitles.`;
  }
  function captionStatusDetail(report) {
    if (report.state === "missing") {
      return `No ${LANG_NAME[report.lang]} captions on this video. Listening Mode still works.`;
    }
    if (report.state === "ok" && report.autoGenerated) {
      return `Using auto-generated ${LANG_NAME[report.lang]} captions on this video.`;
    }
    return null;
  }

  // src/lib/cue-sentences.ts
  var GAP_SEC = 0.8;
  var MAX_CUE_CHARS = { ja: 28, en: 90 };
  var TAIL_SEC = 0.9;
  var SENTENCE_END = /[。！？!?.…]["」』）)]*$/;
  function parseJson3Words(data2) {
    const words = [];
    for (const ev of data2.events || []) {
      if (!ev.segs || ev.aAppend) continue;
      const base = (ev.tStartMs || 0) / 1e3;
      for (const seg of ev.segs) {
        const text = seg.utf8 || "";
        if (!text.trim()) continue;
        words.push({ start: base + (seg.tOffsetMs || 0) / 1e3, text: text.replace(/\n/g, " ") });
      }
    }
    words.sort((a, b) => a.start - b.start);
    return words;
  }
  function spokenSec(text, lang) {
    const chars = text.trim().length;
    return Math.min(1.5, Math.max(0.2, chars * (lang === "ja" ? 0.13 : 0.06)));
  }
  function buildSentenceCues(words, lang) {
    const cap = MAX_CUE_CHARS[lang];
    const groups = [];
    let current2 = [];
    let length = 0;
    const close = () => {
      if (current2.length) groups.push(current2);
      current2 = [];
      length = 0;
    };
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordLength = word.text.trim().length;
      if (current2.length && length + wordLength > cap) close();
      current2.push(word);
      length += wordLength;
      const next = words[i + 1];
      if (!next) break;
      const gap = next.start - (word.start + spokenSec(word.text, lang));
      if (SENTENCE_END.test(word.text.trim()) || gap >= GAP_SEC) close();
    }
    close();
    const cues = [];
    groups.forEach((group, i) => {
      const text = normalize(group.map((w) => w.text.trim()).join(lang === "ja" ? "" : " "));
      if (!text) return;
      const last = group[group.length - 1];
      const start = group[0].start;
      const nextStart = groups[i + 1]?.[0].start ?? Infinity;
      const end = Math.min(nextStart, last.start + spokenSec(last.text, lang) + TAIL_SEC);
      cues.push({ start, end: Math.max(end, start + 0.1), text });
    });
    return cues;
  }
  var RollingCaption = class {
    constructor(settleMs = 700, maxHoldMs = 4e3) {
      this.settleMs = settleMs;
      this.maxHoldMs = maxHoldMs;
      this.pending = "";
      this.changedAt = 0;
      this.rollingSince = 0;
      this.emitted = "";
    }
    /** Feed what is on screen now. */
    update(text, now) {
      if (text === this.pending) return;
      if (!this.pending) this.rollingSince = now;
      this.pending = text;
      this.changedAt = now;
    }
    /** The caption to emit now, if it has settled (or rolled too long) and says
     * something new. `force` takes it regardless: the caption left the screen. */
    take(now, force = false) {
      if (!this.pending) return null;
      const settled = force || now - this.changedAt >= this.settleMs;
      if (!settled && now - this.rollingSince < this.maxHoldMs) return null;
      const line = this.pending;
      const fresh = unseenTail(this.emitted, line);
      this.rollingSince = now;
      if (settled) this.pending = "";
      if (!fresh) return null;
      this.emitted = line;
      return line;
    }
    /** A caption that replaced the last one outright: it is out, nothing waits. */
    markEmitted(text) {
      this.pending = "";
      this.emitted = text;
    }
    /** Whether `text` continues the caption given out last (a rolling update)
     * rather than replacing it. */
    continues(text) {
      const prev = this.pending || this.emitted;
      return !!prev && unseenTail(prev, text) !== text.trim();
    }
    reset() {
      this.pending = "";
      this.emitted = "";
    }
  };
  var MIN_OVERLAP = 2;
  function unseenTail(prev, next) {
    if (!prev) return next.trim();
    if (next.startsWith(prev)) return next.slice(prev.length).trim();
    for (let k = Math.min(prev.length, next.length); k >= MIN_OVERLAP; k--) {
      if (next.startsWith(prev.slice(prev.length - k))) return next.slice(k).trim();
    }
    return next.trim();
  }

  // src/lib/youtube-pot.ts
  function trackUrl(baseUrl, pot, origin = "https://www.youtube.com") {
    const url = new URL(baseUrl, origin);
    url.searchParams.set("fmt", "json3");
    if (pot) {
      url.searchParams.set("pot", pot.pot);
      url.searchParams.set("c", pot.c);
      if (pot.cver) url.searchParams.set("cver", pot.cver);
    }
    return url.toString();
  }

  // src/lib/adapters/youtube.ts
  var CAPTION_SETTLE_MS = 1e3;
  var POT_WAIT_MS = 1500;
  var POT_PRIME_WAIT_MS = 5e3;
  var onLineCb = null;
  var onClearCb = null;
  var targetCues = [];
  var contextCues = [];
  var currentVideoId = "";
  var lastCueKey = "";
  var attachedVideo = null;
  var loadedForDirection = "";
  var pots = /* @__PURE__ */ new Map();
  var potWaiters = /* @__PURE__ */ new Set();
  var lastTracks = null;
  var emptyWithoutPot = /* @__PURE__ */ new Set();
  var loadGeneration = 0;
  var loadingKey = "";
  function notePot(info) {
    pots.set(info.videoId, info);
    if (pots.size > 20) pots.delete(pots.keys().next().value);
    for (const wake of [...potWaiters]) wake();
    if (emptyWithoutPot.delete(info.videoId) && lastTracks?.videoId === info.videoId) {
      loadedForDirection = "";
      handleTracks(lastTracks).catch((err) => warn("youtube tracks retry error:", err));
    }
  }
  function waitForPot(videoId, ms) {
    const have = pots.get(videoId);
    if (have || ms <= 0) return Promise.resolve(have || null);
    return new Promise((resolve) => {
      const done = () => {
        const got = pots.get(videoId);
        if (!got && Date.now() < deadline) return;
        clearTimeout(timer);
        potWaiters.delete(done);
        resolve(got || null);
      };
      const deadline = Date.now() + ms;
      const timer = setTimeout(done, ms);
      potWaiters.add(done);
    });
  }
  function urlVideoId() {
    return deriveContentId("youtube") || "";
  }
  function dropCuesFromOtherVideo() {
    const id = urlVideoId();
    if (!currentVideoId || !id || id === currentVideoId) return false;
    log("youtube: video changed to", id, "- dropping", targetCues.length, "stale cues");
    targetCues = [];
    contextCues = [];
    lastCueKey = "";
    currentVideoId = "";
    loadedForDirection = "";
    loadingKey = "";
    loadGeneration += 1;
    resetCaptions();
    return true;
  }
  function parseJson3(data2) {
    const cues = [];
    for (const ev of data2.events || []) {
      if (!ev.segs) continue;
      const text = normalize(ev.segs.map((s) => s.utf8 || "").join(""));
      if (!text) continue;
      const start = ev.tStartMs / 1e3;
      cues.push({ start, end: start + (ev.dDurMs || 3e3) / 1e3, text });
    }
    cues.sort((a, b) => a.start - b.start);
    return cues;
  }
  async function fetchTrack(track, pot, lang) {
    const res = await fetch(trackUrl(track.baseUrl, pot, location.origin));
    if (!res.ok) throw new Error(`timedtext HTTP ${res.status}`);
    const text = await res.text();
    if (!text) return [];
    const data2 = JSON.parse(text);
    return track.kind === "asr" ? buildSentenceCues(parseJson3Words(data2), lang) : parseJson3(data2);
  }
  async function potFor(videoId, captionsOn) {
    const early = await waitForPot(videoId, captionsOn === false ? 0 : POT_WAIT_MS);
    if (early) return early;
    window.postMessage({ source: "avc", type: "avc-prime-captions", videoId }, "*");
    return waitForPot(videoId, POT_PRIME_WAIT_MS);
  }
  function pickTrack(tracks, langPrefix) {
    const matches = tracks.filter((t) => (t.languageCode || "").startsWith(langPrefix));
    return matches.find((t) => t.kind !== "asr") || matches[0] || null;
  }
  async function handleTracks(msg) {
    const direction = getAdapterDirection();
    lastTracks = msg;
    const dirKey = `${msg.videoId}:${direction}`;
    if (dirKey === currentVideoId + ":" + loadedForDirection && (targetCues.length || loadingKey === dirKey)) return;
    const generation = ++loadGeneration;
    const superseded = () => generation !== loadGeneration;
    currentVideoId = msg.videoId;
    loadedForDirection = direction;
    targetCues = [];
    contextCues = [];
    lastCueKey = "";
    const study = audioLang(direction);
    const ctx = contextLang(direction);
    const studyTrack = pickTrack(msg.tracks, study);
    if (!studyTrack) {
      log(`youtube: no ${study} caption track on this video, DOM fallback only`);
      reportCaptions({ state: "missing", lang: study, reason: "no-track" });
      return;
    }
    loadingKey = dirKey;
    let pot = null;
    let cues = [];
    try {
      pot = await potFor(msg.videoId, msg.captionsOn);
      if (superseded()) return;
      cues = await fetchTrack(studyTrack, pot, study);
    } catch {
      cues = [];
    } finally {
      if (!superseded()) loadingKey = "";
    }
    if (superseded()) return;
    targetCues = cues;
    if (!targetCues.length) {
      if (!pot) emptyWithoutPot.add(msg.videoId);
      log(
        `youtube: hidden ${study} caption track unavailable. Use Listening Mode from the toolbar, or turn on matching captions to read them from the page.`
      );
      reportCaptions({ state: "missing", lang: study, reason: "empty-track" });
      return;
    }
    log(
      `youtube: loaded ${targetCues.length} ${study} cues (${studyTrack.kind === "asr" ? "auto-generated" : "manual"})`
    );
    reportCaptions({ state: "ok", lang: study, autoGenerated: studyTrack.kind === "asr" });
    const ctxTrack = pickTrack(msg.tracks, ctx);
    if (ctxTrack) {
      try {
        contextCues = await fetchTrack(ctxTrack, pot, ctx);
        log(`youtube: loaded ${contextCues.length} ${ctx} cues for context`);
      } catch {
        contextCues = [];
      }
    }
  }
  function cueAt2(cues, t) {
    for (const cue of cues) {
      if (t >= cue.start && t <= cue.end) return cue;
      if (cue.start > t) break;
    }
    return null;
  }
  function onTimeUpdate() {
    if (dropCuesFromOtherVideo()) return;
    if (!targetCues.length || !onLineCb || !attachedVideo) return;
    const t = attachedVideo.currentTime;
    const cue = cueAt2(targetCues, t);
    if (!cue) {
      if (lastCueKey) {
        lastCueKey = "";
        onClearCb?.();
      }
      return;
    }
    const key = `${cue.start}:${cue.text}`;
    if (key === lastCueKey) return;
    lastCueKey = key;
    if (!matchesTargetScript(cue.text, getAdapterDirection())) return;
    const ctxCue = cueAt2(contextCues, (cue.start + cue.end) / 2);
    onLineCb(cue.text, { en: ctxCue ? ctxCue.text : "" });
  }
  function getVideo() {
    return document.querySelector("#movie_player video, video.html5-main-video");
  }
  function getVisibleText() {
    const segs = document.querySelectorAll(".ytp-caption-segment");
    return normalize(Array.from(segs).map((s) => s.textContent || "").join(" "));
  }
  var youtubeAdapter = {
    name: "youtube",
    matches() {
      return location.hostname.endsWith("youtube.com");
    },
    getVideo,
    getVisibleText,
    start(onLine, onClear) {
      onLineCb = onLine;
      onClearCb = onClear || null;
      window.addEventListener("message", (e) => {
        if (e.source !== window || e.data?.source !== "avc") return;
        if (e.data.type === "avc-timedtext-pot" && typeof e.data.pot === "string" && typeof e.data.videoId === "string") {
          notePot({ videoId: e.data.videoId, pot: e.data.pot, c: String(e.data.c || "WEB"), cver: String(e.data.cver || "") });
          return;
        }
        if (e.data.type !== "avc-caption-tracks") return;
        handleTracks(e.data).catch((err) => warn("youtube tracks error:", err));
      });
      setInterval(() => {
        dropCuesFromOtherVideo();
        const v = getVideo();
        if (v && v !== attachedVideo) {
          if (attachedVideo) attachedVideo.removeEventListener("timeupdate", onTimeUpdate);
          attachedVideo = v;
          v.addEventListener("timeupdate", onTimeUpdate);
        }
      }, 2e3);
      let lastText = "";
      let lastTextVideoId = "";
      let settleUntil = 0;
      const roller = new RollingCaption();
      let rollTimer = null;
      const flushRolling = () => {
        const line = roller.take(Date.now());
        if (line) onLine(line, { en: "" });
      };
      const check = () => {
        try {
          dropCuesFromOtherVideo();
          if (targetCues.length) return;
          const videoId = urlVideoId();
          if (videoId !== lastTextVideoId) {
            lastTextVideoId = videoId;
            lastText = getVisibleText();
            roller.reset();
            roller.markEmitted(lastText);
            settleUntil = Date.now() + CAPTION_SETTLE_MS;
            return;
          }
          if (Date.now() < settleUntil) return;
          const text = getVisibleText();
          if (text === lastText) return;
          if (!text || !matchesTargetScript(text, getAdapterDirection())) {
            roller.reset();
            if (lastText) onClear?.();
            lastText = "";
            return;
          }
          lastText = text;
          if (roller.continues(text)) {
            roller.update(text, Date.now());
            if (!rollTimer) {
              rollTimer = setInterval(() => {
                flushRolling();
                if (!targetCues.length && lastText) return;
                if (rollTimer) clearInterval(rollTimer);
                rollTimer = null;
              }, 200);
            }
            return;
          }
          roller.markEmitted(text);
          onLine(text, { en: "" });
        } catch (err) {
          warn("youtube adapter error:", err);
        }
      };
      const observer = new MutationObserver(coalesce(check, 50));
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  };

  // src/lib/adapters/netflix.ts
  function rowText(row) {
    if (!row.querySelector("rt, rp")) return row.textContent || "";
    const copy = row.cloneNode(true);
    copy.querySelectorAll("rt, rp").forEach((n) => n.remove());
    return copy.textContent || "";
  }
  function getVisibleText2() {
    const rows = document.querySelectorAll(".player-timedtext-text-container");
    return normalize(Array.from(rows).map(rowText).join(" "));
  }
  var netflixAdapter = {
    name: "netflix",
    matches() {
      return location.hostname.endsWith("netflix.com");
    },
    getVideo() {
      return document.querySelector("video");
    },
    getVisibleText: getVisibleText2,
    start(onLine, onClear) {
      let lastText = "";
      const check = () => {
        try {
          const text = getVisibleText2();
          if (text === lastText) return;
          if (!text || !matchesTargetScript(text, getAdapterDirection())) {
            if (lastText) onClear?.();
            lastText = "";
            return;
          }
          lastText = text;
          onLine(text, { en: "" });
        } catch (err) {
          warn("netflix adapter error:", err);
        }
      };
      const observer = new MutationObserver(coalesce(check, 50));
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  };

  // src/lib/adapters/generic.ts
  function getVideo2() {
    const videos = document.querySelectorAll("video");
    for (const v of videos) {
      if (v.textTracks && v.textTracks.length > 0) return v;
    }
    return videos[0] || null;
  }
  var genericAdapter = {
    name: "generic",
    matches() {
      return document.querySelector("video") !== null;
    },
    getVideo: getVideo2,
    getVisibleText() {
      const video = getVideo2();
      if (!video || !video.textTracks) return "";
      const parts = [];
      for (const track of video.textTracks) {
        if (track.mode !== "showing" || !track.activeCues) continue;
        for (const cue of track.activeCues) {
          const text = cue.text;
          if (text) parts.push(stripCueTags(text));
        }
      }
      return normalize(parts.join(" "));
    },
    start(onLine, onClear) {
      const hooked = /* @__PURE__ */ new WeakSet();
      const lastByTrack = /* @__PURE__ */ new WeakMap();
      const contextFromVideo = (video) => {
        const want = contextLang(getAdapterDirection());
        for (const track of video.textTracks) {
          if (!(track.language || "").startsWith(want) || !track.activeCues) continue;
          const text = normalize(
            Array.from(track.activeCues).map((c) => stripCueTags(c.text)).join(" ")
          );
          if (text) return text;
        }
        for (const track of video.textTracks) {
          if (track.mode !== "showing" || !track.activeCues) continue;
          const text = normalize(
            Array.from(track.activeCues).map((c) => stripCueTags(c.text)).join(" ")
          );
          if (!text) continue;
          if (want === "en" && hasEnglish(text)) return text;
          if (want === "ja" && matchesTargetScript(text, "en-ja")) return text;
        }
        return "";
      };
      setInterval(() => {
        try {
          document.querySelectorAll("video").forEach((v) => {
            for (const track of v.textTracks) {
              if (hooked.has(track)) continue;
              hooked.add(track);
              if (track.mode === "disabled") track.mode = "hidden";
              track.addEventListener("cuechange", () => {
                try {
                  const cues = track.activeCues;
                  if (!cues || !cues.length) {
                    if (lastByTrack.get(track)) {
                      lastByTrack.set(track, "");
                      onClear?.();
                    }
                    return;
                  }
                  const text = normalize(
                    Array.from(cues).map((c) => stripCueTags(c.text)).join(" ")
                  );
                  const lastText = lastByTrack.get(track) || "";
                  if (!text || text === lastText) return;
                  if (!matchesTargetScript(text, getAdapterDirection())) return;
                  lastByTrack.set(track, text);
                  onLine(text, { en: contextFromVideo(v) });
                } catch (err) {
                  warn("generic adapter cue error:", err);
                }
              });
            }
          });
        } catch (err) {
          warn("generic adapter error:", err);
        }
      }, 2e3);
    }
  };

  // src/lib/extract-words-client.ts
  var sessionCache3 = /* @__PURE__ */ new Map();
  function sessionKey2(line, direction, level) {
    return `${direction}:${level}:${line}`;
  }
  async function requestExtractWords(opts2) {
    const key = sessionKey2(opts2.line, opts2.direction, opts2.learnerLevel);
    const hit = sessionCache3.get(key);
    if (hit) return { ok: true, words: hit, cached: true };
    try {
      const res = await chrome.runtime.sendMessage({
        type: "avc-extract-words",
        payload: opts2
      });
      if (!res) return { ok: false, error: "no_response" };
      if (res.ok && res.words?.length) sessionCache3.set(key, res.words);
      return res;
    } catch {
      return { ok: false, error: "network" };
    }
  }
  function overlayFromExtract(words) {
    const overlay = {};
    for (const w of words) {
      const base = w.word.trim().toLowerCase();
      if (!base) continue;
      overlay[base] = {
        reading: w.reading || "",
        glosses: w.gloss ? [w.gloss] : [],
        level: w.level,
        freqRank: Math.round((6 - w.level) * 2e3)
      };
      if (w.word !== base) {
        overlay[w.word] = overlay[base];
      }
    }
    return overlay;
  }

  // src/lib/transcript-client.ts
  async function lookupTranscript(syncToken2, cacheKey2, t, windowSec = 8) {
    const url = new URL(BACKEND_URL + "/v1/transcript");
    url.searchParams.set("key", cacheKey2);
    url.searchParams.set("t", String(t));
    url.searchParams.set("window", String(windowSec));
    const res = await fetch(url.toString(), {
      headers: { Authorization: "Bearer " + syncToken2 }
    });
    if (res.status === 401) throw new Error("not signed in");
    if (res.status === 429) throw new Error("monthly listening hours used up");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "transcript lookup HTTP " + res.status);
    }
    return res.json();
  }

  // src/lib/cue-ledger.ts
  var MAX_TRACKED_CUES = 2e3;
  var CueLedger = class {
    constructor(capacity = MAX_TRACKED_CUES) {
      this.capacity = capacity;
      this.seen = /* @__PURE__ */ new Set();
      this.order = [];
      this.head = 0;
      if (!Number.isInteger(capacity) || capacity < 1) {
        throw new Error("cue ledger capacity must be a positive integer");
      }
    }
    /** Returns true only the first time a cue is remembered while retained. */
    remember(key) {
      if (this.seen.has(key)) return false;
      this.seen.add(key);
      this.order.push(key);
      if (this.seen.size > this.capacity) {
        const oldest = this.order[this.head++];
        this.seen.delete(oldest);
        if (this.head >= 1024 && this.head * 2 >= this.order.length) {
          this.order = this.order.slice(this.head);
          this.head = 0;
        }
      }
      return true;
    }
    clear() {
      this.seen.clear();
      this.order = [];
      this.head = 0;
    }
    get size() {
      return this.seen.size;
    }
  };

  // src/lib/lens-lines.ts
  var SENTENCE = { ja: /(?<=[。！？!?…])/, en: /(?<=[.!?…])\s+/ };
  var SOFT_BREAK = { ja: /[、,，」』）)\s]/, en: /\s/ };
  var LENS_MAX_CHARS = { ja: 28, en: 90 };
  function splitForLens(text, lang, maxChars = LENS_MAX_CHARS[lang]) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const out = [];
    for (const sentence of clean.split(SENTENCE[lang])) {
      let rest = sentence.trim();
      while (rest.length > maxChars) {
        let cut = maxChars;
        for (let i = maxChars - 1; i >= Math.floor(maxChars / 3); i--) {
          if (SOFT_BREAK[lang].test(rest[i])) {
            cut = i + 1;
            break;
          }
        }
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) out.push(rest);
    }
    return out.filter(Boolean);
  }
  function lensPieceDelayMs(piece, lang) {
    const perChar = lang === "ja" ? 90 : 45;
    return Math.min(4e3, Math.max(1200, piece.length * perChar));
  }

  // src/lib/signin-gate.ts
  var SIGNIN_CHIP_DISMISSED_KEY = "signinChipDismissed";
  function isSignedIn(token) {
    return typeof token === "string" && token.length > 0;
  }
  function shouldShowSigninChip(input) {
    return !input.signedIn && !input.dismissed && input.topFrame && input.hasPlayer && input.siteEnabled;
  }
  var SIGNIN_GATE_COPY = {
    chipTitle: "Sign in to start learning with this episode",
    chipNote: "Free account. Your words, reviews and progress stay with you.",
    chipCta: "Sign in",
    chipBusy: "Opening sign-in...",
    chipDismiss: "Dismiss sign-in reminder",
    popupEyebrow: "FREE ACCOUNT",
    popupTitle: "Sign in to start learning",
    popupNote: "Your words, reviews and progress live in your free AnimeVocab account, on every device.",
    popupCta: "Sign in",
    popupFine: "Free forever. No card.",
    upgradeNote: "Your words now live in your free account. Sign in to keep them.",
    startTitle: "Start learning with the anime you already watch",
    startNote: "One free account keeps your words, reviews and progress on every device.",
    startCta: "Sign in with Google or email",
    startFine: "Free forever. No card.",
    signedInTitle: "You're in",
    signedInNote: "The extension is connected. Open a supported site and start watching."
  };

  // src/lib/signin-chip.ts
  var OPEN_SIGNIN_MESSAGE = "avc-open-signin";
  var BUSY_TIMEOUT_MS = 15e3;
  var MIN_PLAYER_IFRAME = 320;
  var STYLES3 = `
  :host { all: initial; }
  .chip {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483000;
    width: 296px;
    box-sizing: border-box;
    padding: 14px 16px 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    background: #16171d;
    color: #f4f4f6;
    font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  }
  .title {
    margin: 0 0 4px;
    padding-right: 18px;
    font-size: 14px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  .note {
    margin: 0 0 12px;
    color: #b9bac4;
    font-size: 12px;
  }
  .actions { display: flex; align-items: center; gap: 10px; }
  .cta {
    flex: 1;
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 9px;
    background: #f4f4f6;
    color: #16171d;
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }
  .cta:hover { background: #ffffff; }
  .cta:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }
  .cta[disabled] { opacity: 0.7; cursor: default; }
  .dismiss {
    flex: none;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #9a9ba6;
    font: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .dismiss:hover { background: rgba(255, 255, 255, 0.08); color: #f4f4f6; }
  .dismiss:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }
  @media (prefers-reduced-motion: no-preference) {
    .chip { animation: rise 160ms ease-out; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px); } }
  }
`;
  var host2 = null;
  var cta = null;
  var busyTimer = null;
  var busy = false;
  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function setBusy(next) {
    busy = next;
    if (busyTimer) {
      clearTimeout(busyTimer);
      busyTimer = null;
    }
    if (!cta) return;
    cta.disabled = next;
    cta.textContent = next ? SIGNIN_GATE_COPY.chipBusy : SIGNIN_GATE_COPY.chipCta;
    if (next) busyTimer = setTimeout(() => setBusy(false), BUSY_TIMEOUT_MS);
  }
  function hasPlayableMedia(doc = document) {
    if (doc.querySelector("video")) return true;
    const frames = doc.querySelectorAll("iframe");
    for (const frame of Array.from(frames)) {
      const r = frame.getBoundingClientRect();
      if (r.width >= MIN_PLAYER_IFRAME && r.height >= MIN_PLAYER_IFRAME) return true;
    }
    return false;
  }
  async function getSigninChipDismissed() {
    try {
      const r = await chrome.storage.local.get([SIGNIN_CHIP_DISMISSED_KEY]);
      return r[SIGNIN_CHIP_DISMISSED_KEY] === true;
    } catch {
      return false;
    }
  }
  async function setSigninChipDismissed() {
    try {
      await chrome.storage.local.set({ [SIGNIN_CHIP_DISMISSED_KEY]: true });
    } catch {
    }
  }
  function mountSigninChip() {
    if (host2) return;
    const parent = document.fullscreenElement || document.body;
    if (!parent) return;
    host2 = document.createElement("div");
    host2.setAttribute("data-avc-signin-chip", "");
    host2.setAttribute(UI_HOST_ATTR, "");
    const root2 = host2.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLES3;
    root2.appendChild(style);
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.setAttribute("role", "region");
    chip.setAttribute("aria-label", SIGNIN_GATE_COPY.chipTitle);
    chip.innerHTML = `<p class="title">${esc(SIGNIN_GATE_COPY.chipTitle)}</p><p class="note">${esc(SIGNIN_GATE_COPY.chipNote)}</p><div class="actions"><button type="button" class="cta">${esc(SIGNIN_GATE_COPY.chipCta)}</button><button type="button" class="dismiss" aria-label="${esc(SIGNIN_GATE_COPY.chipDismiss)}" title="${esc(SIGNIN_GATE_COPY.chipDismiss)}">\xD7</button></div>`;
    root2.appendChild(chip);
    keepFocusOnMouseClick(root2);
    cta = chip.querySelector(".cta");
    cta?.addEventListener("click", () => {
      if (busy) return;
      setBusy(true);
      void trackSignin("signin_started", "content_chip");
      try {
        void chrome.runtime.sendMessage({ type: OPEN_SIGNIN_MESSAGE, from: "content_chip" }).then(() => setBusy(false)).catch(() => setBusy(false));
      } catch {
        setBusy(false);
      }
    });
    chip.querySelector(".dismiss")?.addEventListener("click", () => {
      void setSigninChipDismissed();
      unmountSigninChip();
      void trackSignin("signin_gate_dismissed", "content_chip");
    });
    parent.appendChild(host2);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    void trackSignin("signin_gate_shown", "content_chip");
  }
  function unmountSigninChip() {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    if (busyTimer) {
      clearTimeout(busyTimer);
      busyTimer = null;
    }
    busy = false;
    cta = null;
    host2?.remove();
    host2 = null;
  }
  function onFullscreenChange() {
    if (!host2) return;
    const parent = document.fullscreenElement || document.body;
    if (parent && host2.parentElement !== parent) parent.appendChild(host2);
  }

  // src/entries/content.ts
  var AUDIO_LENS_MAX_LAG_SEC = 7;
  var AUDIO_LENS_MAX_LAG_AFTER_END_SEC = 4;
  var EARLY_LINE_TOLERANCE_SEC = 0.3;
  var MAX_EARLY_HOLD_SEC = 10;
  var JA_RETRY_MS = 3e4;
  var MAX_PENDING_LINES = 40;
  (function main() {
    if (window.__avcMainLoaded) {
      log("main already loaded, skipping re-init");
      return;
    }
    window.__avcMainLoaded = true;
    installKeyShield();
    const adapters = [youtubeAdapter, netflixAdapter, genericAdapter];
    let adapter = null;
    let started = false;
    let initialized = false;
    let pipelineDisabled = false;
    let signedIn = null;
    let accountGeneration = 0;
    let signinChipDismissed = false;
    let settings = null;
    let course2 = null;
    let courseLoad = null;
    let wordStates = {};
    let lastLine = "";
    let lastSessionId = "";
    const targetedThisSession = /* @__PURE__ */ new Set();
    let watchInterval = null;
    let cacheKey2 = "";
    let listeningActive = false;
    let hourlyCapNotified = false;
    let lineInFlight = false;
    const pendingLines = [];
    let lensSeq = 0;
    const judgedLensSeqs = /* @__PURE__ */ new Set();
    const tokenMemo = /* @__PURE__ */ new Map();
    let initPromise2 = null;
    let jaReady = false;
    let jaPromise = null;
    let jaFailedAt = 0;
    const contextSubs = new SubtitleHistory();
    let contextSampleTimer = null;
    let cachePollTimer = null;
    const emittedCueKeys = new CueLedger();
    let cachePollInFlight = null;
    let cachePollGeneration = 0;
    let playbackRelayTimer = null;
    let captionNoticeShown = false;
    function currentSessionId() {
      const a = adapter;
      return a ? sessionIdentity(platformForAdapter(a), studyLang()) : location.pathname;
    }
    function matchAdapter() {
      return adapters.find((a) => a.matches()) || null;
    }
    function pickAdapter() {
      if (signedIn !== true) return null;
      if (adapter) return adapter;
      adapter = matchAdapter();
      if (adapter && !started) {
        started = true;
        log("adapter chosen:", adapter.name);
        adapter.start(
          (text, context) => {
            if (signedIn !== true) return;
            lastPageLineAt = Date.now();
            if (episode) {
              comparePageLine(text);
              return;
            }
            subsDiag.source = "page";
            onLine(text, context);
          },
          () => {
            if (signedIn === true && !episode) clearLensLine();
          }
        );
        void ensureInit();
      }
      return adapter;
    }
    function syncSigninChip() {
      if (signedIn !== false) {
        unmountSigninChip();
        return;
      }
      const siteKey = matchAdapter()?.name || "generic";
      const enabled = !(settings?.sites && settings.sites[siteKey] === false);
      const show = shouldShowSigninChip({
        signedIn: false,
        dismissed: signinChipDismissed,
        topFrame: window.top === window,
        hasPlayer: hasPlayableMedia(),
        siteEnabled: enabled
      });
      if (show) mountSigninChip();
      else unmountSigninChip();
    }
    function stopSignedOutPipeline() {
      unmountSigninChip();
      listeningActive = false;
      stopCachePolling();
      stopPlaybackRelay();
      stopTimeline();
      if (watchInterval) clearInterval(watchInterval);
      watchInterval = null;
      cancelPacedLens();
      lensSeq++;
      hideLens();
      hideAgent();
      pendingLines.length = 0;
      judgedLensSeqs.clear();
    }
    async function readAccountState() {
      const accountAtRead = signedIn;
      let token = "";
      try {
        token = await getSyncToken();
      } catch {
        token = "";
      }
      try {
        settings = await getSettings();
      } catch {
      }
      if (signedIn === accountAtRead) signedIn = isSignedIn(token);
      signinChipDismissed = signedIn ? false : await getSigninChipDismissed();
      syncSigninChip();
    }
    function ensureInit() {
      if (initialized || pipelineDisabled) return Promise.resolve();
      if (!initPromise2) initPromise2 = runInit().finally(() => {
        initPromise2 = null;
      });
      return initPromise2;
    }
    async function runInit() {
      try {
        settings = await getSettings();
        setAdapterDirection(normalizeDirection(settings.learningDirection));
        wordStates = await getVocab();
        initialized = true;
        if (signedIn === true) startWatchInterval();
      } catch (err) {
        pipelineDisabled = true;
        warn("pipeline init failed:", err);
        return;
      }
      if (normalizeDirection(settings.learningDirection) === "en-ja") await ensureJa();
    }
    function ensureJa() {
      if (jaReady) return Promise.resolve(true);
      if (jaPromise) return jaPromise;
      if (Date.now() - jaFailedAt < JA_RETRY_MS) return Promise.resolve(false);
      jaPromise = (async () => {
        try {
          await init();
          const data2 = await load();
          const entries = Object.keys(data2).length;
          if (!entries) throw new Error("dictionary is empty");
          log("dictionary loaded:", entries, "entries");
          jaReady = true;
        } catch (err) {
          jaFailedAt = Date.now();
          warn("japanese resources failed to load, will retry:", err);
        } finally {
          jaPromise = null;
        }
        return jaReady;
      })();
      return jaPromise;
    }
    function platformForAdapter(a) {
      if (a.name === "youtube") return "youtube";
      if (a.name === "netflix") return "netflix";
      if (location.hostname.endsWith("crunchyroll.com")) return "crunchyroll";
      return "generic";
    }
    function studyLang() {
      return audioLang(normalizeDirection(settings?.learningDirection));
    }
    function refreshCacheKey() {
      const a = pickAdapter();
      if (!a) return;
      const video = a.getVideo();
      const preferred = studyLang();
      const result = deriveCacheKey(platformForAdapter(a), video, preferred);
      const next = result && result.audioLang === preferred ? result.key : "";
      if (next !== cacheKey2) {
        cachePollGeneration += 1;
        emittedCueKeys.clear();
        cacheKey2 = next;
        chrome.runtime.sendMessage({ type: "avc-update-cache-key", key: cacheKey2 }).catch(() => {
        });
      }
    }
    async function pollCacheHit() {
      if (!listeningActive || !cacheKey2) return;
      const a = pickAdapter();
      const video = a?.getVideo();
      if (!video || video.paused) return;
      const requestedKey = cacheKey2;
      const generation = cachePollGeneration;
      if (cachePollInFlight === generation) return;
      const stale = () => !listeningActive || cachePollGeneration !== generation || cacheKey2 !== requestedKey;
      cachePollInFlight = generation;
      try {
        settings = await getSettings();
        if (stale()) return;
        const syncToken2 = await getSyncToken();
        if (!syncToken2 || stale()) return;
        const t = video.currentTime;
        const result = await lookupTranscript(syncToken2, requestedKey, t, 2);
        if (stale()) return;
        if (!result.hit || !result.segments.length) return;
        for (const seg of result.segments) {
          if (stale()) return;
          if (seg.start > t) continue;
          const key = `${seg.start}:${seg.text}`;
          if (!emittedCueKeys.remember(key)) continue;
          const lang = studyLang();
          if (lang === "ja" && !/[\u3040-\u30FF\u4E00-\u9FFF]/.test(seg.text)) continue;
          if (lang === "en" && !/[A-Za-z]{2,}/.test(seg.text)) continue;
          const en = a ? contextForAudio(a, seg.start) : "";
          onLine(seg.text, { en, fromAudio: true }, { lens: audioLineIsCurrent(video, seg.start, seg.end) });
        }
      } catch (err) {
        warn("cache poll failed:", err);
      } finally {
        if (cachePollInFlight === generation) cachePollInFlight = null;
      }
    }
    function startCachePolling() {
      if (cachePollTimer) return;
      cachePollGeneration += 1;
      refreshCacheKey();
      cachePollTimer = setInterval(() => {
        pollCacheHit().catch((err) => warn("cache poll error:", err));
      }, 800);
    }
    function stopCachePolling() {
      cachePollGeneration += 1;
      if (cachePollTimer) clearInterval(cachePollTimer);
      cachePollTimer = null;
      emittedCueKeys.clear();
    }
    function startContextSampling() {
      if (contextSampleTimer) return;
      contextSubs.clear();
      const sample = () => {
        const a = adapter;
        const video = a?.getVideo();
        if (!a || !video) return;
        contextSubs.record(video.currentTime, a.getVisibleText());
      };
      sample();
      contextSampleTimer = setInterval(sample, 200);
    }
    function stopContextSampling() {
      if (contextSampleTimer) clearInterval(contextSampleTimer);
      contextSampleTimer = null;
      contextSubs.clear();
    }
    function contextForAudio(a, start) {
      let text = a.getVisibleText();
      if (typeof start === "number") {
        const at = contextSubs.textAt(start);
        if (at !== null) text = at;
      }
      return text && matchesTargetScript(text, normalizeDirection(settings?.learningDirection)) ? "" : text;
    }
    function audioLineIsCurrent(video, start, end) {
      if (!video) return true;
      if (typeof end === "number") return video.currentTime - end < AUDIO_LENS_MAX_LAG_AFTER_END_SEC;
      if (typeof start === "number") return video.currentTime - start < AUDIO_LENS_MAX_LAG_SEC;
      return true;
    }
    function startPlaybackRelay() {
      if (playbackRelayTimer) return;
      startContextSampling();
      playbackRelayTimer = setInterval(() => {
        if (!listeningActive) return;
        const video = adapter?.getVideo();
        if (!video) return;
        chrome.runtime.sendMessage({
          type: "avc-playback-time",
          time: video.currentTime,
          paused: video.paused
        }).catch(() => {
        });
      }, 500);
    }
    function stopPlaybackRelay() {
      if (playbackRelayTimer) clearInterval(playbackRelayTimer);
      playbackRelayTimer = null;
      stopContextSampling();
    }
    function startWatchInterval() {
      if (watchInterval) return;
      watchInterval = setInterval(async () => {
        const video = adapter && adapter.getVideo();
        if (!video || video.paused || video.ended) return;
        await recordWatchTick();
      }, 6e4);
    }
    let lastContextTitle = "";
    function lensOn(s) {
      return normalizeDirection(s.learningDirection) === "en-ja" && s.subLens !== false;
    }
    function lensScript(s) {
      if (course2) return course2.script;
      return s.displayScript === "kana" ? "kana" : s.displayScript === "kanji" ? "kanji" : "romaji";
    }
    const subs = new SubTranslator(
      (payload) => chrome.runtime.sendMessage({ type: "avc-translate", payload })
    );
    let pageHasEnglish = false;
    let subsNoticeShown = false;
    function explainMissingEnglish() {
      if (subsNoticeShown || !subs.lastError) return;
      const text = /quota/.test(subs.lastError) ? "English subtitles are paused: this month's limit is used up. Romaji keeps working." : /not_linked|unauthorized/.test(subs.lastError) ? "Sign in to AnimeVocab to get English under the romaji." : "";
      if (!text) return;
      subsNoticeShown = true;
      showToast(text, "info");
    }
    async function prefetchEnglish(line, a) {
      if (pageHasEnglish || hasEnglish(a.getVisibleText()) || contextSubs.some(hasEnglish)) return;
      if (!await ensureJa()) return;
      subs.translate(line, await tokenize(line), currentTitle()).catch(() => {
      });
    }
    function siteEnabled(s) {
      const siteKey = adapter ? adapter.name : "generic";
      return !(s.sites && s.sites[siteKey] === false);
    }
    async function tokenizeJa(text) {
      const hit = tokenMemo.get(text);
      if (hit) return hit;
      const tokens = await tokenize(text);
      tokenMemo.set(text, tokens);
      if (tokenMemo.size > 64) tokenMemo.delete(tokenMemo.keys().next().value);
      return tokens;
    }
    function countProgress2(vocab) {
      let n = 0;
      for (const rec of Object.values(vocab)) {
        if (rec.state === "known" || rec.state === "learning") n++;
      }
      return n;
    }
    function prefetchAnimeContext(title) {
      if (signedIn !== true) return;
      if (!title || title === lastContextTitle) return;
      lastContextTitle = title;
      void requestAnimeContext(title);
    }
    async function refreshState() {
      settings = await getSettings();
      setAdapterDirection(normalizeDirection(settings.learningDirection));
      wordStates = await getVocab();
    }
    async function handleCard(target, sentence, tokens, context, shouldCancel) {
      const video = adapter ? adapter.getVideo() : null;
      settings = await getSettings();
      if (shouldCancel?.()) return;
      const rawMode = settings.pauseMode;
      const mode = rawMode === "notify" ? "copilot" : settings.pauseMode;
      const meta = {
        reading: target.entry.reading,
        gloss: target.entry.glosses[0] || "",
        level: target.entry.level,
        freqRank: target.entry.freqRank
      };
      const title = currentTitle();
      prefetchAnimeContext(title);
      const direction = normalizeDirection(settings.learningDirection);
      const cardOptions = {
        interaction: mode === "pause" ? "focus" : "ambient",
        autoResumeSec: settings.autoResumeSec,
        displayScript: settings.displayScript || "romaji",
        autoSpeak: settings.autoSpeak !== false,
        contextEn: context?.en || "",
        fromAudio: !!context?.fromAudio,
        tokens,
        targetIndex: tokens.indexOf(target.token),
        title,
        animeContext: peekAnimeContext(title),
        learnerLevel: settings.targetLevel,
        wordsKnown: countProgress2(wordStates),
        learningDirection: direction
      };
      if (shouldCancel?.()) return;
      targetedThisSession.add(target.token.base);
      const judgmentPromise = showAgentPanel(target, sentence, video, cardOptions);
      await recordCardShown(target.token.base);
      const judgment = await judgmentPromise;
      if (judgment && judgment !== "dismiss") {
        const source = {
          title: currentTitle(),
          line: sentence,
          en: context?.en || null
        };
        await judgeWord(target.token.base, judgment, meta, source);
        await refreshState();
      }
    }
    function currentTitle() {
      const raw = (document.title || "").trim();
      if (!raw) return null;
      const cleaned = raw.replace(/\s*[-|·—]\s*(YouTube|Netflix|Crunchyroll).*$/i, "").replace(/^\(\d+\)\s*/, "").replace(/^Watch\s+/i, "").trim();
      const candidate = cleaned || raw;
      if (/^(youtube|netflix|crunchyroll)$/i.test(candidate)) return null;
      return candidate;
    }
    async function renderLens(line, context, groupSeq) {
      const seq = ++lensSeq;
      const sessionId = currentSessionId();
      const cue = context?.cue;
      const stale = () => signedIn !== true || seq !== lensSeq || currentSessionId() !== sessionId || cue !== void 0 && cue !== timelineCue;
      const current2 = settings || await getSettings();
      if (stale()) return;
      if (!siteEnabled(current2) || !lensOn(current2)) {
        hideLens();
        return;
      }
      await ensureInit();
      if (!initialized || stale()) return;
      if (!await ensureJa() || stale()) return;
      const tokens = await tokenizeJa(line);
      if (stale() || !tokens.length) return;
      const en = context?.en || "";
      pageHasEnglish = !!en;
      const script = lensScript(current2);
      const fromEpisode = cue !== void 0 ? episode : null;
      if (fromEpisode) syncNativeSubs(current2);
      showLensLine(line, en, tokens, wordStates, {
        script,
        readings: fromEpisode ? glossaryReadings(tokens, fromEpisode.glossary) : void 0,
        peekPause: current2.subLensPeek !== false,
        getVideo: () => adapter ? adapter.getVideo() : null,
        getTitle: currentTitle,
        onJudgeStart: () => {
          judgedLensSeqs.add(groupSeq ?? seq);
          if (judgedLensSeqs.size > MAX_PENDING_LINES) {
            const oldest = judgedLensSeqs.values().next().value;
            if (oldest !== void 0) judgedLensSeqs.delete(oldest);
          }
          dismissAgent();
        },
        onJudged: () => {
          void refreshState();
        }
      });
      if (en) return;
      if (fromEpisode && cue !== void 0) {
        if (fromEpisode.source === "track") return;
        const ahead = await fromEpisode.whenEnglish(cue);
        if (stale()) return;
        if (ahead !== null) {
          if (ahead) updateLensLine(line, { en: ahead });
          return;
        }
        if (fromEpisode.lastError && /quota|not_linked|unauthorized/.test(fromEpisode.lastError)) {
          subs.lastError = fromEpisode.lastError;
          explainMissingEnglish();
          return;
        }
      }
      const translated = await subs.translate(line, tokens, currentTitle());
      if (stale()) return;
      updateLensLine(line, translated ?? {});
      if (!translated) explainMissingEnglish();
    }
    let lensChain = 0;
    function cancelPacedLens() {
      lensChain += 1;
    }
    function showPacedLens(text, context) {
      const pieces = splitForLens(text, studyLang());
      if (!pieces.length) return -1;
      cancelPacedLens();
      const chain = lensChain;
      const sessionId = currentSessionId();
      const lang = studyLang();
      let groupSeq = -1;
      const step = (i) => {
        if (chain !== lensChain || currentSessionId() !== sessionId) return;
        renderLens(pieces[i], context, i === 0 ? void 0 : groupSeq).catch((err) => warn("sub-lens render failed:", err));
        if (i === 0) groupSeq = lensSeq;
        if (i + 1 < pieces.length) setTimeout(() => step(i + 1), lensPieceDelayMs(pieces[i], lang));
      };
      step(0);
      return groupSeq;
    }
    function onLine(text, context, opts2 = {}) {
      if (signedIn !== true || pipelineDisabled) return;
      const line = text.replace(/\s+/g, " ").trim();
      if (!line) return;
      void hearCourseWords(line).catch((err) => warn("course matching failed:", err));
      let seq = opts2.lensSeq ?? -1;
      if (opts2.lens !== false) {
        cancelPacedLens();
        renderLens(line, context).catch((err) => warn("sub-lens render failed:", err));
        seq = lensSeq;
      }
      pendingLines.push({ text: line, context, lensSeq: seq });
      if (pendingLines.length > MAX_PENDING_LINES) pendingLines.splice(0, pendingLines.length - MAX_PENDING_LINES);
      if (!lineInFlight) void drainLines();
    }
    async function drainLines() {
      lineInFlight = true;
      try {
        let next;
        while (next = pendingLines.shift()) {
          try {
            await processLine(next.text, next.context, next.lensSeq);
          } catch (err) {
            warn("line processing failed:", err);
          }
        }
      } finally {
        lineInFlight = false;
      }
    }
    async function processLine(text, context, lineLensSeq = -1) {
      const lineSessionId = currentSessionId();
      const staleSession = () => {
        if (signedIn !== true) return true;
        if (currentSessionId() === lineSessionId) return false;
        log("dropped line from the previous video:", text.slice(0, 40));
        return true;
      };
      settings = await getSettings();
      if (staleSession()) return;
      if (!siteEnabled(settings)) return;
      const direction = normalizeDirection(settings.learningDirection);
      setAdapterDirection(direction);
      const lensEnabled = lensOn(settings);
      if (settings.pauseMode === "off" && !lensEnabled) return;
      await ensureInit();
      if (!initialized) return;
      const normalized = text.replace(/\s+/g, " ").trim();
      if (normalized === lastLine) return;
      lastLine = normalized;
      let tokens;
      let dictOverlay = null;
      const lensJudged = () => lineLensSeq >= 0 && judgedLensSeqs.has(lineLensSeq);
      if (direction === "ja-en") {
        tokens = tokenizeEnglish(normalized);
        const extracted = await requestExtractWords({
          line: normalized,
          direction,
          learnerLevel: settings.targetLevel,
          title: currentTitle()
        });
        if (!extracted.ok && extracted.error === "auto_quota_exhausted") {
          void reportLimitReached("auto");
        }
        if (extracted.ok && extracted.words?.length) {
          dictOverlay = overlayFromExtract(extracted.words);
          for (const w of extracted.words) {
            const base = w.word.trim().toLowerCase();
            if (!base || tokens.some((t) => t.base === base)) continue;
            tokens.push({
              surface: w.word,
              base,
              reading: w.reading || "",
              pos: "CONTENT",
              pos1: "english"
            });
          }
        }
      } else {
        if (!await ensureJa()) return;
        tokens = await tokenizeJa(normalized);
      }
      if (staleSession()) return;
      await recordSeen(tokens, wordStates, targetedThisSession, direction, dictOverlay);
      wordStates = await getVocab();
      if (lensJudged() || staleSession()) return;
      if (settings.pauseMode === "off") return;
      if (pendingLines.length) {
        log("no card for a line with a newer one waiting:", normalized.slice(0, 40));
        return;
      }
      if (isClosedByUser()) return;
      if (isOpen()) {
        log("skipped line (word card still open):", normalized.slice(0, 40));
        return;
      }
      if (isChatEngaged()) {
        log("skipped line (learner is chatting with the copilot):", normalized.slice(0, 40));
        return;
      }
      const target = await pickTargetSmart(
        tokens,
        wordStates,
        settings,
        targetedThisSession,
        normalized,
        currentTitle(),
        dictOverlay
      );
      if (lensJudged() || staleSession()) return;
      if (!target) {
        log("no target word in:", normalized);
        return;
      }
      if (isOpen() || isChatEngaged()) {
        log("skipped line (card opened or chat started while picking):", normalized.slice(0, 40));
        return;
      }
      const stats = await getStats();
      if (lensJudged() || staleSession()) return;
      const now = Date.now();
      const cardTimestamps = stats.cardTimestamps || [];
      if (!target.isReview) {
        const lastCard = cardTimestamps.length ? cardTimestamps[cardTimestamps.length - 1] : 0;
        if (now - lastCard < settings.cooldownSec * 1e3) {
          log(`target "${target.token.base}" held back by cooldown (${settings.cooldownSec}s)`);
          return;
        }
        if (cardTimestamps.length >= settings.maxCardsPerHour) {
          log("hourly card cap reached");
          if (!hourlyCapNotified) {
            hourlyCapNotified = true;
            showToast(
              `Paused new words \u2014 you've hit your ${settings.maxCardsPerHour}/hour card limit. Reviews still appear. Raise it in Settings \u2192 Max cards per hour.`,
              "info"
            );
            const oldest = cardTimestamps[0] ?? now;
            setTimeout(() => {
              hourlyCapNotified = false;
            }, Math.max(6e4, oldest + 36e5 - now));
          }
          return;
        }
      }
      log("showing card for:", target.token.base);
      await handleCard(target, normalized, tokens, context, () => lensJudged() || staleSession()).catch((err) => {
        warn("handleCard failed:", err);
        dismissAgent();
      });
    }
    let episode = null;
    let episodeId = "";
    let timelineCue = -1;
    let netflixOffset = 0;
    const offsetSamples = [];
    let netflixAdBreak = false;
    let lastClock = null;
    let lastPageLineAt = 0;
    const subsDiag = {
      source: "none",
      jaLines: 0,
      english: "none",
      offsetMs: 0,
      adBreak: false,
      /** Netflix's own on-screen line against the track line we showed. */
      pageChecked: 0,
      pageMatched: 0,
      lastMismatch: ""
    };
    function onNetflixClock(d) {
      if (typeof d.playerSec !== "number" || typeof d.videoSec !== "number" || d.movieId !== netflixId()) return;
      const prev = lastClock;
      lastClock = { playerSec: d.playerSec, videoSec: d.videoSec };
      if (prev && d.videoSec - prev.videoSec > 0.4 && Math.abs(d.playerSec - prev.playerSec) < 0.05) {
        netflixAdBreak = true;
        subsDiag.adBreak = true;
        return;
      }
      netflixAdBreak = false;
      offsetSamples.push(d.playerSec - d.videoSec);
      if (offsetSamples.length > 7) offsetSamples.shift();
      const sorted = [...offsetSamples].sort((x, y) => x - y);
      const median = sorted[sorted.length >> 1];
      netflixOffset = Math.abs(median) < 0.08 ? 0 : median;
      subsDiag.offsetMs = Math.round(netflixOffset * 1e3);
    }
    function comparePageLine(text) {
      const ep = episode;
      if (!ep || timelineCue < 0) return;
      const flat = (s) => s.replace(/[\s　]/g, "");
      const page = flat(text);
      if (!page) return;
      subsDiag.pageChecked++;
      const near = [timelineCue - 1, timelineCue, timelineCue + 1].map((i) => ep.cues[i]?.text ?? "");
      if (near.some((c) => flat(c) === page || c && (flat(c).includes(page) || page.includes(flat(c))))) subsDiag.pageMatched++;
      else subsDiag.lastMismatch = `page "${text.slice(0, 30)}" vs ours "${(ep.cues[timelineCue]?.text ?? "").slice(0, 30)}"`;
    }
    let timelineFrame = 0;
    const TIMELINE_LEAD_SEC = 0.05;
    function netflixId() {
      return location.pathname.match(/\/watch\/(\d+)/)?.[1] || window.__avcNetflixVideoId || "";
    }
    function requestNetflixTracks() {
      if (signedIn !== true) return;
      if (!location.hostname.endsWith("netflix.com")) return;
      const movieId = netflixId();
      if (movieId) window.postMessage({ source: "avc-content", type: "avc-netflix-timedtext-request", movieId }, location.origin);
    }
    function useNetflixTracks(data2) {
      if (signedIn !== true) return;
      if (typeof data2.movieId !== "string" || data2.movieId !== netflixId()) return;
      const upgrade = data2.movieId === episodeId && episode?.source === "translation" && typeof data2.en?.text === "string";
      if (data2.movieId === episodeId && !upgrade) return;
      if (typeof data2.ja?.text !== "string") return;
      const ja = parseTimedText(data2.ja.text);
      if (ja.length < 5) return;
      const en = typeof data2.en?.text === "string" ? parseTimedText(data2.en.text) : null;
      episode?.stop();
      episodeId = data2.movieId;
      const ep = new EpisodeSubs(
        ja,
        en && en.length >= 5 ? en : null,
        currentTitle(),
        (payload) => chrome.runtime.sendMessage({ type: "avc-translate-batch", payload })
      );
      episode = ep;
      const video = adapter?.getVideo();
      ep.translateFrom(video ? cueAt(ep.cues, video.currentTime + netflixOffset) : 0);
      subsDiag.source = "track";
      subsDiag.jaLines = ja.length;
      subsDiag.english = ep.source === "track" ? "netflix" : "translated";
      subsDiag.pageChecked = subsDiag.pageMatched = 0;
      subsDiag.lastMismatch = "";
      timelineCue = -1;
      startTimeline();
      syncNativeSubs();
      if (upgrade) return;
      if (!settings) {
        void getSettings().then((s) => {
          if (!settings) settings = s;
          syncNativeSubs();
        }).catch(() => {
        });
      }
      log(`netflix tracks: ${ja.length} Japanese lines, English ${ep.source === "track" ? "from Netflix" : "translated ahead"}`);
      showToast(
        ep.source === "track" ? "Dual subtitles: Netflix's Japanese and English tracks, on the video's own timing." : "Dual subtitles: Netflix's Japanese track, with this episode's English translated ahead of time.",
        "info"
      );
    }
    function startTimeline() {
      cancelAnimationFrame(timelineFrame);
      const tick = () => {
        timelineFrame = requestAnimationFrame(tick);
        const ep = episode;
        const video = adapter?.getVideo();
        if (!ep || !video) return;
        const i = netflixAdBreak ? -1 : cueAt(ep.cues, video.currentTime + netflixOffset + TIMELINE_LEAD_SEC);
        if (i === timelineCue) return;
        if (Math.abs(i - timelineCue) > 2) ep.translateFrom(i);
        timelineCue = i;
        if (i < 0) {
          endLensLine();
          return;
        }
        onLine(ep.cues[i].text, { en: ep.englishAt(i) ?? "", cue: i });
        const next = ep.cues[i + 1];
        if (next && jaReady) void tokenizeJa(next.text);
      };
      timelineFrame = requestAnimationFrame(tick);
    }
    function stopTimeline() {
      cancelAnimationFrame(timelineFrame);
      timelineFrame = 0;
      episode?.stop();
      episode = null;
      episodeId = "";
      timelineCue = -1;
      syncNativeSubs();
    }
    function syncNativeSubs(known = settings) {
      const hide = !!episode && !!known && lensOn(known) && siteEnabled(known);
      let style = document.getElementById("avc-hide-native-subs");
      if (hide && !style) {
        style = document.createElement("style");
        style.id = "avc-hide-native-subs";
        style.textContent = ".player-timedtext { opacity: 0 !important; }";
        document.documentElement.append(style);
      }
      if (!hide) style?.remove();
      setLensBaseline(hide ? 0.9 : 0.76);
    }
    function loadCourse(refresh = false) {
      const generation = accountGeneration;
      const run = (async () => {
        if (signedIn !== true) {
          course2 = null;
          courseLoad = null;
          return;
        }
        let next = null;
        try {
          const res = await chrome.runtime.sendMessage({ type: "avc-n5-lesson", refresh });
          next = res?.ok ? res.lesson ?? null : null;
        } catch {
          next = course2;
        }
        const current2 = settings || await getSettings();
        if (signedIn !== true || generation !== accountGeneration) return;
        if (normalizeDirection(current2.learningDirection) !== "en-ja") next = null;
        course2 = next;
        setCourse(course2, course2 ? courseActions2 : null);
      })();
      courseLoad = run;
      return run;
    }
    const courseActions2 = {
      openLesson: () => {
        if (!course2) return;
        chrome.runtime.sendMessage({ type: "avc-open-url", url: lessonUrl(course2, "watch") }).catch(() => {
        });
      },
      finish: async () => {
        adapter?.getVideo()?.pause();
        const res = await chrome.runtime.sendMessage({ type: "avc-n5-finish" });
        if (!res?.ok) throw new Error(res?.error || "Practice could not open. Please try again.");
        listeningActive = false;
        stopCachePolling();
        stopPlaybackRelay();
      }
    };
    async function hearCourseWords(line) {
      if (!courseLoad) void loadCourse();
      await courseLoad;
      const lesson = course2;
      if (!lesson || studyLang() !== "ja") return;
      if (!await ensureJa()) return;
      const tokens = await tokenizeJa(line);
      if (course2 !== lesson) return;
      const ids = wordsHeard(tokens, lesson.words, (base) => lookup(base)?.reading ?? null);
      if (!ids.length) return;
      courseHeard(ids, line);
      const fresh = ids.filter((id) => !lesson.heard.includes(id));
      if (!fresh.length) return;
      lesson.heard = [...lesson.heard, ...fresh];
      chrome.runtime.sendMessage({ type: "avc-n5-heard", lessonId: lesson.id, wordIds: fresh }).catch(() => {
      });
    }
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === "avc-toast") {
        showToast(msg.text || "", msg.kind === "error" ? "error" : "info");
        return;
      }
      if (msg.type === "avc-limit-reached") {
        void reportLimitReached(msg.kind || "ai");
        return;
      }
      if (signedIn !== true) {
        if (msg.type === "avc-get-cache-key") sendResponse({ key: null });
        else if (msg.type === "avc-agent-show") sendResponse({ ok: false, visible: false });
        else if (msg.type === "avc-agent-status") sendResponse({ ok: true, visible: false });
        if (msg.type === "avc-get-cache-key" || msg.type === "avc-agent-show" || msg.type === "avc-agent-status" || msg.type === "avc-listening-state" || msg.type === "avc-transcript") return;
      }
      if (msg.type === "avc-get-cache-key") {
        refreshCacheKey();
        sendResponse({ key: cacheKey2 || null });
        return true;
      }
      if (msg.type === "avc-agent-show") {
        openAgent();
        void loadCourse();
        sendResponse({ ok: true, visible: true });
        return true;
      }
      if (msg.type === "avc-agent-hide") {
        closeAgentByUser();
        sendResponse({ ok: true, visible: false });
        return true;
      }
      if (msg.type === "avc-agent-status") {
        sendResponse({ ok: true, visible: isAgentActive() });
        return true;
      }
      if (msg.type === "avc-subs-diag") {
        sendResponse({ ok: true, diag: { ...subsDiag, translating: episode?.progress() ?? null, englishError: episode?.lastError ?? subs.lastError ?? null } });
        return true;
      }
      if (msg.type === "avc-caption-status") {
        const report = captionReport();
        sendResponse({ ok: true, report, detail: captionStatusDetail(report) });
        return true;
      }
      if (msg.type === "avc-listening-state") {
        listeningActive = !!msg.active;
        if (listeningActive) {
          void loadCourse(true);
          startCachePolling();
          startPlaybackRelay();
        } else {
          stopCachePolling();
          stopPlaybackRelay();
        }
        return;
      }
      if (msg.type !== "avc-transcript") return;
      handleTranscript(
        msg.text || "",
        typeof msg.start === "number" ? msg.start : void 0,
        typeof msg.end === "number" ? msg.end : void 0
      );
    });
    function handleTranscript(text, start, end) {
      if (episode) return;
      const pageLive = Date.now() - lastPageLineAt < 15e3;
      if (!pageLive) subsDiag.source = "audio";
      const a = pickAdapter();
      if (!a) {
        warn("transcript arrived but no adapter matched this frame");
        return;
      }
      const video = a.getVideo();
      if (!video) {
        log("transcript ignored (no video in this frame)");
        return;
      }
      const rawTranscript = text.trim();
      if (pipelineDisabled || !rawTranscript) return;
      const ahead = typeof start === "number" ? start - video.currentTime : 0;
      if (ahead > EARLY_LINE_TOLERANCE_SEC) {
        if (ahead > MAX_EARLY_HOLD_SEC) return;
        if (settings && lensOn(settings) && Date.now() - lastPageLineAt >= 15e3) {
          for (const piece of splitForLens(text.trim(), studyLang())) void prefetchEnglish(piece, a);
        }
        const sessionId = currentSessionId();
        const generation = cachePollGeneration;
        setTimeout(() => {
          if (currentSessionId() !== sessionId || cachePollGeneration !== generation) return;
          handleTranscript(text, start, end);
        }, ahead * 1e3 / (video.playbackRate || 1));
        return;
      }
      log("transcript received:", rawTranscript);
      if (typeof start === "number" && !emittedCueKeys.remember(`${start}:${rawTranscript}`)) return;
      const context = { en: contextForAudio(a, start), fromAudio: true };
      const seq = !pageLive && audioLineIsCurrent(video, start, end) ? showPacedLens(rawTranscript, context) : -1;
      const direction = normalizeDirection(settings?.learningDirection);
      const segments = rawTranscript.split(direction === "ja-en" ? /(?<=[.!?])\s+/ : /(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
      for (const seg of segments) onLine(seg, context, { lens: false, lensSeq: seq });
    }
    async function maybeExplainMissingCaptions() {
      if (captionNoticeShown) return;
      const report = captionReport();
      if (report.state !== "missing") return;
      let current2;
      try {
        current2 = await getSettings();
      } catch {
        return;
      }
      const direction = normalizeDirection(current2.learningDirection);
      const text = captionNoticeText(report, {
        listening: listeningActive,
        cardsOn: current2.pauseMode !== "off",
        lensOn: direction === "en-ja" && current2.subLens !== false
      });
      if (!text) return;
      captionNoticeShown = true;
      showToast(text, "info");
    }
    onCaptions(() => {
      void maybeExplainMissingCaptions();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.settings) return;
      getSettings().then((next) => {
        settings = next;
        setAdapterDirection(normalizeDirection(next.learningDirection));
        if (!lensOn(next) || !siteEnabled(next)) {
          cancelPacedLens();
          hideLens();
        }
        applyPanelSettings(next);
        syncNativeSubs();
        if (signedIn === false) syncSigninChip();
        if (courseLoad || course2) void loadCourse();
      }).catch(() => {
      });
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[SIGNIN_CHIP_DISMISSED_KEY]) {
        signinChipDismissed = changes[SIGNIN_CHIP_DISMISSED_KEY].newValue === true;
        syncSigninChip();
      }
      if (area !== "local" || !changes.syncToken) return;
      const next = isSignedIn(changes.syncToken.newValue);
      accountGeneration++;
      signedIn = next;
      lastContextTitle = "";
      if (next) {
        signinChipDismissed = false;
        unmountSigninChip();
        log("account gate: signed in, starting pipeline");
        pickAdapter();
        if (initialized) startWatchInterval();
        if (courseLoad || course2) void loadCourse(true);
      } else {
        log("account gate: signed out, stopping pipeline");
        stopSignedOutPipeline();
        void getSigninChipDismissed().then((dismissed) => {
          signinChipDismissed = dismissed;
          syncSigninChip();
        });
        course2 = null;
        courseLoad = null;
      }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      const change = changes[ONBOARDING_STORAGE_KEY];
      if (!change) return;
      if (!isFirstCardTransition(change.oldValue, change.newValue)) return;
      showToast("\u{1F389} First card saved. It comes back for review on its own.", "info", {
        label: "Open review dashboard",
        onClick: () => {
          chrome.runtime.sendMessage({ type: "avc-open-url", url: cloudAppUrl("review", "first_card_toast") }).catch(() => {
          });
        }
      });
    });
    async function restoreTabSession() {
      if (signedIn !== true) return;
      const generation = accountGeneration;
      let state;
      try {
        state = await chrome.runtime.sendMessage({ type: "avc-session-state" });
      } catch {
        return;
      }
      if (!state || signedIn !== true || generation !== accountGeneration) return;
      if (state.copilot || state.listening) void loadCourse();
      if (state.copilot) openAgent();
      if (state.listening && !listeningActive) {
        log("restoring listening session after reload");
        listeningActive = true;
        startCachePolling();
        startPlaybackRelay();
        void maybeExplainMissingCaptions();
      }
    }
    onAgentVisibility((open) => {
      chrome.runtime.sendMessage({ type: "avc-copilot-state", open }).catch(() => {
      });
    });
    void (async () => {
      await readAccountState();
      const initial = pickAdapter();
      lastSessionId = initial ? sessionIdentity(platformForAdapter(initial), studyLang()) : location.pathname;
      refreshCacheKey();
      if (signedIn === true) void restoreTabSession();
    })();
    const pickTimer = setInterval(() => {
      if (pickAdapter()) clearInterval(pickTimer);
    }, 2e3);
    setInterval(() => {
      pickAdapter();
      syncSigninChip();
      const sid = currentSessionId();
      if (sid !== lastSessionId) {
        lastSessionId = sid;
        targetedThisSession.clear();
        lastLine = "";
        cancelPacedLens();
        hideLens();
        dismissAgent();
        pendingLines.length = 0;
        judgedLensSeqs.clear();
        contextSubs.clear();
        subs.clear();
        pageHasEnglish = false;
        subsNoticeShown = false;
        emittedCueKeys.clear();
        lastContextTitle = "";
        resetCaptions();
        captionNoticeShown = false;
        refreshCacheKey();
        log("session reset for new video:", sid);
        stopTimeline();
        offsetSamples.length = 0;
        netflixOffset = 0;
        netflixAdBreak = false;
        lastClock = null;
        lastPageLineAt = 0;
        Object.assign(subsDiag, { source: "none", jaLines: 0, english: "none", offsetMs: 0, adBreak: false, pageChecked: 0, pageMatched: 0, lastMismatch: "" });
        requestNetflixTracks();
        prefetchAnimeContext(currentTitle());
      }
    }, 2e3);
    window.addEventListener("message", (e) => {
      if (e.source !== window) return;
      if (e.data?.source !== "avc") return;
      if (e.data.type === "avc-netflix-video-id" && e.data.videoId) {
        window.__avcNetflixVideoId = e.data.videoId;
        refreshCacheKey();
        requestNetflixTracks();
      }
      if (e.data.type === "avc-netflix-timedtext") useNetflixTracks(e.data);
      if (e.data.type === "avc-netflix-clock") onNetflixClock(e.data);
    });
    void setAgentPinned(false);
    requestNetflixTracks();
  })();
})();
