(function () {
  AVC.adapters = AVC.adapters || [];

  const adapter = AVC.adapters.find((a) => a.matches());
  if (!adapter) return;

  AVC.log("adapter chosen:", adapter.name);

  let initialized = false;
  let pipelineDisabled = false;
  let settings = null;
  let wordStates = {};
  let lastLine = "";
  let lastPath = location.pathname;
  const targetedThisSession = new Set();
  let watchInterval = null;

  async function ensureInit() {
    if (initialized || pipelineDisabled) return;
    try {
      await AVC.tokenizer.init();
      const data = await AVC.dict.load();
      AVC.log("dictionary loaded:", Object.keys(data).length, "entries");
      settings = await AVC.storage.getSettings();
      wordStates = await AVC.storage.getVocab();
      initialized = true;
      startWatchInterval();
    } catch (err) {
      pipelineDisabled = true;
      AVC.warn("pipeline init failed:", err);
    }
  }

  function startWatchInterval() {
    if (watchInterval) return;
    watchInterval = setInterval(async () => {
      const video = adapter.getVideo();
      if (!video || video.paused || video.ended) return;
      await AVC.storage.recordWatchTick();
    }, 60000);
  }

  async function refreshState() {
    settings = await AVC.storage.getSettings();
    wordStates = await AVC.storage.getVocab();
  }

  async function handleCard(target, sentence) {
    const video = adapter.getVideo();
    targetedThisSession.add(target.token.base);
    await AVC.storage.recordCardShown(target.token.base);

    const meta = {
      reading: target.entry.reading,
      gloss: target.entry.glosses[0] || "",
      level: target.entry.level,
      freqRank: target.entry.freqRank
    };

    let judgment;
    if (settings.pauseMode === "notify") {
      judgment = await new Promise((resolve) => {
        AVC.overlay.showToast(target, sentence, video, async () => {
          if (video && !video.paused) video.pause();
          const j = await AVC.overlay.showCard(target, sentence, video, {
            autoResumeSec: settings.autoResumeSec
          });
          resolve(j);
        });
      });
    } else {
      judgment = await AVC.overlay.showCard(target, sentence, video, {
        autoResumeSec: settings.autoResumeSec
      });
    }

    if (judgment && judgment !== "dismiss") {
      await AVC.storage.judgeWord(target.token.base, judgment, meta);
      await refreshState();
    }
  }

  async function onLine(text) {
    if (pipelineDisabled) return;

    settings = await AVC.storage.getSettings();

    if (settings.pauseMode === "off") return;

    const siteKey = adapter.name;
    if (settings.sites && settings.sites[siteKey] === false) return;

    await ensureInit();
    if (!initialized) return;

    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized === lastLine) return;
    lastLine = normalized;

    const tokens = await AVC.tokenizer.tokenize(normalized);
    await AVC.storage.recordSeen(tokens, wordStates, targetedThisSession);
    wordStates = await AVC.storage.getVocab();

    if (AVC.overlay.isOpen()) return;

    const target = AVC.scoring.pickTarget(tokens, wordStates, settings, targetedThisSession);
    if (!target) return;

    const stats = await AVC.storage.getStats();
    const now = Date.now();
    const cardTimestamps = stats.cardTimestamps || [];

    if (!target.isReview) {
      const lastCard = cardTimestamps.length ? cardTimestamps[cardTimestamps.length - 1] : 0;
      if (now - lastCard < settings.cooldownSec * 1000) return;
      if (cardTimestamps.length >= settings.maxCardsPerHour) return;
    }

    await handleCard(target, normalized);
  }

  adapter.start(onLine);

  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      targetedThisSession.clear();
      lastLine = "";
      AVC.log("session reset for new video");
    }
  }, 2000);
})();
