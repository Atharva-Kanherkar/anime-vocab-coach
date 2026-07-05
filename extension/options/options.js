"use strict";
(() => {
  // src/lib/log.ts
  var warn = (...args) => console.warn("[AVC]", ...args);

  // src/types.ts
  var DEFAULTS = {
    pauseMode: "copilot",
    cooldownSec: 20,
    maxCardsPerHour: 12,
    targetLevel: 5,
    autoResumeSec: 15,
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
  function getVocab() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["vocab"], (r) => resolve(r.vocab || {}));
    });
  }
  function setWordState(base, state) {
    return enqueue(async () => {
      const r = await chrome.storage.local.get(["vocab"]);
      const vocab2 = r.vocab || {};
      if (!vocab2[base]) return;
      vocab2[base].state = state;
      if (state === "learning") {
        vocab2[base].srs = { stage: 1, dueAt: Date.now() + SRS_INTERVALS[1], lapses: 0 };
      } else {
        vocab2[base].srs = null;
      }
      await chrome.storage.local.set({ vocab: vocab2 });
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
  function getSyncToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["syncToken"], (r) => resolve(r.syncToken || ""));
    });
  }
  function resetProgress() {
    return enqueue(async () => {
      await chrome.storage.local.set({ vocab: {}, stats: emptyStats() });
      sendBadge({ daily: {} });
    });
  }

  // src/config.ts
  var WEB_URL = "https://animevocab.com";

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

  // src/entries/options.ts
  var vocab = {};
  var filterState = "all";
  var searchQuery = "";
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
  function relativeDue(dueAt) {
    if (!dueAt) return "\u2014";
    const diff = dueAt - Date.now();
    if (diff <= 0) return "now";
    const hours = Math.round(diff / 36e5);
    if (hours < 24) return `in ${hours}h`;
    const days = Math.round(diff / 864e5);
    return `in ${days}d`;
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
    byId("autoSpeak").checked = s.autoSpeak !== false;
    byId("openaiKey").value = s.openaiKey || "";
    byId("transcribeModel").value = s.transcribeModel || "gpt-4o-mini-transcribe";
  }
  async function savePartial(partial) {
    await setSettings(partial);
    showSaved();
  }
  async function refreshCloudStatus() {
    const el = byId("cloud-status");
    const token = await getSyncToken();
    if (token) {
      el.textContent = "Linked to your account \u2014 sync and cloud Listening Mode are ready.";
      el.style.color = "var(--known, #4f9e78)";
    } else {
      el.innerHTML = `Not linked yet. <a href="${WEB_URL}/app" target="_blank" rel="noopener">Sign in at animevocab.com</a> and keep the tab open briefly.`;
      el.style.color = "";
    }
  }
  function renderTable() {
    const tbody = byId("word-tbody");
    tbody.innerHTML = "";
    let entries = Object.entries(vocab);
    if (filterState !== "all") {
      entries = entries.filter(([, rec]) => rec.state === filterState);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        ([word, rec]) => word.toLowerCase().includes(q) || (rec.reading || "").toLowerCase().includes(q) || (rec.gloss || "").toLowerCase().includes(q)
      );
    }
    entries.sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0));
    const total = entries.length;
    const shown = entries.slice(0, 200);
    byId("table-note").textContent = total > 200 ? `Showing 200 of ${total}` : `Showing ${total} of ${total}`;
    for (const [word, rec] of shown) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${word}</td>
      <td>${toRomaji(rec.reading || "")}<br><small>${rec.reading || ""}</small></td>
      <td>${rec.gloss || ""}</td>
      <td>${commonnessShort(rec.level)}</td>
      <td>${rec.seenCount || 0}</td>
      <td><select data-word="${word}">
        <option value="new" ${rec.state === "new" ? "selected" : ""}>new</option>
        <option value="learning" ${rec.state === "learning" ? "selected" : ""}>learning</option>
        <option value="known" ${rec.state === "known" ? "selected" : ""}>known</option>
        <option value="ignored" ${rec.state === "ignored" ? "selected" : ""}>ignored</option>
      </select></td>
      <td>${rec.state === "learning" && rec.srs ? relativeDue(rec.srs.dueAt) : "\u2014"}</td>
    `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("select").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        const target = e.target;
        const word = target.dataset.word;
        await setWordState(word, target.value);
        vocab = await getVocab();
        renderTable();
        showSaved();
      });
    });
  }
  document.addEventListener("DOMContentLoaded", async () => {
    await loadSettingsForm();
    await refreshCloudStatus();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.syncToken) void refreshCloudStatus();
    });
    vocab = await getVocab();
    renderTable();
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
    byId("displayScript").addEventListener("change", (e) => {
      savePartial({ displayScript: e.target.value });
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
    byId("search").addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderTable();
    });
    document.querySelectorAll("#state-chips .chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#state-chips .chip").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        filterState = btn.dataset.state;
        renderTable();
      });
    });
    byId("export-btn").addEventListener("click", async () => {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
      vocab = {};
      renderTable();
    });
  });
})();
