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

  // src/lib/scoring.ts
  var ELIGIBLE_POS = ["\u540D\u8A5E", "\u52D5\u8A5E", "\u5F62\u5BB9\u8A5E", "\u526F\u8A5E"];
  var EXCLUDED_NOUN_POS1 = ["\u4EE3\u540D\u8A5E", "\u6570", "\u63A5\u5C3E", "\u975E\u81EA\u7ACB", "\u56FA\u6709\u540D\u8A5E"];
  function hasKanji(base) {
    return /[一-鿿]/.test(base);
  }
  function checkEligibility(token, wordStates, targetedSet) {
    const { base, pos, pos1 } = token;
    if (!ELIGIBLE_POS.includes(pos)) {
      return { eligible: false, countSeen: false };
    }
    if (pos === "\u540D\u8A5E" && EXCLUDED_NOUN_POS1.includes(pos1)) {
      return { eligible: false, countSeen: false };
    }
    if (base.length < 2 && !hasKanji(base)) {
      return { eligible: false, countSeen: false };
    }
    const entry = lookup(base);
    if (!entry) {
      return { eligible: false, countSeen: false };
    }
    const state = wordStates[base]?.state;
    if (state === "known" || state === "ignored") {
      return { eligible: false, countSeen: true, entry };
    }
    if (targetedSet && targetedSet.has(base)) {
      return { eligible: false, countSeen: true, entry };
    }
    return { eligible: true, countSeen: true, entry };
  }
  function pickTarget(tokens, wordStates, settings, targetedSet) {
    const survivors = [];
    for (const token of tokens) {
      const check = checkEligibility(token, wordStates, targetedSet);
      if (check.eligible && check.entry) {
        survivors.push({ token, entry: check.entry });
      }
    }
    const now = Date.now();
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
      return { token: pick.token, entry: pick.entry, isReview: true };
    }
    let best = null;
    let bestScore = -1;
    for (const { token, entry } of survivors) {
      const freqScore = 1 - Math.min(entry.freqRank, 2e4) / 2e4;
      const levelScore = 1 - Math.abs(entry.level - settings.targetLevel) / 4;
      const familiarity = Math.min(wordStates[token.base]?.seenCount || 0, 5) / 5;
      const score = 0.45 * freqScore + 0.35 * levelScore + 0.2 * familiarity;
      if (score < 0.35) continue;
      if (!best || score > bestScore || score === bestScore && entry.freqRank < best.entry.freqRank) {
        bestScore = score;
        best = { token, entry, isReview: false };
      }
    }
    return best;
  }

  // src/types.ts
  var DEFAULTS = {
    pauseMode: "pause",
    cooldownSec: 20,
    maxCardsPerHour: 12,
    targetLevel: 5,
    autoResumeSec: 0,
    displayScript: "romaji",
    autoSpeak: true,
    openaiKey: "",
    licenseKey: "",
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
  function judgeWord(base, judgment, meta) {
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
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = 0.85;
      const ja = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith("ja"));
      if (ja) u.voice = ja;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (err) {
      warn("tts failed:", err);
    }
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

  // src/lib/overlay.ts
  var open = false;
  var resolveFn = null;
  var keyHandler = null;
  var autoTimer = null;
  var playHandler = null;
  var userResumed = false;
  var STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .avc-scrim {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.5);
    display: flex; align-items: center; justify-content: center;
    pointer-events: auto;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .avc-card {
    background: #101012; color: rgba(240,239,236,.95);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 12px; padding: 26px 26px 20px;
    width: min(440px, 90vw);
    pointer-events: auto;
    opacity: 0; transform: translateY(6px);
    transition: opacity 160ms ease, transform 160ms ease;
    font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
    box-shadow: 0 24px 60px rgba(0,0,0,.55);
  }
  .avc-card.avc-visible { opacity: 1; transform: translateY(0); }
  @media (prefers-reduced-motion: reduce) {
    .avc-card { transition: none; transform: none; }
  }
  .avc-chip {
    display: inline-block; font-size: 10.5px; letter-spacing: .06em;
    text-transform: uppercase; color: rgba(240,239,236,.5);
    border: 1px solid rgba(255,255,255,.12); padding: 3px 9px;
    border-radius: 4px; margin-bottom: 16px;
  }
  .avc-chip.avc-chip-review { color: #d96c4f; border-color: rgba(217,108,79,.45); }
  .avc-word-row { display: flex; align-items: baseline; gap: 14px; }
  .avc-word { font-size: 42px; font-weight: 700; line-height: 1.1; letter-spacing: .01em; }
  .avc-speak {
    background: transparent; color: rgba(240,239,236,.55);
    border: 1px solid rgba(255,255,255,.16); border-radius: 6px;
    padding: 4px 12px; cursor: pointer;
    font-size: 11.5px; letter-spacing: .04em; line-height: 1.6;
    font-family: system-ui, sans-serif;
    transition: color 120ms ease, border-color 120ms ease;
  }
  .avc-speak:hover { color: rgba(240,239,236,.9); border-color: rgba(255,255,255,.35); }
  .avc-secondary { font-size: 17px; color: rgba(240,239,236,.6); margin: 8px 0 10px; }
  .avc-gloss { font-size: 16px; color: rgba(240,239,236,.9); margin-bottom: 16px; line-height: 1.45; }
  .avc-context {
    font-size: 14px; color: rgba(240,239,236,.85); line-height: 1.55;
    margin-bottom: 10px; padding: 10px 14px;
    background: rgba(255,255,255,.03);
    border-left: 2px solid rgba(240,239,236,.3);
    border-radius: 0 6px 6px 0;
  }
  .avc-context .avc-label { display: block; font-size: 10px; color: rgba(240,239,236,.4); margin-bottom: 4px; text-transform: uppercase; letter-spacing: .08em; }
  .avc-sentence {
    font-size: 15px; color: rgba(240,239,236,.6); line-height: 1.65;
    margin-bottom: 20px; padding: 10px 14px;
    background: rgba(255,255,255,.03);
    border-left: 2px solid rgba(255,255,255,.1);
    border-radius: 0 6px 6px 0;
  }
  .avc-sentence .avc-label { display: block; font-size: 10px; color: rgba(240,239,236,.4); margin-bottom: 4px; text-transform: uppercase; letter-spacing: .08em; }
  .avc-sentence .avc-ja-small { display: block; font-size: 12px; color: rgba(240,239,236,.4); margin-top: 5px; }
  .avc-sentence mark {
    background: transparent; color: #d96c4f; font-weight: 700;
  }
  .avc-buttons { display: flex; gap: 8px; margin-bottom: 12px; }
  .avc-buttons button {
    flex: 1; border-radius: 7px; padding: 10px 6px 8px; cursor: pointer;
    border: 1px solid transparent; font-family: inherit;
    transition: filter 120ms ease, border-color 120ms ease;
  }
  .avc-buttons button:hover { filter: brightness(1.15); }
  .avc-buttons button span { display: block; font-size: 10.5px; margin-top: 3px; letter-spacing: .02em; }
  .avc-know {
    background: transparent; color: rgba(240,239,236,.85);
    border-color: rgba(255,255,255,.18); font-size: 16px;
  }
  .avc-know span { color: rgba(240,239,236,.45); }
  .avc-learn { background: #c4553a; color: #fff; font-size: 16px; }
  .avc-learn span { color: rgba(255,255,255,.65); }
  .avc-ignore {
    background: transparent; color: rgba(240,239,236,.45);
    border-color: rgba(255,255,255,.1); font-size: 16px;
  }
  .avc-ignore span { color: rgba(240,239,236,.3); }
  .avc-review-pass { background: #3d8a63; color: #fff; font-size: 16px; }
  .avc-review-pass span { color: rgba(255,255,255,.65); }
  .avc-review-fail {
    background: transparent; color: #c96a5a;
    border-color: rgba(201,106,90,.5); font-size: 16px;
  }
  .avc-review-fail span { color: rgba(201,106,90,.6); }
  .avc-show-answer {
    background: transparent; color: rgba(240,239,236,.85);
    border: 1px solid rgba(255,255,255,.2);
    border-radius: 7px; padding: 10px 16px; cursor: pointer; font-size: 14px;
    margin-bottom: 16px; width: 100%;
    font-family: system-ui, sans-serif;
    transition: border-color 120ms ease;
  }
  .avc-show-answer:hover { border-color: rgba(255,255,255,.4); }
  .avc-hint { font-size: 10.5px; color: rgba(240,239,236,.35); text-align: center; letter-spacing: .02em; }
  .avc-toast {
    position: fixed; bottom: 14px; left: 14px;
    background: #101012; color: rgba(240,239,236,.95);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    padding: 10px 16px; font-size: 14px; pointer-events: auto;
    cursor: pointer; max-width: 360px;
    font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
    opacity: 0; transition: opacity 200ms ease;
    box-shadow: 0 8px 30px rgba(0,0,0,.5);
  }
  .avc-toast.avc-visible { opacity: 1; }
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
  function wordDisplays(token, entry, displayScript) {
    const roma = toRomaji(entry.reading);
    if (displayScript === "kana") {
      return { big: entry.reading, secondary: `${roma} \xB7 ${token.surface}` };
    }
    if (displayScript === "kanji") {
      return { big: token.surface, secondary: `${entry.reading} \xB7 ${roma}` };
    }
    const secondary = token.surface === entry.reading ? entry.reading : `${entry.reading} \xB7 ${token.surface}`;
    return { big: roma, secondary };
  }
  function buildSentence(sentence, tokens, targetIndex, surface, displayScript) {
    const el = document.createElement("div");
    el.className = "avc-sentence";
    const label = document.createElement("span");
    label.className = "avc-label";
    label.textContent = "In this line";
    el.appendChild(label);
    if (displayScript === "romaji" && tokens && tokens.length) {
      const pieces = sentencePieces(tokens, targetIndex ?? -1);
      pieces.forEach((p, idx) => {
        if (p.highlight) {
          const node = document.createElement("mark");
          node.textContent = p.text;
          el.appendChild(node);
        } else {
          el.appendChild(document.createTextNode(p.text));
        }
        if (idx < pieces.length - 1) el.appendChild(document.createTextNode(" "));
      });
      const jaSmall = document.createElement("span");
      jaSmall.className = "avc-ja-small";
      jaSmall.textContent = sentence;
      el.appendChild(jaSmall);
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
  function cleanup(root, video) {
    open = false;
    if (keyHandler) {
      window.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
    }
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    if (playHandler && video) {
      video.removeEventListener("play", playHandler);
      playHandler = null;
    }
    userResumed = false;
    if (root) root.innerHTML = "";
  }
  function finish(root, video, wasPlaying, judgment) {
    const fn = resolveFn;
    cleanup(root, video);
    resolveFn = null;
    if (fn) fn(judgment);
    if (wasPlaying && !userResumed && video && video.paused) {
      video.play().catch(() => {
      });
    }
  }
  function showCard(target, sentence, video, options) {
    if (open) return Promise.resolve("dismiss");
    open = true;
    userResumed = false;
    const opts = options || {};
    const displayScript = opts.displayScript || "romaji";
    const { token, entry, isReview } = target;
    const wasPlaying = !!(video && !video.paused && !video.ended);
    if (wasPlaying && video) video.pause();
    if (video) {
      playHandler = () => {
        userResumed = true;
      };
      video.addEventListener("play", playHandler);
    }
    const root = mountHost();
    root.innerHTML = `<style>${STYLES}</style>`;
    const scrim = document.createElement("div");
    scrim.className = "avc-scrim";
    const card = document.createElement("div");
    card.className = "avc-card";
    card.setAttribute("role", "dialog");
    const chip = document.createElement("div");
    chip.className = isReview ? "avc-chip avc-chip-review" : "avc-chip";
    chip.textContent = isReview ? "Review \u2014 you learned this word. Remember it?" : `N${entry.level} \xB7 #${entry.freqRank.toLocaleString()}${opts.fromAudio ? " \xB7 heard just now" : ""}`;
    const displays = wordDisplays(token, entry, displayScript);
    const wordRow = document.createElement("div");
    wordRow.className = "avc-word-row";
    const wordEl = document.createElement("div");
    wordEl.className = "avc-word";
    wordEl.textContent = displays.big;
    const speakBtn = document.createElement("button");
    speakBtn.className = "avc-speak";
    speakBtn.textContent = "Listen";
    speakBtn.title = "Hear it";
    speakBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      speak(token.surface);
    });
    wordRow.appendChild(wordEl);
    wordRow.appendChild(speakBtn);
    const secondaryEl = document.createElement("div");
    secondaryEl.className = "avc-secondary";
    secondaryEl.textContent = displays.secondary;
    const glossEl = document.createElement("div");
    glossEl.className = "avc-gloss";
    glossEl.textContent = entry.glosses.join(" \xB7 ");
    let contextEl = null;
    if (opts.contextEn) {
      contextEl = document.createElement("div");
      contextEl.className = "avc-context";
      const label = document.createElement("span");
      label.className = "avc-label";
      label.textContent = "English subtitle";
      contextEl.appendChild(label);
      contextEl.appendChild(document.createTextNode(opts.contextEn));
    }
    const sentenceEl = buildSentence(sentence, opts.tokens, opts.targetIndex, token.surface, displayScript);
    const buttons = document.createElement("div");
    buttons.className = "avc-buttons";
    const hint = document.createElement("div");
    hint.className = "avc-hint";
    card.appendChild(chip);
    card.appendChild(wordRow);
    if (isReview) {
      secondaryEl.style.display = "none";
      glossEl.style.display = "none";
      const showBtn = document.createElement("button");
      showBtn.className = "avc-show-answer";
      showBtn.textContent = "Show answer";
      showBtn.addEventListener("click", () => {
        secondaryEl.style.display = "";
        glossEl.style.display = "";
        showBtn.remove();
      });
      card.appendChild(showBtn);
    }
    card.appendChild(secondaryEl);
    card.appendChild(glossEl);
    if (contextEl) card.appendChild(contextEl);
    card.appendChild(sentenceEl);
    let judgments;
    if (isReview) {
      judgments = [
        { cls: "avc-review-pass", ja: "\u899A\u3048\u3066\u305F", en: "Got it", val: "review-pass", key: "1" },
        { cls: "avc-review-fail", ja: "\u5FD8\u308C\u305F", en: "Forgot", val: "review-fail", key: "2" }
      ];
      hint.textContent = "Esc to close \xB7 1 / 2 keys work too";
    } else {
      judgments = [
        { cls: "avc-know", ja: "\u77E5\u3063\u3066\u308B", en: "I know it", val: "know", key: "1" },
        { cls: "avc-learn", ja: "\u5B66\u3076", en: "Learn it", val: "learn", key: "2" },
        { cls: "avc-ignore", ja: "\u7121\u8996", en: "Ignore", val: "ignore", key: "3" }
      ];
      hint.textContent = "Esc to close \xB7 1 / 2 / 3 keys work too";
    }
    judgments.forEach((j) => {
      const btn = document.createElement("button");
      btn.className = j.cls;
      btn.innerHTML = `${j.ja}<span>${j.en}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        finish(root, video, wasPlaying, j.val);
      });
      buttons.appendChild(btn);
    });
    card.appendChild(buttons);
    card.appendChild(hint);
    scrim.appendChild(card);
    root.appendChild(scrim);
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) finish(root, video, wasPlaying, "dismiss");
    });
    card.addEventListener("click", (e) => e.stopPropagation());
    keyHandler = (e) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(root, video, wasPlaying, "dismiss");
        return;
      }
      const match = judgments.find((j) => j.key === e.key);
      if (match) {
        e.preventDefault();
        e.stopPropagation();
        finish(root, video, wasPlaying, match.val);
      }
    };
    window.addEventListener("keydown", keyHandler, true);
    const onFsChange = () => {
      if (open) mountHost();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    requestAnimationFrame(() => card.classList.add("avc-visible"));
    if (opts.autoSpeak) {
      setTimeout(() => speak(token.surface), 250);
    }
    const autoSec = opts.autoResumeSec || 0;
    if (autoSec > 0) {
      autoTimer = setTimeout(() => {
        finish(root, video, wasPlaying, "dismiss");
      }, autoSec * 1e3);
    }
    return new Promise((resolve) => {
      resolveFn = (judgment) => {
        document.removeEventListener("fullscreenchange", onFsChange);
        resolve(judgment);
      };
    });
  }
  var toastTimer = null;
  function showToast(target, _sentence, _video, onOpen) {
    const root = mountHost();
    if (!root.querySelector("style")) {
      root.innerHTML = `<style>${STYLES}</style>`;
    }
    let toast = root.querySelector(".avc-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "avc-toast";
      root.appendChild(toast);
    }
    const { token, entry } = target;
    const roma = toRomaji(entry.reading);
    toast.textContent = `${roma} (${token.surface}) \u2014 ${entry.glosses[0] || ""}`;
    toast.onclick = () => {
      if (toastTimer) clearTimeout(toastTimer);
      toast.classList.remove("avc-visible");
      if (onOpen) onOpen();
    };
    requestAnimationFrame(() => toast.classList.add("avc-visible"));
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("avc-visible");
    }, 5e3);
  }
  function isOpen() {
    return open;
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

  // src/config.ts
  var BACKEND_URL = "https://api.animevocab.com";

  // src/lib/transcript-client.ts
  async function lookupTranscript(licenseKey, cacheKey2, t, windowSec = 8) {
    const url = new URL(BACKEND_URL + "/v1/transcript");
    url.searchParams.set("key", cacheKey2);
    url.searchParams.set("t", String(t));
    url.searchParams.set("window", String(windowSec));
    const res = await fetch(url.toString(), {
      headers: { Authorization: "Bearer " + licenseKey }
    });
    if (res.status === 402) throw new Error("subscription inactive");
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
      if (!settings.licenseKey) return;
      const t = video.currentTime;
      try {
        const result = await lookupTranscript(settings.licenseKey, cacheKey2, t);
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
    async function refreshState() {
      settings = await getSettings();
      wordStates = await getVocab();
    }
    async function handleCard(target, sentence, tokens, context) {
      const video = adapter ? adapter.getVideo() : null;
      targetedThisSession.add(target.token.base);
      await recordCardShown(target.token.base);
      const meta = {
        reading: target.entry.reading,
        gloss: target.entry.glosses[0] || "",
        level: target.entry.level,
        freqRank: target.entry.freqRank
      };
      const cardOptions = {
        autoResumeSec: settings.autoResumeSec,
        displayScript: settings.displayScript || "romaji",
        autoSpeak: settings.autoSpeak !== false,
        contextEn: context?.en || "",
        fromAudio: !!context?.fromAudio,
        tokens,
        targetIndex: tokens.indexOf(target.token)
      };
      let judgment;
      if (settings.pauseMode === "notify") {
        judgment = await new Promise((resolve) => {
          showToast(target, sentence, video, async () => {
            if (video && !video.paused) video.pause();
            const j = await showCard(target, sentence, video, cardOptions);
            resolve(j);
          });
        });
      } else {
        judgment = await showCard(target, sentence, video, cardOptions);
      }
      if (judgment && judgment !== "dismiss") {
        await judgeWord(target.token.base, judgment, meta);
        await refreshState();
      }
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
      const target = pickTarget(tokens, wordStates, settings, targetedThisSession);
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
        refreshCacheKey();
        log("session reset for new video:", sid);
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
  })();
})();
