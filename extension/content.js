"use strict";
(() => {
  // src/lib/log.ts
  var log = (...args) => console.log("[AVC]", ...args);
  var warn = (...args) => console.warn("[AVC]", ...args);

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
        data = {};
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

  // src/lib/scoring.ts
  var ELIGIBLE_POS = ["\u540D\u8A5E", "\u52D5\u8A5E", "\u5F62\u5BB9\u8A5E", "\u526F\u8A5E"];
  var EXCLUDED_NOUN_POS1 = ["\u4EE3\u540D\u8A5E", "\u6570", "\u63A5\u5C3E", "\u975E\u81EA\u7ACB", "\u56FA\u6709\u540D\u8A5E"];
  function hasKanji(base) {
    return /[一-鿿]/.test(base);
  }
  function checkEligibility(token, wordStates, targetedSet, now = Date.now()) {
    const { base, pos, pos1 } = token;
    if (!ELIGIBLE_POS.includes(pos)) {
      return { eligible: false, countSeen: false };
    }
    if (pos === "\u540D\u8A5E" && EXCLUDED_NOUN_POS1.includes(pos1)) {
      return { eligible: false, countSeen: false };
    }
    if (base.length < 2 && !hasKanji(base) && !isEssentialWord(base)) {
      return { eligible: false, countSeen: false };
    }
    const entry = lookup(base);
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
  function collectEligible(tokens, wordStates, targetedSet) {
    const survivors = [];
    const now = Date.now();
    for (const token of tokens) {
      const check = checkEligibility(token, wordStates, targetedSet, now);
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
    for (const { token, entry } of newWords) {
      const essential = essentialBoost(token.base, settings.targetLevel);
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
    autoResumeSec: 0,
    displayScript: "romaji",
    autoSpeak: true,
    openaiKey: "",
    transcribeModel: "gpt-4o-mini-transcribe",
    sites: { youtube: true, netflix: true, generic: true }
  };
  var SRS_INTERVALS = [0, 4 * 36e5, 24 * 36e5, 3 * 24 * 36e5, 7 * 24 * 36e5, 21 * 24 * 36e5];

  // src/lib/storage.ts
  var queue = Promise.resolve();
  function todayKey() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv");
  }
  function enqueue(fn) {
    const next = queue.then(fn, fn);
    queue = next.catch((err) => warn("storage error:", err));
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
  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings"], (r) => {
        resolve({ ...DEFAULTS, ...r.settings || {} });
      });
    });
  }
  function setSettings(partial) {
    return enqueue(async () => {
      const r = await chrome.storage.local.get(["settings"]);
      const settings = { ...DEFAULTS, ...r.settings || {}, ...partial };
      await chrome.storage.local.set({ settings });
      return settings;
    });
  }
  function getAgentPinned() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["agentPinned"], (r) => resolve(!!r.agentPinned));
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
  function recordSeen(tokens, wordStates, targetedSet) {
    return enqueue(async () => {
      const r = await chrome.storage.local.get(["vocab", "stats"]);
      const vocab = { ...r.vocab || {} };
      const stats = r.stats || emptyStats();
      const day = todayKey();
      const daily = ensureDaily(stats, day);
      let changed = false;
      for (const token of tokens) {
        const eligibility = checkEligibility(token, wordStates, targetedSet);
        if (!eligibility.countSeen) continue;
        const entry = lookup(token.base);
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
      }
    });
  }
  function judgeWord(base, judgment, meta, source) {
    return enqueue(async () => {
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
      } else if (judgment === "review-pass") {
        if (rec.srs) {
          const newStage = rec.srs.stage + 1;
          if (newStage > 5) {
            rec.state = "known";
            rec.srs = null;
          } else {
            rec.srs.stage = newStage;
            rec.srs.dueAt = now + SRS_INTERVALS[newStage];
          }
        }
        daily.reviews += 1;
      } else if (judgment === "review-fail") {
        if (rec.srs) {
          rec.srs.stage = 1;
          rec.srs.lapses += 1;
          rec.srs.dueAt = now + SRS_INTERVALS[1];
        }
        daily.reviews += 1;
      }
      if (judgment !== "dismiss") {
        daily.judged += 1;
      }
      await chrome.storage.local.set({ vocab, stats });
      sendBadge(stats);
      return vocab[base];
    });
  }
  function recordCardShown(base) {
    return enqueue(async () => {
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
    });
  }
  function recordWatchTick() {
    return enqueue(async () => {
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
      chrome.storage.local.get(["syncToken"], (r) => resolve(r.syncToken || ""));
    });
  }

  // src/config.ts
  var BACKEND_URL = "https://api.animevocab.com";
  var WEB_URL = "https://animevocab.com";

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
  async function fetchCloudTts(text, token) {
    const res = await fetch(WEB_URL + "/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ text })
    });
    if (!res.ok) return null;
    return res.blob();
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
  async function speakText(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return { ok: false, error: "empty" };
    try {
      const settings = await getSettings();
      if (settings.openaiKey?.trim()) {
        const blob = await fetchByoTts(trimmed, settings.openaiKey.trim());
        if (blob) {
          await playBlob(blob);
          return { ok: true };
        }
      }
      const token = await getSyncToken();
      if (token) {
        const blob = await fetchCloudTts(trimmed, token);
        if (blob) {
          await playBlob(blob);
          return { ok: true };
        }
      }
      return { ok: false, error: "not_linked" };
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
  var disabled = false;
  function init() {
    if (disabled) return Promise.reject(new Error("tokenizer disabled"));
    if (initPromise) return initPromise;
    initPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: chrome.runtime.getURL("kuromoji/dict/") }).build((err, tk) => {
        if (err) {
          warn("tokenizer init failed:", err);
          disabled = true;
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
    await init();
    if (!tokenizerInstance) return [];
    return tokenizerInstance.tokenize(text).map((t) => ({
      surface: t.surface_form,
      base: t.basic_form === "*" ? t.surface_form : t.basic_form,
      reading: kataToHira(t.reading || ""),
      pos: t.pos,
      pos1: t.pos_detail_1
    }));
  }

  // src/lib/word-picker-client.ts
  var sessionCache = /* @__PURE__ */ new Map();
  function sessionKey(req) {
    const bases = req.candidates.map((c) => c.word).sort().join("|");
    return `${req.learnerLevel}:${req.line}:${bases}`;
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

  // src/lib/anime-context-client.ts
  var sessionCache2 = /* @__PURE__ */ new Map();
  async function fetchAnimeContext(title) {
    const clean = (title || "").trim();
    if (!clean) return null;
    const cached = sessionCache2.get(clean.toLowerCase());
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
  async function pickTargetSmart(tokens, wordStates, settings, targetedSet, line, title) {
    const { dueReview, newWords } = collectEligible(tokens, wordStates, targetedSet);
    if (dueReview) return dueReview;
    if (!newWords.length) return null;
    if (newWords.length === 1) return newWords[0];
    const candidates = newWords.slice(0, 12).map(({ token, entry }) => ({
      word: token.base,
      reading: entry.reading,
      gloss: entry.glosses[0] || "",
      level: entry.level,
      essential: isEssentialWord(token.base)
    }));
    const ai = await fetchWordPick({
      line,
      candidates,
      learnerLevel: settings.targetLevel,
      wordsKnown: countProgress(wordStates),
      title,
      animeContext: peekAnimeContext(title)
    });
    if (ai.ok && ai.word) {
      const match = newWords.find((t) => t.token.base === ai.word);
      if (match) return match;
    }
    return pickTargetHeuristic(newWords, wordStates, settings);
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

  // src/lib/agent-panel.ts
  var shell = null;
  var mounted = false;
  var wordPending = false;
  var wordResolve = null;
  var wordCtx = null;
  var chatHistory = [];
  var chatPayload = null;
  var keyHandler = null;
  var autoTimer = null;
  var playHandler = null;
  var userResumed = false;
  var activeVideo = null;
  var wasPlaying = false;
  var currentJudgments = [];
  var PANEL_MIN_W = 280;
  var PANEL_MAX_W = 560;
  var PANEL_DEFAULT_W = 340;
  var STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .avc-agent-layer {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
  }
  .avc-agent-ambient {
    position: absolute; inset: 0; pointer-events: none;
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
    --avc-panel-w: 340px;
    position: fixed; top: 0; right: 0; bottom: 0;
    width: var(--avc-panel-w);
    min-width: ${PANEL_MIN_W}px;
    max-width: min(${PANEL_MAX_W}px, 42vw);
    display: flex; flex-direction: column;
    pointer-events: auto;
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
  .avc-agent-word-block { display: none; }
  .avc-agent-word-block.avc-active { display: block; }
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
  @media (prefers-reduced-motion: reduce) {
    .avc-agent-ambient { transition: none; }
    .avc-agent-chat-msg.avc-streaming::after { animation: none; }
  }
`;
  function mountHost() {
    let host = document.getElementById("avc-overlay-host");
    const parent = document.fullscreenElement || document.body;
    if (!host) {
      host = document.createElement("div");
      host.id = "avc-overlay-host";
      host.style.cssText = "all:initial; position:fixed; inset:0; z-index:2147483647; pointer-events:none;";
      host.attachShadow({ mode: "open" });
    }
    if (host.parentElement !== parent) parent.appendChild(host);
    return host.shadowRoot;
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
  function setPanelWidth(sidebar, w) {
    const clamped = clampPanelWidth(w);
    sidebar.style.setProperty("--avc-panel-w", `${clamped}px`);
    sidebar.style.width = `${clamped}px`;
    sidebar.parentElement?.style.setProperty("--avc-panel-w", `${clamped}px`);
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
  function wordDisplays(token, entry, displayScript) {
    const roma = toRomaji(entry.reading);
    if (displayScript === "kana") return { big: entry.reading, secondary: `${roma} \xB7 ${token.surface}` };
    if (displayScript === "kanji") return { big: token.surface, secondary: `${entry.reading} \xB7 ${roma}` };
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
  function buildSentence(sentence, tokens, targetIndex, surface, displayScript) {
    const el = document.createElement("div");
    el.className = "avc-agent-sentence";
    const label = document.createElement("span");
    label.className = "avc-agent-label";
    label.textContent = tokens?.length ? "In this line" : "Line";
    el.appendChild(label);
    if (tokens?.length) {
      if (displayScript === "romaji") {
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
  function coachErrorText(resp) {
    if (!resp || resp.ok) return "";
    if (resp.error === "not_linked" || resp.error === "unauthorized") return "Sign in at animevocab.com to use AI.";
    if (resp.error === "quota_exceeded" || resp.error === "ai_quota_exhausted") return "Monthly AI limit reached.";
    if (resp.error === "ai_not_configured") return "AI is not configured on the server yet.";
    return "AI unavailable. Try again.";
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
      wordsKnown: ctx.options.wordsKnown ?? null
    };
  }
  function clearWordTimers() {
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    if (playHandler && activeVideo) {
      activeVideo.removeEventListener("play", playHandler);
      playHandler = null;
    }
    if (keyHandler) {
      window.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
    }
  }
  function resumeVideoIfNeeded() {
    if (wasPlaying && !userResumed && activeVideo?.paused) {
      activeVideo.play().catch(() => {
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
    }
    currentJudgments = [];
    if (fn) fn(judgment);
  }
  function bumpAutoTimer(opts) {
    if (autoTimer) clearTimeout(autoTimer);
    const sec = opts.autoResumeSec || 0;
    if (opts.interaction === "focus" && sec > 0) {
      autoTimer = setTimeout(() => finishWord("dismiss"), sec * 1e3);
    }
  }
  async function submitChat() {
    if (!shell) return;
    const payload = chatPayload || {
      word: "general",
      line: "The learner is watching anime with Japanese subtitles.",
      gloss: "",
      title: null
    };
    const text = shell.chatInput.value.trim();
    if (!text) return;
    shell.chatInput.value = "";
    appendChatBubble(shell.chatLog, "user", text);
    chatHistory.push({ role: "user", content: text });
    shell.chatSend.disabled = true;
    shell.chatInput.disabled = true;
    const streamBubble = appendChatBubble(shell.chatLog, "assistant", "", true);
    let full = "";
    let raf = 0;
    const flush = () => {
      raf = 0;
      updateStreamBubble(streamBubble, full);
    };
    try {
      const port = chrome.runtime.connect({ name: "avc-chat-stream" });
      await new Promise((resolve, reject) => {
        port.onMessage.addListener((msg) => {
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
          if (chrome.runtime.lastError && !full) reject(new Error("disconnected"));
        });
        port.postMessage({
          message: text,
          history: chatHistory.slice(0, -1),
          payload
        });
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
      const msg = err instanceof Error ? err.message : "network";
      finishStreamBubble(streamBubble, coachErrorText({ ok: false, error: msg }) || "Network error.");
    } finally {
      shell.chatSend.disabled = false;
      shell.chatInput.disabled = false;
      shell.chatInput.focus();
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
    const { token, entry, sentence, isReview, options: opts } = ctx;
    const displayScript = opts.displayScript || "romaji";
    shell.wordIdle.style.display = "none";
    shell.wordActive.classList.add("avc-active");
    shell.wordActive.textContent = "";
    shell.aiOut.classList.remove("avc-visible");
    shell.aiOut.textContent = "";
    chatHistory = [];
    shell.chatLog.textContent = "";
    chatPayload = payloadFromCtx(ctx);
    const chip = document.createElement("div");
    chip.className = isReview ? "avc-agent-chip avc-agent-chip-review" : "avc-agent-chip";
    chip.textContent = isReview ? "Review" : `${isEssentialWord(token.base) ? "Essential \xB7 " : ""}${commonnessLabel(entry.level)} \xB7 #${entry.freqRank.toLocaleString()}${opts.fromAudio ? " \xB7 heard" : ""}`;
    const displays = wordDisplays(token, entry, displayScript);
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
    const readingEl = document.createElement("div");
    readingEl.className = "avc-agent-reading";
    readingEl.textContent = displays.secondary;
    const glossEl = document.createElement("div");
    glossEl.className = "avc-agent-gloss";
    glossEl.textContent = entry.glosses.join(" \xB7 ");
    shell.wordActive.appendChild(chip);
    shell.wordActive.appendChild(wordRow);
    if (isReview) {
      readingEl.style.display = "none";
      glossEl.style.display = "none";
      const showBtn = document.createElement("button");
      showBtn.className = "avc-agent-show-answer";
      showBtn.type = "button";
      showBtn.textContent = "Show answer";
      showBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        readingEl.style.display = "";
        glossEl.style.display = "";
        showBtn.remove();
      });
      shell.wordActive.appendChild(showBtn);
    }
    shell.wordActive.appendChild(readingEl);
    shell.wordActive.appendChild(glossEl);
    if (opts.contextEn) {
      const ctxEl = document.createElement("div");
      ctxEl.className = "avc-agent-context";
      const lbl = document.createElement("span");
      lbl.className = "avc-agent-label";
      lbl.textContent = "English subtitle";
      ctxEl.appendChild(lbl);
      ctxEl.appendChild(document.createTextNode(opts.contextEn));
      shell.wordActive.appendChild(ctxEl);
    }
    shell.wordActive.appendChild(buildSentence(sentence, opts.tokens, opts.targetIndex, token.surface, displayScript));
    renderJudgmentButtons(ctx);
    if (opts.autoSpeak && opts.interaction === "focus") {
      setTimeout(() => speak(entry.reading || token.reading || token.surface), 250);
    }
    bumpAutoTimer(opts);
  }
  function buildShell(root) {
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
    head.appendChild(brand);
    head.appendChild(modeSelect);
    const scrollArea = document.createElement("div");
    scrollArea.className = "avc-agent-scroll";
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
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void submitChat();
      }
    });
    chatInput.addEventListener("click", (e) => e.stopPropagation());
    chatRow.appendChild(chatInput);
    chatRow.appendChild(chatSend);
    composer.appendChild(chatRow);
    panel.appendChild(head);
    panel.appendChild(scrollArea);
    panel.appendChild(foot);
    panel.appendChild(composer);
    sidebar.appendChild(resize);
    sidebar.appendChild(panel);
    layer.appendChild(ambient);
    layer.appendChild(sidebar);
    root.appendChild(layer);
    sidebar.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("fullscreenchange", () => {
      if (mounted) mountHost();
    });
    return {
      root,
      ambient,
      sidebar,
      panel,
      modeSelect,
      wordSection: scrollArea,
      scrollArea,
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
      hookBtn
    };
  }
  function ensureAgentMounted() {
    const root = mountHost();
    if (!root.querySelector("style")) {
      root.innerHTML = `<style>${STYLES}</style>`;
    }
    if (mounted && shell) return;
    shell = buildShell(root);
    mounted = true;
    preloadVoices();
    void Promise.all([getSettings(), getAgentPanelWidth()]).then(([s, w]) => {
      if (!shell) return;
      shell.modeSelect.value = s.pauseMode;
      applyInteractionMode(pauseModeToInteraction(s.pauseMode));
      setPanelWidth(shell.sidebar, w || PANEL_DEFAULT_W);
    });
  }
  function isOpen() {
    return wordPending;
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
    if (options.interaction === "focus" && wasPlaying && video) video.pause();
    if (video) {
      playHandler = () => {
        userResumed = true;
      };
      video.addEventListener("play", playHandler);
    }
    wordCtx = ctx;
    wordPending = true;
    populateWordSection(ctx);
    applyInteractionMode(options.interaction);
    keyHandler = (e) => {
      if (!wordPending) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      const match = currentJudgments.find((j) => j.key === e.key);
      if (match) {
        e.preventDefault();
        e.stopPropagation();
        finishWord(match.val);
      }
    };
    window.addEventListener("keydown", keyHandler, true);
    return new Promise((resolve) => {
      wordResolve = resolve;
    });
  }

  // src/lib/adapters/util.ts
  function normalize(text) {
    return text.replace(/\s+/g, " ").trim();
  }
  function hasJapanese(text) {
    return /[぀-ヿ㐀-䶿一-鿿]/.test(text);
  }

  // src/lib/adapters/youtube.ts
  var onLineCb = null;
  var jaCues = [];
  var enCues = [];
  var currentVideoId = "";
  var lastCueKey = "";
  var attachedVideo = null;
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
  async function fetchTrack(track) {
    const url = new URL(track.baseUrl, location.origin);
    url.searchParams.set("fmt", "json3");
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`timedtext HTTP ${res.status}`);
    const text = await res.text();
    if (!text) return [];
    return parseJson3(JSON.parse(text));
  }
  function pickTrack(tracks, langPrefix) {
    const matches = tracks.filter((t) => (t.languageCode || "").startsWith(langPrefix));
    return matches.find((t) => t.kind !== "asr") || matches[0] || null;
  }
  async function handleTracks(msg) {
    if (msg.videoId === currentVideoId) return;
    currentVideoId = msg.videoId;
    jaCues = [];
    enCues = [];
    lastCueKey = "";
    const jaTrack = pickTrack(msg.tracks, "ja");
    if (!jaTrack) {
      log("youtube: no Japanese caption track on this video \u2014 DOM fallback only");
      return;
    }
    try {
      jaCues = await fetchTrack(jaTrack);
    } catch (err) {
      jaCues = [];
    }
    if (!jaCues.length) {
      log("youtube: hidden caption track unavailable (YouTube blocks silent fetches). Use Listening Mode from the toolbar, or turn on Japanese captions to read them from the page.");
      return;
    }
    log(`youtube: loaded ${jaCues.length} Japanese cues (${jaTrack.kind === "asr" ? "auto-generated" : "manual"})`);
    const enTrack = pickTrack(msg.tracks, "en");
    if (enTrack) {
      try {
        enCues = await fetchTrack(enTrack);
        log(`youtube: loaded ${enCues.length} English cues for context`);
      } catch (err) {
        enCues = [];
      }
    }
  }
  function cueAt(cues, t) {
    for (const cue of cues) {
      if (t >= cue.start && t <= cue.end) return cue;
      if (cue.start > t) break;
    }
    return null;
  }
  function onTimeUpdate() {
    if (!jaCues.length || !onLineCb || !attachedVideo) return;
    const t = attachedVideo.currentTime;
    const cue = cueAt(jaCues, t);
    if (!cue) return;
    const key = `${cue.start}:${cue.text}`;
    if (key === lastCueKey) return;
    lastCueKey = key;
    if (!hasJapanese(cue.text)) return;
    const enCue = cueAt(enCues, (cue.start + cue.end) / 2);
    onLineCb(cue.text, { en: enCue ? enCue.text : "" });
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
    // Whatever subtitle is on screen right now, any language — used as
    // human-readable context alongside audio transcripts.
    getVisibleText,
    start(onLine) {
      onLineCb = onLine;
      window.addEventListener("message", (e) => {
        if (e.source !== window) return;
        if (e.data?.source !== "avc" || e.data.type !== "avc-caption-tracks") return;
        handleTracks(e.data).catch((err) => warn("youtube tracks error:", err));
      });
      setInterval(() => {
        const v = getVideo();
        if (v && v !== attachedVideo) {
          if (attachedVideo) attachedVideo.removeEventListener("timeupdate", onTimeUpdate);
          attachedVideo = v;
          v.addEventListener("timeupdate", onTimeUpdate);
        }
      }, 2e3);
      let lastText = "";
      let debounceTimer = null;
      const check = () => {
        try {
          if (jaCues.length) return;
          const text = getVisibleText();
          if (!text || text === lastText) return;
          if (!hasJapanese(text)) return;
          lastText = text;
          onLine(text, { en: "" });
        } catch (err) {
          warn("youtube adapter error:", err);
        }
      };
      const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(check, 100);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  };

  // src/lib/adapters/netflix.ts
  function getVisibleText2() {
    const rows = document.querySelectorAll(".player-timedtext-text-container");
    return normalize(Array.from(rows).map((r) => r.textContent || "").join(" "));
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
    start(onLine) {
      let lastText = "";
      let debounceTimer = null;
      const check = () => {
        try {
          const text = getVisibleText2();
          if (!text || text === lastText) return;
          if (!hasJapanese(text)) return;
          lastText = text;
          onLine(text, { en: "" });
        } catch (err) {
          warn("netflix adapter error:", err);
        }
      };
      const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(check, 100);
      });
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
          if (text) parts.push(text.replace(/<[^>]+>/g, ""));
        }
      }
      return normalize(parts.join(" "));
    },
    start(onLine) {
      const hooked = /* @__PURE__ */ new WeakSet();
      const lastByTrack = /* @__PURE__ */ new WeakMap();
      const enContext = (video) => {
        for (const track of video.textTracks) {
          if (!(track.language || "").startsWith("en") || !track.activeCues) continue;
          const text = normalize(
            Array.from(track.activeCues).map((c) => c.text.replace(/<[^>]+>/g, "")).join(" ")
          );
          if (text) return text;
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
                  if (!cues || !cues.length) return;
                  const text = normalize(
                    Array.from(cues).map((c) => c.text.replace(/<[^>]+>/g, "")).join(" ")
                  );
                  const lastText = lastByTrack.get(track) || "";
                  if (!text || text === lastText) return;
                  if (!hasJapanese(text)) return;
                  lastByTrack.set(track, text);
                  onLine(text, { en: enContext(v) });
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

  // src/lib/cache-key.ts
  var ALLOWED_AUDIO_LANGS = /* @__PURE__ */ new Set(["ja", "en"]);
  function cacheKey(platform, contentId, audioLang) {
    const lang = ALLOWED_AUDIO_LANGS.has(audioLang) ? audioLang : "ja";
    if (platform === "generic") {
      return `fp:${contentId}:${lang}`;
    }
    return `${platform}:${contentId}:${lang}`;
  }
  function detectAudioLang(video) {
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
  function deriveCacheKey(platform, video) {
    const contentId = deriveContentId(platform);
    if (!contentId) return null;
    const audioLang = detectAudioLang(video);
    return { key: cacheKey(platform, contentId, audioLang), platform, contentId, audioLang };
  }
  function sessionIdentity(platform) {
    const id = deriveContentId(platform);
    const lang = detectAudioLang();
    return id ? `${platform}:${id}:${lang}` : location.pathname;
  }

  // src/lib/transcript-client.ts
  async function lookupTranscript(syncToken, cacheKey2, t, windowSec = 8) {
    const url = new URL(BACKEND_URL + "/v1/transcript");
    url.searchParams.set("key", cacheKey2);
    url.searchParams.set("t", String(t));
    url.searchParams.set("window", String(windowSec));
    const res = await fetch(url.toString(), {
      headers: { Authorization: "Bearer " + syncToken }
    });
    if (res.status === 401) throw new Error("not signed in");
    if (res.status === 429) throw new Error("monthly listening hours used up");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "transcript lookup HTTP " + res.status);
    }
    return res.json();
  }

  // src/entries/content.ts
  (function main() {
    if (window.__avcMainLoaded) {
      log("main already loaded, skipping re-init");
      return;
    }
    window.__avcMainLoaded = true;
    const adapters = [youtubeAdapter, netflixAdapter, genericAdapter];
    let adapter = null;
    let started = false;
    let initialized = false;
    let pipelineDisabled = false;
    let settings = null;
    let wordStates = {};
    let lastLine = "";
    let lastSessionId = "";
    const targetedThisSession = /* @__PURE__ */ new Set();
    let watchInterval = null;
    let cacheKey2 = "";
    let listeningActive = false;
    let cachePollTimer = null;
    let lastCacheCueKey = "";
    let playbackRelayTimer = null;
    function pickAdapter() {
      if (adapter) return adapter;
      adapter = adapters.find((a) => a.matches()) || null;
      if (adapter && !started) {
        started = true;
        log("adapter chosen:", adapter.name);
        adapter.start(onLine);
      }
      return adapter;
    }
    async function ensureInit() {
      if (initialized || pipelineDisabled) return;
      try {
        await init();
        const data2 = await load();
        log("dictionary loaded:", Object.keys(data2).length, "entries");
        settings = await getSettings();
        wordStates = await getVocab();
        initialized = true;
        startWatchInterval();
      } catch (err) {
        pipelineDisabled = true;
        warn("pipeline init failed:", err);
      }
    }
    function platformForAdapter(a) {
      if (a.name === "youtube") return "youtube";
      if (a.name === "netflix") return "netflix";
      if (location.hostname.endsWith("crunchyroll.com")) return "crunchyroll";
      return "generic";
    }
    function refreshCacheKey() {
      const a = pickAdapter();
      if (!a) return;
      const video = a.getVideo();
      const result = deriveCacheKey(platformForAdapter(a), video);
      cacheKey2 = result && result.audioLang === "ja" ? result.key : "";
    }
    async function pollCacheHit() {
      if (!listeningActive || !cacheKey2) return;
      const a = pickAdapter();
      const video = a?.getVideo();
      if (!video || video.paused) return;
      settings = await getSettings();
      const syncToken = await getSyncToken();
      if (!syncToken) return;
      const t = video.currentTime;
      try {
        const result = await lookupTranscript(syncToken, cacheKey2, t);
        if (!result.hit || !result.segments.length) return;
        for (const seg of result.segments) {
          const key = `${seg.start}:${seg.text}`;
          if (key === lastCacheCueKey) continue;
          lastCacheCueKey = key;
          if (!/[぀-ヿ一-鿿]/.test(seg.text)) continue;
          const en = a?.getVisibleText() || "";
          await onLine(seg.text, { en, fromAudio: true });
        }
      } catch (err) {
        warn("cache poll failed:", err);
      }
    }
    function startCachePolling() {
      if (cachePollTimer) return;
      refreshCacheKey();
      cachePollTimer = setInterval(() => {
        pollCacheHit().catch((err) => warn("cache poll error:", err));
      }, 800);
    }
    function stopCachePolling() {
      if (cachePollTimer) clearInterval(cachePollTimer);
      cachePollTimer = null;
      lastCacheCueKey = "";
    }
    function startPlaybackRelay() {
      if (playbackRelayTimer) return;
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
    function countProgress2(vocab) {
      let n = 0;
      for (const rec of Object.values(vocab)) {
        if (rec.state === "known" || rec.state === "learning") n++;
      }
      return n;
    }
    function prefetchAnimeContext(title) {
      if (!title || title === lastContextTitle) return;
      lastContextTitle = title;
      void fetchAnimeContext(title);
    }
    async function refreshState() {
      settings = await getSettings();
      wordStates = await getVocab();
    }
    async function handleCard(target, sentence, tokens, context) {
      const video = adapter ? adapter.getVideo() : null;
      targetedThisSession.add(target.token.base);
      await recordCardShown(target.token.base);
      settings = await getSettings();
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
        wordsKnown: countProgress2(wordStates)
      };
      const judgment = await showAgentPanel(target, sentence, video, cardOptions);
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
    async function onLine(text, context) {
      if (pipelineDisabled) return;
      settings = await getSettings();
      if (settings.pauseMode === "off") return;
      const siteKey = adapter ? adapter.name : "generic";
      if (settings.sites && settings.sites[siteKey] === false) return;
      await ensureInit();
      if (!initialized) return;
      const normalized = text.replace(/\s+/g, " ").trim();
      if (normalized === lastLine) return;
      lastLine = normalized;
      const tokens = await tokenize(normalized);
      await recordSeen(tokens, wordStates, targetedThisSession);
      wordStates = await getVocab();
      if (isOpen()) return;
      const target = await pickTargetSmart(
        tokens,
        wordStates,
        settings,
        targetedThisSession,
        normalized,
        currentTitle()
      );
      if (!target) {
        log("no target word in:", normalized);
        return;
      }
      const stats = await getStats();
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
          return;
        }
      }
      log("showing card for:", target.token.base);
      await handleCard(target, normalized, tokens, context);
    }
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === "avc-get-cache-key") {
        refreshCacheKey();
        sendResponse({ key: cacheKey2 || null });
        return true;
      }
      if (msg.type === "avc-agent-show") {
        ensureAgentMounted();
        sendResponse({ ok: true });
        return true;
      }
      if (msg.type === "avc-listening-state") {
        listeningActive = !!msg.active;
        if (listeningActive) {
          startCachePolling();
          startPlaybackRelay();
        } else {
          stopCachePolling();
          stopPlaybackRelay();
        }
        return;
      }
      if (msg.type !== "avc-transcript") return;
      const a = pickAdapter();
      if (!a) {
        warn("transcript arrived but no adapter matched this frame");
        return;
      }
      if (!a.getVideo()) {
        log("transcript ignored (no video in this frame)");
        return;
      }
      log("transcript received:", msg.text);
      const en = a.getVisibleText();
      const segments = (msg.text || "").split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
      (async () => {
        for (const seg of segments) {
          await onLine(seg, { en, fromAudio: true });
        }
      })().catch((err) => warn("transcript handling failed:", err));
    });
    pickAdapter();
    const pickTimer = setInterval(() => {
      if (pickAdapter()) clearInterval(pickTimer);
    }, 2e3);
    setInterval(() => {
      const a = pickAdapter();
      const sid = a ? sessionIdentity(platformForAdapter(a)) : location.pathname;
      if (sid !== lastSessionId) {
        lastSessionId = sid;
        targetedThisSession.clear();
        lastLine = "";
        lastCacheCueKey = "";
        lastContextTitle = "";
        refreshCacheKey();
        log("session reset for new video:", sid);
        prefetchAnimeContext(currentTitle());
      }
    }, 2e3);
    window.addEventListener("message", (e) => {
      if (e.source !== window) return;
      if (e.data?.source !== "avc") return;
      if (e.data.type === "avc-netflix-video-id" && e.data.videoId) {
        window.__avcNetflixVideoId = e.data.videoId;
        refreshCacheKey();
      }
    });
    refreshCacheKey();
    const initial = pickAdapter();
    lastSessionId = initial ? sessionIdentity(platformForAdapter(initial)) : location.pathname;
    void getAgentPinned().then((pinned) => {
      if (pinned) ensureAgentMounted();
    });
  })();
})();
