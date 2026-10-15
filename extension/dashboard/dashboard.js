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
  var CWS_REVIEWS_URL = "https://chromewebstore.google.com/detail/lkjbomofgfonjjbemobacegffepbdnel/reviews";
  var REVIEW_PROMPT_MIN_MINED = 10;
  var REVIEW_PROMPT_MAX_ASKS = 2;
  var REVIEW_PROMPT_SNOOZE_MS = 14 * 24 * 36e5;
  var REVIEW_PROMPT_SNOOZE_EXTRA_CARDS = 20;
  var EMPTY_REVIEW_PROMPT = {
    dismissedForever: false,
    askCount: 0,
    snoozeUntil: 0,
    snoozeAfterCards: 0,
    lastShownAt: 0
  };
  function countMinedCards(vocab) {
    let n = 0;
    for (const rec of Object.values(vocab)) {
      if (rec.state === "known" || rec.state === "learning") n++;
    }
    return n;
  }
  function totalReviewsDone(stats) {
    let n = 0;
    for (const day of Object.values(stats.daily || {})) {
      n += day.reviews || 0;
    }
    return n;
  }
  function asBool(v) {
    if (v === true || v === 1) return true;
    if (typeof v === "string") return v.toLowerCase() === "true";
    return false;
  }
  function normalizeReviewPrompt(raw) {
    if (!raw || typeof raw !== "object") return { ...EMPTY_REVIEW_PROMPT };
    const o = raw;
    return {
      // Avoid `!!o.dismissedForever` — a legacy string "false" would become true.
      dismissedForever: asBool(o.dismissedForever),
      askCount: Math.max(0, Number(o.askCount) || 0),
      snoozeUntil: Math.max(0, Number(o.snoozeUntil) || 0),
      snoozeAfterCards: Math.max(0, Number(o.snoozeAfterCards) || 0),
      lastShownAt: Math.max(0, Number(o.lastShownAt) || 0)
    };
  }
  function shouldShowReviewPrompt(input) {
    const now = input.now ?? Date.now();
    if (input.blocked) return false;
    const { prompt } = input;
    if (prompt.dismissedForever) return false;
    const mined = countMinedCards(input.vocab);
    if (mined < REVIEW_PROMPT_MIN_MINED) return false;
    if (totalReviewsDone(input.stats) < 1) return false;
    const awaitingResponse = prompt.lastShownAt > 0 && prompt.snoozeUntil === 0 && prompt.askCount > 0 && prompt.askCount <= REVIEW_PROMPT_MAX_ASKS;
    if (awaitingResponse) return true;
    if (prompt.askCount >= REVIEW_PROMPT_MAX_ASKS) return false;
    if (prompt.snoozeUntil > 0 && now < prompt.snoozeUntil) return false;
    if (prompt.snoozeAfterCards > 0 && mined < prompt.snoozeAfterCards) return false;
    return true;
  }
  function applyShown(prompt, now = Date.now()) {
    return {
      ...prompt,
      lastShownAt: now,
      askCount: prompt.askCount + 1,
      snoozeUntil: 0,
      snoozeAfterCards: 0
    };
  }
  function shouldCountShown(prompt, now = Date.now()) {
    if (prompt.askCount >= REVIEW_PROMPT_MAX_ASKS) return false;
    if (prompt.lastShownAt === 0) return true;
    return prompt.snoozeUntil > 0 && now >= prompt.snoozeUntil;
  }
  function applyMaybeLater(prompt, minedCards, now = Date.now()) {
    return {
      ...prompt,
      snoozeUntil: now + REVIEW_PROMPT_SNOOZE_MS,
      snoozeAfterCards: minedCards + REVIEW_PROMPT_SNOOZE_EXTRA_CARDS
    };
  }
  function applyNoThanks(prompt) {
    return { ...prompt, dismissedForever: true };
  }
  function applyRate(prompt) {
    return { ...prompt, dismissedForever: true };
  }

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
  function localSetSettings(partial) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["settings"]);
      const settings = { ...withDefaults(r.settings || {}), ...partial };
      await chrome.storage.local.set({ settings });
      return settings;
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
  function getReviewPrompt() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["reviewPrompt"], (r) => {
        resolve(normalizeReviewPrompt(r.reviewPrompt));
      });
    });
  }
  function setReviewPrompt(next) {
    return enqueue2(async () => {
      const state = normalizeReviewPrompt(next);
      await chrome.storage.local.set({ reviewPrompt: state });
      return state;
    });
  }
  function recordReviewPromptShown(now = Date.now()) {
    return enqueue2(async () => {
      const r = await chrome.storage.local.get(["reviewPrompt"]);
      const prompt = normalizeReviewPrompt(r.reviewPrompt);
      if (!shouldCountShown(prompt, now)) return false;
      await chrome.storage.local.set({ reviewPrompt: applyShown(prompt, now) });
      return true;
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
  function judgeWord(base, judgment, meta, source) {
    return write("judgeWord", base, judgment, meta, source ?? null);
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

  // src/lib/review.ts
  function getDueWords(vocab, now = Date.now(), limit = 50) {
    const due = [];
    for (const base of Object.keys(vocab)) {
      const record = vocab[base];
      if (record.state === "learning" && record.srs && record.srs.dueAt <= now) {
        due.push({ base, record });
      }
    }
    due.sort((a, b) => a.record.srs.dueAt - b.record.srs.dueAt);
    return due.slice(0, limit);
  }

  // src/lib/levels.ts
  function commonnessShort(level) {
    switch (level) {
      case 5:
        return "Top";
      case 4:
        return "Common";
      case 3:
        return "Mid";
      case 2:
        return "Uncommon";
      default:
        return "Rare";
    }
  }

  // src/lib/review-prompt-ui.ts
  async function mountReviewPrompt(opts) {
    const { host, blocked = false, variant = "popup" } = opts;
    try {
      return await mountReviewPromptInner(host, blocked, variant);
    } catch {
      try {
        host.hidden = true;
        host.innerHTML = "";
      } catch {
      }
      return false;
    }
  }
  async function mountReviewPromptInner(host, blocked, variant) {
    const [vocab, stats, prompt] = await Promise.all([
      getVocab(),
      getStats(),
      getReviewPrompt()
    ]);
    const now = Date.now();
    if (!shouldShowReviewPrompt({ vocab, stats, prompt, blocked, now })) {
      host.hidden = true;
      host.innerHTML = "";
      return false;
    }
    if (await recordReviewPromptShown(now)) {
      trackExtensionEvent("review_prompt_shown");
    }
    const rootClass = variant === "popup" ? "av-review-prompt" : "rp-card";
    const btnPrimary = variant === "popup" ? "av-btn av-btn-primary av-btn-block" : "rp-btn rp-btn-primary";
    const btnGhost = variant === "popup" ? "av-btn av-btn-ghost av-btn-block" : "rp-btn rp-btn-ghost";
    const btnQuiet = variant === "popup" ? "av-btn av-btn-quiet av-btn-block" : "rp-btn rp-btn-quiet";
    host.hidden = false;
    host.innerHTML = `<div class="${rootClass}" role="region" aria-label="Rate AnimeVocab"><p class="${variant === "popup" ? "av-review-prompt-copy" : "rp-copy"}">Enjoying AnimeVocab? A rating helps other learners find it.</p><div class="${variant === "popup" ? "av-review-prompt-actions" : "rp-actions"}"><button type="button" class="${btnPrimary}" data-rp="rate">Rate on Chrome Web Store</button><button type="button" class="${btnGhost}" data-rp="later">Maybe later</button><button type="button" class="${btnQuiet}" data-rp="no">No thanks</button></div></div>`;
    const hide = () => {
      host.hidden = true;
      host.innerHTML = "";
    };
    const mined = countMinedCards(vocab);
    host.querySelector('[data-rp="rate"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyRate(current));
        trackExtensionEvent("review_prompt_clicked");
        chrome.tabs.create({ url: CWS_REVIEWS_URL });
        hide();
      })();
    });
    host.querySelector('[data-rp="later"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyMaybeLater(current, mined));
        hide();
      })();
    });
    host.querySelector('[data-rp="no"]')?.addEventListener("click", () => {
      void (async () => {
        const current = await getReviewPrompt();
        await setReviewPrompt(applyNoThanks(current));
        hide();
      })();
    });
    return true;
  }

  // src/entries/dashboard.ts
  var SVGNS = "http://www.w3.org/2000/svg";
  var C = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  var COL = {
    known: C("--known"),
    learning: C("--learning"),
    new: C("--new"),
    ignored: C("--ignored"),
    accent: C("--accent"),
    muted: C("--muted"),
    grid: C("--grid"),
    axis: C("--axis"),
    seq: ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"].map(C)
  };
  var tip = document.getElementById("tooltip");
  function showTip(html, ev) {
    tip.innerHTML = html;
    tip.hidden = false;
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > innerWidth) x = ev.clientX - w - pad;
    if (y + h > innerHeight) y = ev.clientY - h - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  var hideTip = () => {
    tip.hidden = true;
  };
  function el(tag, attrs, kids) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) n.setAttribute(k, String(attrs[k]));
    (kids || []).forEach((c) => n.appendChild(c));
    return n;
  }
  function svg(w, h) {
    return el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img" });
  }
  function txt(x, y, s, cls, anchor) {
    const t = el("text", { x, y, class: cls || "ax", "text-anchor": anchor || "start" });
    t.textContent = s;
    return t;
  }
  var todayKey2 = () => (/* @__PURE__ */ new Date()).toLocaleDateString("sv");
  var nf = (n) => n.toLocaleString();
  function computeStreak(daily) {
    const days = Object.keys(daily || {}).filter((d) => daily[d].judged >= 1).sort().reverse();
    if (!days.length) return 0;
    const today = todayKey2();
    const yest = new Date(Date.now() - 864e5).toLocaleDateString("sv");
    if (days[0] !== today && days[0] !== yest) return 0;
    let streak = 0, expect = days[0];
    for (const d of days) {
      if (d !== expect) break;
      streak++;
      expect = new Date((/* @__PURE__ */ new Date(expect + "T12:00:00")).getTime() - 864e5).toLocaleDateString("sv");
    }
    return streak;
  }
  function renderTiles(vocab, stats) {
    const v = Object.values(vocab);
    const known = v.filter((r) => r.state === "known").length;
    const learning = v.filter((r) => r.state === "learning").length;
    const seen = v.filter((r) => r.state === "new").length;
    const reviews = Object.values(stats.daily || {}).reduce((a, d) => a + (d.reviews || 0), 0);
    const mins = Object.values(stats.daily || {}).reduce((a, d) => a + (d.watchMin || 0), 0);
    const streak = computeStreak(stats.daily);
    const tiles = [
      { val: nf(known), lab: "Words known", cls: "known" },
      { val: nf(learning), lab: "Learning", cls: "learning" },
      { val: nf(seen), lab: "Seen (not yet judged)", cls: "" },
      { val: nf(reviews), lab: "Reviews done", cls: "accent" },
      { val: streak + "d", lab: "Current streak", cls: "" },
      { val: (mins / 60).toFixed(1) + "h", lab: "Watched", cls: "" }
    ];
    document.getElementById("tiles").innerHTML = tiles.map((t) => `<div class="tile"><div class="val ${t.cls}">${t.val}</div><div class="lab">${t.lab}</div></div>`).join("");
  }
  function renderTime(stats) {
    const host = document.getElementById("chart-time");
    const daily = stats.daily || {};
    const keys = Object.keys(daily).sort();
    const W = 640, H = 220, ml = 40, mr = 12, mt = 12, mb = 26;
    if (keys.length < 2) {
      host.innerHTML = '<p class="cap-note">Not enough days yet \u2014 come back after a few sessions.</p>';
      return;
    }
    let cum = 0;
    const pts = keys.map((k) => {
      cum += daily[k].met || 0;
      return { k, y: cum };
    });
    const maxY = Math.max(1, cum);
    const x = (i) => ml + i / (pts.length - 1) * (W - ml - mr);
    const y = (val) => mt + (1 - val / maxY) * (H - mt - mb);
    const s = svg(W, H);
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const val = Math.round(maxY / ticks * i);
      const yy = y(val);
      s.appendChild(el("line", { x1: ml, y1: yy, x2: W - mr, y2: yy, class: "gridline" }));
      s.appendChild(txt(ml - 6, yy + 3, nf(val), "ax-val", "end"));
    }
    let d = `M ${x(0)} ${y(pts[0].y)}`;
    pts.forEach((p, i) => {
      if (i) d += ` L ${x(i)} ${y(p.y)}`;
    });
    const area = d + ` L ${x(pts.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;
    const grad = el("linearGradient", { id: "areaGrad", x1: 0, y1: 0, x2: 0, y2: 1 }, [
      el("stop", { offset: "0%", "stop-color": COL.accent, "stop-opacity": ".35" }),
      el("stop", { offset: "100%", "stop-color": COL.accent, "stop-opacity": "0" })
    ]);
    s.appendChild(el("defs", {}, [grad]));
    s.appendChild(el("path", { d: area, fill: "url(#areaGrad)" }));
    s.appendChild(el("path", { d, fill: "none", stroke: COL.accent, "stroke-width": 2, "stroke-linejoin": "round" }));
    [0, Math.floor(pts.length / 2), pts.length - 1].forEach((i) => {
      const lab = pts[i].k.slice(5);
      s.appendChild(txt(x(i), H - 8, lab, "ax", i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"));
    });
    const hoverLine = el("line", { y1: mt, y2: H - mb, class: "baseline", opacity: 0 });
    const hoverDot = el("circle", { r: 4, fill: COL.accent, stroke: COL.grid, "stroke-width": 2, opacity: 0 });
    s.appendChild(hoverLine);
    s.appendChild(hoverDot);
    const hit = el("rect", { x: ml, y: mt, width: W - ml - mr, height: H - mt - mb, fill: "transparent" });
    s.appendChild(hit);
    hit.addEventListener("mousemove", (ev) => {
      const r = s.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      let i = Math.round((px - ml) / (W - ml - mr) * (pts.length - 1));
      i = Math.max(0, Math.min(pts.length - 1, i));
      hoverLine.setAttribute("x1", String(x(i)));
      hoverLine.setAttribute("x2", String(x(i)));
      hoverLine.setAttribute("opacity", "1");
      hoverDot.setAttribute("cx", String(x(i)));
      hoverDot.setAttribute("cy", String(y(pts[i].y)));
      hoverDot.setAttribute("opacity", "1");
      showTip(`<b>${nf(pts[i].y)}</b> words by ${pts[i].k}`, ev);
    });
    hit.addEventListener("mouseleave", () => {
      hideTip();
      hoverLine.setAttribute("opacity", "0");
      hoverDot.setAttribute("opacity", "0");
    });
    host.innerHTML = "";
    host.appendChild(s);
  }
  function renderDonut(vocab) {
    const host = document.getElementById("chart-donut");
    const v = Object.values(vocab);
    const segs = [
      { key: "known", lab: "Known", color: COL.known, n: v.filter((r2) => r2.state === "known").length },
      { key: "learning", lab: "Learning", color: COL.learning, n: v.filter((r2) => r2.state === "learning").length },
      { key: "new", lab: "Seen", color: COL.new, n: v.filter((r2) => r2.state === "new").length },
      { key: "ignored", lab: "Ignored", color: COL.ignored, n: v.filter((r2) => r2.state === "ignored").length }
    ].filter((seg) => seg.n > 0);
    const total = segs.reduce((a, seg) => a + seg.n, 0);
    const R = 74, r = 46, cx = 90, cy = 90;
    const s = svg(180, 180);
    if (!total) {
      host.innerHTML = '<p class="cap-note">No words yet.</p>';
      return;
    }
    let a0 = -Math.PI / 2;
    segs.forEach((seg) => {
      const frac = seg.n / total;
      const a1 = a0 + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const p = (ang, rad) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
      const path = el("path", {
        d: `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`,
        fill: seg.color,
        stroke: C("--card"),
        "stroke-width": 2
      });
      path.addEventListener("mousemove", (ev) => showTip(`<b>${seg.lab}</b>: ${nf(seg.n)} (${Math.round(frac * 100)}%)`, ev));
      path.addEventListener("mouseleave", hideTip);
      s.appendChild(path);
      a0 = a1;
    });
    s.appendChild(txt(cx, cy - 4, nf(total), "dlabel", "middle"));
    s.appendChild(txt(cx, cy + 12, "words", "ax", "middle"));
    const legend = document.createElement("ul");
    legend.className = "legend";
    legend.innerHTML = segs.map((seg) => `<li><span class="sw" style="background:${seg.color}"></span>${seg.lab} <b>${nf(seg.n)}</b></li>`).join("");
    host.innerHTML = "";
    host.appendChild(s);
    host.appendChild(legend);
  }
  function renderLevel(vocab) {
    const host = document.getElementById("chart-level");
    const levels = [5, 4, 3, 2, 1];
    const data2 = levels.map((lv) => {
      const words = Object.values(vocab).filter((r) => r.level === lv);
      return {
        n: commonnessShort(lv),
        known: words.filter((r) => r.state === "known").length,
        learning: words.filter((r) => r.state === "learning").length
      };
    });
    const maxV = Math.max(1, ...data2.map((d) => d.known + d.learning));
    const W = 320, H = 220, ml = 32, mr = 10, mt = 10, mb = 28;
    const bw = (W - ml - mr) / data2.length;
    const y = (val) => mt + (1 - val / maxV) * (H - mt - mb);
    const s = svg(W, H);
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxV / 4 * i), yy = y(val);
      s.appendChild(el("line", { x1: ml, y1: yy, x2: W - mr, y2: yy, class: "gridline" }));
      s.appendChild(txt(ml - 6, yy + 3, nf(val), "ax-val", "end"));
    }
    const base = H - mb;
    data2.forEach((d, i) => {
      const cx = ml + i * bw + bw / 2, w = Math.min(34, bw - 12);
      let yTop = base;
      [["learning", d.learning, COL.learning], ["known", d.known, COL.known]].forEach(([k, val, col]) => {
        if (!val) return;
        const h = val / maxV * (H - mt - mb);
        const yy = yTop - h;
        const rect = el("rect", { x: cx - w / 2, y: yy, width: w, height: Math.max(0, h - 2), rx: 3, fill: col });
        rect.addEventListener("mousemove", (ev) => showTip(`<b>${d.n}</b> ${k}: ${nf(val)}`, ev));
        rect.addEventListener("mouseleave", hideTip);
        s.appendChild(rect);
        yTop = yy;
      });
      s.appendChild(txt(cx, H - 9, d.n, "ax", "middle"));
    });
    s.appendChild(el("line", { x1: ml, y1: base, x2: W - mr, y2: base, class: "baseline" }));
    const legend = document.createElement("ul");
    legend.className = "legend";
    legend.style.gridAutoFlow = "column";
    legend.style.justifyContent = "center";
    legend.style.marginTop = "8px";
    legend.innerHTML = `<li><span class="sw" style="background:${COL.known}"></span>Known</li><li><span class="sw" style="background:${COL.learning}"></span>Learning</li>`;
    host.innerHTML = "";
    host.appendChild(s);
    host.appendChild(legend);
  }
  function renderSRS(vocab) {
    const host = document.getElementById("chart-srs");
    const now = Date.now();
    const learning = Object.values(vocab).filter((r) => r.state === "learning" && r.srs);
    const stages = [1, 2, 3, 4, 5].map((st) => ({
      st,
      label: "Stage " + st,
      n: learning.filter((r) => r.srs.stage === st).length,
      due: learning.filter((r) => r.srs.stage === st && r.srs.dueAt <= now).length
    }));
    const maxV = Math.max(1, ...stages.map((st) => st.n));
    const W = 320, H = 220, ml = 32, mr = 10, mt = 10, mb = 28;
    const bw = (W - ml - mr) / stages.length;
    const y = (val) => mt + (1 - val / maxV) * (H - mt - mb);
    const base = H - mb;
    const s = svg(W, H);
    for (let i = 0; i <= 4; i++) {
      const val = Math.round(maxV / 4 * i), yy = y(val);
      s.appendChild(el("line", { x1: ml, y1: yy, x2: W - mr, y2: yy, class: "gridline" }));
      s.appendChild(txt(ml - 6, yy + 3, nf(val), "ax-val", "end"));
    }
    stages.forEach((st, i) => {
      const cx = ml + i * bw + bw / 2, w = Math.min(34, bw - 12);
      const h = st.n / maxV * (H - mt - mb);
      const col = COL.seq[Math.min(5, st.st)];
      const rect = el("rect", { x: cx - w / 2, y: base - h, width: w, height: Math.max(0, h), rx: 3, fill: col });
      rect.addEventListener("mousemove", (ev) => showTip(`<b>Stage ${st.st}</b>: ${nf(st.n)} words${st.due ? ` \xB7 ${st.due} due now` : ""}`, ev));
      rect.addEventListener("mouseleave", hideTip);
      s.appendChild(rect);
      if (st.n) s.appendChild(txt(cx, base - h - 5, nf(st.n), "dlabel", "middle"));
      s.appendChild(txt(cx, H - 9, String(st.st), "ax", "middle"));
    });
    s.appendChild(el("line", { x1: ml, y1: base, x2: W - mr, y2: base, class: "baseline" }));
    const dueTotal = stages.reduce((a, st) => a + st.due, 0);
    host.innerHTML = "";
    if (!learning.length) {
      host.innerHTML = '<p class="cap-note">Mark words "Learn it" to build your review pipeline.</p>';
      return;
    }
    host.appendChild(s);
    const note = document.createElement("p");
    note.className = "cap-note";
    note.style.textAlign = "center";
    note.textContent = dueTotal ? `${dueTotal} word${dueTotal > 1 ? "s" : ""} due for review \u2014 use Review above, or they'll also surface as you watch.` : "Nothing due right now.";
    host.appendChild(note);
  }
  function renderCalendar(stats) {
    const host = document.getElementById("chart-cal");
    const daily = stats.daily || {};
    const WEEKS = 18, cell = 15, gap = 4, W = WEEKS * (cell + gap) + 30, H = 7 * (cell + gap) + 24;
    const s = svg(W, H);
    const end = /* @__PURE__ */ new Date(todayKey2() + "T12:00:00");
    const start = new Date(end.getTime() - (WEEKS * 7 - 1) * 864e5);
    start.setDate(start.getDate() - start.getDay());
    let max = 1;
    Object.values(daily).forEach((d) => {
      if (d.judged > max) max = d.judged;
    });
    const shade = (n) => {
      if (!n) return C("--surface");
      const idx = Math.min(COL.seq.length - 1, 1 + Math.floor(n / max * (COL.seq.length - 2)));
      return COL.seq[idx];
    };
    const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];
    dayLabels.forEach((l, i) => {
      if (l) s.appendChild(txt(0, 24 + i * (cell + gap) + cell - 3, l, "ax", "start"));
    });
    const cur = new Date(start);
    let col = 0, lastMonth = -1, lastLabelX = -100;
    while (cur <= end) {
      const wx = 30 + col * (cell + gap);
      for (let dow = 0; dow < 7; dow++) {
        if (cur > end) break;
        const key = cur.toLocaleDateString("sv");
        const d = daily[key];
        const n = d ? d.judged : 0;
        const y = 24 + dow * (cell + gap);
        const rect = el("rect", { x: wx, y, width: cell, height: cell, rx: 3, fill: shade(n) });
        if (d) {
          rect.addEventListener("mousemove", (ev) => showTip(`<b>${key}</b><br>${n} judged \xB7 ${d.met || 0} new \xB7 ${d.reviews || 0} reviews`, ev));
          rect.addEventListener("mouseleave", hideTip);
        }
        s.appendChild(rect);
        const m = cur.getMonth();
        if (dow === 0 && m !== lastMonth && wx - lastLabelX >= 28) {
          s.appendChild(txt(wx, 14, cur.toLocaleString("en", { month: "short" }), "ax", "start"));
          lastMonth = m;
          lastLabelX = wx;
        }
        cur.setDate(cur.getDate() + 1);
      }
      col++;
    }
    host.innerHTML = "";
    host.appendChild(s);
  }
  var VOCAB = {};
  var listFilter = "active";
  var listQuery = "";
  function relDue(dueAt) {
    if (!dueAt) return "\u2014";
    const diff = dueAt - Date.now();
    if (diff <= 0) return "now";
    const h = Math.round(diff / 36e5);
    return h < 24 ? `in ${h}h` : `in ${Math.round(diff / 864e5)}d`;
  }
  function renderList() {
    const tbody = document.getElementById("word-tbody");
    let rows = Object.entries(VOCAB);
    if (listFilter === "active") rows = rows.filter(([, r]) => r.state === "known" || r.state === "learning");
    else if (listFilter !== "all") rows = rows.filter(([, r]) => r.state === listFilter);
    if (listQuery) {
      const q = listQuery.toLowerCase();
      rows = rows.filter(([w, r]) => toRomaji(r.reading || "").includes(q) || w.toLowerCase().includes(q) || (r.reading || "").includes(q) || (r.gloss || "").toLowerCase().includes(q));
    }
    rows.sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0));
    const total = rows.length, shown = rows.slice(0, 300);
    document.getElementById("list-note").textContent = total > 300 ? `Showing 300 of ${total}` : `${total} word${total === 1 ? "" : "s"}`;
    tbody.innerHTML = shown.map(([w, r]) => {
      const romaji = toRomaji(r.reading || "");
      const due = r.state === "learning" && r.srs ? relDue(r.srs.dueAt) : "\u2014";
      return `<tr>
      <td class="romaji">${esc(romaji || w)}</td>
      <td class="jp">${esc(r.reading || "")}</td>
      <td class="jp">${esc(w)}</td>
      <td class="meaning">${esc(r.gloss || "")}</td>
      <td>${esc(commonnessShort(r.level))}</td>
      <td>${Number(r.seenCount) || 0}</td>
      <td><span class="state-tag ${esc(r.state)}">${esc(r.state)}</span></td>
      <td>${esc(due)}</td></tr>`;
    }).join("");
  }
  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function renderReview(vocab) {
    const host = document.getElementById("review");
    const due = getDueWords(vocab);
    if (!due.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    if (location.hash === "#review") {
      runReviewSession(host, due);
      return;
    }
    host.innerHTML = `<div class="review-intro"><h2>Review</h2><p>${due.length} word${due.length > 1 ? "s" : ""} due now.</p><button class="review-btn review-start" id="review-start" type="button">Start review</button></div>`;
    document.getElementById("review-start").addEventListener("click", () => runReviewSession(host, due));
  }
  function runReviewSession(host, due) {
    let i = 0;
    let reviewed = 0;
    const promptHost = document.getElementById("review-prompt");
    if (promptHost) {
      promptHost.hidden = true;
      promptHost.innerHTML = "";
    }
    const showCard = () => {
      if (i >= due.length) {
        host.innerHTML = `<div class="review-intro"><h2>Review complete</h2><p>${reviewed} reviewed. Nice work.</p></div>`;
        setTimeout(() => location.reload(), 900);
        return;
      }
      const { base, record } = due[i];
      const romaji = record.reading ? toRomaji(record.reading) : "";
      host.innerHTML = `<div class="review-session"><p class="review-progress">${i + 1} / ${due.length}</p><div class="review-word">${esc(base)}</div><div class="review-answer" id="review-answer" hidden><div class="review-reading">${esc(record.reading || "")}${romaji ? ` \xB7 ${esc(romaji)}` : ""}</div><div class="review-gloss">${esc(record.gloss || "")}</div>` + (record.source?.line ? `<div class="review-source">${esc(record.source.line)}${record.source.title ? ` \u2014 ${esc(record.source.title)}` : ""}</div>` : "") + `</div><div class="review-controls"><button class="review-btn" id="review-show" type="button">Show answer</button><span id="review-grade" hidden><button class="review-btn review-fail" id="review-miss" type="button">Missed it</button><button class="review-btn review-pass" id="review-got" type="button">Got it</button></span></div></div>`;
      document.getElementById("review-show").addEventListener("click", () => {
        document.getElementById("review-answer").hidden = false;
        document.getElementById("review-show").setAttribute("hidden", "");
        document.getElementById("review-grade").hidden = false;
      });
      let graded = false;
      const grade = async (judgment) => {
        if (graded) return;
        graded = true;
        document.getElementById("review-got")?.setAttribute("disabled", "");
        document.getElementById("review-miss")?.setAttribute("disabled", "");
        await judgeWord(base, judgment, {
          reading: record.reading,
          gloss: record.gloss,
          level: record.level,
          freqRank: record.freqRank
        });
        reviewed++;
        i++;
        showCard();
      };
      document.getElementById("review-got").addEventListener("click", () => void grade("review-pass"));
      document.getElementById("review-miss").addEventListener("click", () => void grade("review-fail"));
    };
    showCard();
  }
  async function boot() {
    const vocab = await getVocab();
    const stats = await getStats();
    VOCAB = vocab;
    if (!Object.keys(vocab).length) {
      document.getElementById("empty").hidden = false;
    }
    renderReview(vocab);
    renderTiles(vocab, stats);
    const reviewHost = document.getElementById("review");
    const inReviewSession = location.hash === "#review" || !!reviewHost?.querySelector(".review-session");
    await mountReviewPrompt({
      host: document.getElementById("review-prompt"),
      variant: "dashboard",
      blocked: inReviewSession
    });
    renderTime(stats);
    renderDonut(vocab);
    renderLevel(vocab);
    renderSRS(vocab);
    renderCalendar(stats);
    renderList();
    document.getElementById("word-search").addEventListener("input", (e) => {
      listQuery = e.target.value.trim();
      renderList();
    });
    document.querySelectorAll("#list-chips .chip").forEach((c) => c.addEventListener("click", () => {
      document.querySelectorAll("#list-chips .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
      listFilter = c.dataset.f;
      renderList();
    }));
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
