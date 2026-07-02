AVC.storage = (function () {
  let queue = Promise.resolve();

  const INTERVALS = [0, 4 * 3600e3, 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3, 21 * 24 * 3600e3];

  const DEFAULTS = {
    pauseMode: "pause",
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

  function todayKey() {
    return new Date().toLocaleDateString("sv");
  }

  function enqueue(fn) {
    queue = queue.then(fn).catch((err) => AVC.warn("storage error:", err));
    return queue;
  }

  function ensureDaily(stats, day) {
    if (!stats.daily) stats.daily = {};
    if (!stats.daily[day]) {
      stats.daily[day] = { met: 0, judged: 0, reviews: 0, watchMin: 0 };
    }
    return stats.daily[day];
  }

  function pruneTimestamps(timestamps) {
    const cutoff = Date.now() - 3600e3;
    return (timestamps || []).filter((t) => t >= cutoff);
  }

  function sendBadge(stats) {
    const day = todayKey();
    const judged = stats.daily?.[day]?.judged || 0;
    chrome.runtime.sendMessage({ type: "avc-badge", count: judged }).catch(() => {});
  }

  return {
    getSettings() {
      return new Promise((resolve) => {
        chrome.storage.local.get(["settings"], (r) => {
          resolve({ ...DEFAULTS, ...(r.settings || {}) });
        });
      });
    },

    setSettings(partial) {
      return enqueue(async () => {
        const r = await chrome.storage.local.get(["settings"]);
        const settings = { ...DEFAULTS, ...(r.settings || {}), ...partial };
        await chrome.storage.local.set({ settings });
        return settings;
      });
    },

    getVocab() {
      return new Promise((resolve) => {
        chrome.storage.local.get(["vocab"], (r) => resolve(r.vocab || {}));
      });
    },

    getStats() {
      return new Promise((resolve) => {
        chrome.storage.local.get(["stats"], (r) => {
          const stats = r.stats || { daily: {}, cardTimestamps: [] };
          stats.cardTimestamps = pruneTimestamps(stats.cardTimestamps);
          resolve(stats);
        });
      });
    },

    getWord(base) {
      return this.getVocab().then((v) => v[base] || null);
    },

    setWordState(base, state) {
      return enqueue(async () => {
        const r = await chrome.storage.local.get(["vocab"]);
        const vocab = r.vocab || {};
        if (!vocab[base]) return;
        vocab[base].state = state;
        if (state === "learning") {
          vocab[base].srs = { stage: 1, dueAt: Date.now() + INTERVALS[1], lapses: 0 };
        } else {
          vocab[base].srs = null;
        }
        await chrome.storage.local.set({ vocab });
      });
    },

    recordSeen(tokens, wordStates, targetedSet) {
      return enqueue(async () => {
        const r = await chrome.storage.local.get(["vocab", "stats"]);
        const vocab = { ...(r.vocab || {}) };
        const stats = r.stats || { daily: {}, cardTimestamps: [] };
        const day = todayKey();
        const daily = ensureDaily(stats, day);
        let changed = false;

        for (const token of tokens) {
          const eligibility = AVC.scoring.checkEligibility(token, wordStates, targetedSet);
          if (!eligibility.countSeen) continue;

          const entry = AVC.dict.lookup(token.base);
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
    },

    judgeWord(base, judgment, meta) {
      return enqueue(async () => {
        const r = await chrome.storage.local.get(["vocab", "stats"]);
        const vocab = r.vocab || {};
        const stats = r.stats || { daily: {}, cardTimestamps: [] };
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
          rec.srs = { stage: 1, dueAt: now + INTERVALS[1], lapses: 0 };
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
              rec.srs.dueAt = now + INTERVALS[newStage];
            }
          }
          daily.reviews += 1;
        } else if (judgment === "review-fail") {
          if (rec.srs) {
            rec.srs.stage = 1;
            rec.srs.lapses += 1;
            rec.srs.dueAt = now + INTERVALS[1];
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
    },

    recordCardShown(base) {
      return enqueue(async () => {
        const r = await chrome.storage.local.get(["vocab", "stats"]);
        const vocab = r.vocab || {};
        const stats = r.stats || { daily: {}, cardTimestamps: [] };
        const now = Date.now();

        stats.cardTimestamps = pruneTimestamps(stats.cardTimestamps);
        stats.cardTimestamps.push(now);

        if (vocab[base]) {
          vocab[base].shownCount = (vocab[base].shownCount || 0) + 1;
        }

        await chrome.storage.local.set({ vocab, stats });
      });
    },

    recordWatchTick() {
      return enqueue(async () => {
        const r = await chrome.storage.local.get(["stats"]);
        const stats = r.stats || { daily: {}, cardTimestamps: [] };
        const day = todayKey();
        const daily = ensureDaily(stats, day);
        daily.watchMin += 1;
        await chrome.storage.local.set({ stats });
      });
    },

    exportAll() {
      return new Promise((resolve) => {
        chrome.storage.local.get(["settings", "vocab", "stats"], (r) => {
          resolve({
            settings: { ...DEFAULTS, ...(r.settings || {}) },
            vocab: r.vocab || {},
            stats: r.stats || { daily: {}, cardTimestamps: [] },
            exportedAt: new Date().toISOString()
          });
        });
      });
    },

    resetProgress() {
      return enqueue(async () => {
        await chrome.storage.local.set({
          vocab: {},
          stats: { daily: {}, cardTimestamps: [] }
        });
        sendBadge({ daily: {} });
      });
    }
  };
})();
