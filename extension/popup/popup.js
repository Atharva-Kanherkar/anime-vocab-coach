"use strict";
(() => {
  // src/lib/log.ts
  var warn = (...args) => console.warn("[AVC]", ...args);

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
  function enqueue(fn) {
    const next = queue.then(fn, fn);
    queue = next.catch((err) => warn("storage error:", err));
    return next;
  }
  function pruneTimestamps(timestamps) {
    const cutoff = Date.now() - 36e5;
    return (timestamps || []).filter((t) => t >= cutoff);
  }
  function emptyStats() {
    return { daily: {}, cardTimestamps: [] };
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
  function setWordState(base, state) {
    return enqueue(async () => {
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
  function exportAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings", "vocab", "stats"], (r) => {
        resolve({
          settings: { ...DEFAULTS, ...r.settings || {} },
          vocab: r.vocab || {},
          stats: r.stats || emptyStats(),
          exportedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      });
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

  // src/config.ts
  var PROMO_END_UTC = "2026-08-03T23:59:59.000Z";
  var CHECKOUT_URL = "https://checkout.dodopayments.com/buy/REPLACE_PRODUCT_ID";
  var PROMO_CHECKOUT_URL = "https://checkout.dodopayments.com/buy/REPLACE_PROMO_PRODUCT_ID";
  var PRO_REGULAR = {
    monthlyUsd: 10,
    yearlyUsd: 84,
    label: "$10/month or $84/year"
  };
  var PRO_PROMO = {
    monthlyUsd: 7,
    yearlyUsd: 59,
    label: "$7/month or $59/year"
  };
  function promoState(now = Date.now()) {
    const ends = Date.parse(PROMO_END_UTC);
    const active = now < ends;
    const daysLeft = active ? Math.max(0, Math.ceil((ends - now) / 864e5)) : 0;
    return {
      active,
      endsAt: PROMO_END_UTC,
      daysLeft,
      checkoutUrl: active ? PROMO_CHECKOUT_URL : CHECKOUT_URL,
      priceLabel: active ? PRO_PROMO.label : PRO_REGULAR.label,
      regularLabel: PRO_REGULAR.label,
      checkoutConfigured: !(active ? PROMO_CHECKOUT_URL : CHECKOUT_URL).includes("REPLACE_")
    };
  }
  function promoBannerText(state) {
    if (!state.active) return null;
    const dayWord = state.daysLeft === 1 ? "day" : "days";
    return `Launch pricing \u2014 ${PRO_PROMO.label} (${state.daysLeft} ${dayWord} left)`;
  }

  // src/lib/review.ts
  function dueCount(vocab, now = Date.now()) {
    let n = 0;
    for (const base of Object.keys(vocab)) {
      const r = vocab[base];
      if (r.state === "learning" && r.srs && r.srs.dueAt <= now) n++;
    }
    return n;
  }

  // src/entries/popup.ts
  function todayKey() {
    return (/* @__PURE__ */ new Date()).toLocaleDateString("sv");
  }
  function computeStreak(daily) {
    const days = Object.keys(daily || {}).filter((d) => daily[d].judged >= 1).sort().reverse();
    if (!days.length) return 0;
    const today = todayKey();
    const yesterday = new Date(Date.now() - 864e5).toLocaleDateString("sv");
    if (days[0] !== today && days[0] !== yesterday) return 0;
    let streak = 0;
    let expect = days[0] === today ? today : yesterday;
    for (const day of days) {
      if (day !== expect) break;
      streak += 1;
      const prev = new Date((/* @__PURE__ */ new Date(expect + "T12:00:00")).getTime() - 864e5);
      expect = prev.toLocaleDateString("sv");
    }
    return streak;
  }
  function countByState(vocab) {
    let known = 0;
    let learning = 0;
    let seen = 0;
    for (const rec of Object.values(vocab)) {
      if (rec.state === "known") known += 1;
      else if (rec.state === "learning") learning += 1;
      else if (rec.state === "new") seen += 1;
    }
    return { known, learning, seen };
  }
  function byId(id) {
    return document.getElementById(id);
  }
  async function render() {
    const settings = await getSettings();
    const vocab = await getVocab();
    const stats = await getStats();
    const day = todayKey();
    const daily = stats.daily?.[day] || { met: 0, judged: 0, reviews: 0, watchMin: 0 };
    byId("stat-met").textContent = String(daily.met);
    byId("stat-judged").textContent = String(daily.judged);
    byId("stat-reviews").textContent = String(daily.reviews);
    byId("stat-watch").textContent = String(daily.watchMin);
    const totals = countByState(vocab);
    byId("totals-row").innerHTML = `<span><span class="t-known">${totals.known}</span> known</span><span><span class="t-learning">${totals.learning}</span> learning</span><span><span class="t-num">${totals.seen}</span> seen</span>`;
    const streak = computeStreak(stats.daily);
    byId("streak").innerHTML = streak > 0 ? `<b>${streak}-day</b> streak` : "No streak yet";
    const due = dueCount(vocab);
    const reviewBtn = byId("review-due");
    if (due > 0) {
      reviewBtn.hidden = false;
      reviewBtn.textContent = `Review ${due} due word${due > 1 ? "s" : ""}`;
    } else {
      reviewBtn.hidden = true;
    }
    const recent = Object.entries(vocab).sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0)).slice(0, 10);
    const list = byId("recent-list");
    list.innerHTML = "";
    for (const [word, rec] of recent) {
      const romaji = toRomaji(rec.reading || "");
      const li = document.createElement("li");
      li.innerHTML = `
      <span class="word">${romaji || word}</span>
      <span class="reading">${word} \xB7 ${rec.gloss || rec.reading || ""}</span>
      <select data-word="${word}">
        <option value="new" ${rec.state === "new" ? "selected" : ""}>new</option>
        <option value="learning" ${rec.state === "learning" ? "selected" : ""}>learning</option>
        <option value="known" ${rec.state === "known" ? "selected" : ""}>known</option>
        <option value="ignored" ${rec.state === "ignored" ? "selected" : ""}>ignored</option>
      </select>
    `;
      list.appendChild(li);
    }
    list.querySelectorAll("select").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        const target = e.target;
        await setWordState(target.dataset.word, target.value);
      });
    });
    byId("mode-pill").textContent = settings.pauseMode;
  }
  async function activeTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id ?? null;
  }
  async function initListening() {
    const btn = byId("listen-btn");
    const errEl = byId("listen-error");
    const tabId = await activeTabId();
    if (tabId == null) return;
    const setUi = (listening) => {
      btn.classList.toggle("active", listening);
      btn.textContent = listening ? "Stop Listening Mode" : "Start Listening Mode";
    };
    chrome.runtime.sendMessage({ type: "avc-listen-status", tabId }, (res) => {
      setUi(!!res?.listening);
    });
    btn.addEventListener("click", () => {
      errEl.hidden = true;
      const starting = !btn.classList.contains("active");
      const type = starting ? "avc-listen-start" : "avc-listen-stop";
      chrome.runtime.sendMessage({ type, tabId }, (res) => {
        if (res?.ok) {
          setUi(starting);
        } else {
          errEl.textContent = res?.error || "Failed to toggle listening mode.";
          errEl.hidden = false;
        }
      });
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    const promo = promoState();
    const pill = byId("popup-promo");
    const banner = promoBannerText(promo);
    if (banner) {
      pill.hidden = false;
      pill.textContent = banner;
    }
    render();
    initListening();
    const modes = ["pause", "notify", "off"];
    byId("mode-pill").addEventListener("click", async (e) => {
      const settings = await getSettings();
      const idx = modes.indexOf(settings.pauseMode);
      const next = modes[(idx + 1) % modes.length];
      await setSettings({ pauseMode: next });
      e.target.textContent = next;
    });
    byId("dashboard-link").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    });
    byId("review-due").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html#review") });
    });
    byId("settings-link").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    byId("export-link").addEventListener("click", async (e) => {
      e.preventDefault();
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animevocab-export-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });
})();
