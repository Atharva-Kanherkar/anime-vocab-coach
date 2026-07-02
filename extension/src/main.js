(function () {
  AVC.adapters = AVC.adapters || [];

  let adapter = null;
  let started = false;
  let initialized = false;
  let pipelineDisabled = false;
  let settings = null;
  let wordStates = {};
  let lastLine = "";
  let lastPath = location.pathname;
  const targetedThisSession = new Set();
  let watchInterval = null;

  // Adapters can start matching late (e.g. Crunchyroll's player iframe creates
  // its <video> well after document_idle), so keep looking until one matches.
  function pickAdapter() {
    if (adapter) return adapter;
    adapter = AVC.adapters.find((a) => a.matches()) || null;
    if (adapter && !started) {
      started = true;
      AVC.log("adapter chosen:", adapter.name);
      adapter.start(onLine);
    }
    return adapter;
  }

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
      const video = adapter && adapter.getVideo();
      if (!video || video.paused || video.ended) return;
      await AVC.storage.recordWatchTick();
    }, 60000);
  }

  async function refreshState() {
    settings = await AVC.storage.getSettings();
    wordStates = await AVC.storage.getVocab();
  }

  async function handleCard(target, sentence, tokens, context) {
    const video = adapter && adapter.getVideo();
    targetedThisSession.add(target.token.base);
    await AVC.storage.recordCardShown(target.token.base);

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
        AVC.overlay.showToast(target, sentence, video, async () => {
          if (video && !video.paused) video.pause();
          const j = await AVC.overlay.showCard(target, sentence, video, cardOptions);
          resolve(j);
        });
      });
    } else {
      judgment = await AVC.overlay.showCard(target, sentence, video, cardOptions);
    }

    if (judgment && judgment !== "dismiss") {
      await AVC.storage.judgeWord(target.token.base, judgment, meta);
      await refreshState();
    }
  }

  async function onLine(text, context) {
    if (pipelineDisabled) return;

    settings = await AVC.storage.getSettings();

    if (settings.pauseMode === "off") return;

    const siteKey = adapter ? adapter.name : "generic";
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
    if (!target) { AVC.log("no target word in:", normalized); return; }

    const stats = await AVC.storage.getStats();
    const now = Date.now();
    const cardTimestamps = stats.cardTimestamps || [];

    if (!target.isReview) {
      const lastCard = cardTimestamps.length ? cardTimestamps[cardTimestamps.length - 1] : 0;
      if (now - lastCard < settings.cooldownSec * 1000) {
        AVC.log(`target "${target.token.base}" held back by cooldown (${settings.cooldownSec}s)`);
        return;
      }
      if (cardTimestamps.length >= settings.maxCardsPerHour) {
        AVC.log("hourly card cap reached");
        return;
      }
    }
    AVC.log("showing card for:", target.token.base);

    await handleCard(target, normalized, tokens, context);
  }

  // Listening mode: the offscreen document transcribes this tab's audio and the
  // background forwards Japanese text here. Only the frame that owns the video
  // handles it (matters on sites whose player lives in an iframe).
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "avc-transcript") return;
    const a = pickAdapter();
    if (!a) { AVC.warn("transcript arrived but no adapter matched this frame"); return; }
    if (!a.getVideo()) { AVC.log("transcript ignored (no video in this frame)"); return; }
    AVC.log("transcript received:", msg.text);
    const en = a.getVisibleText ? a.getVisibleText() : "";
    const segments = msg.text
      .split(/(?<=[。！？])/)
      .map((s) => s.trim())
      .filter(Boolean);
    (async () => {
      for (const seg of segments) {
        await onLine(seg, { en, fromAudio: true });
      }
    })().catch((err) => AVC.warn("transcript handling failed:", err));
  });

  pickAdapter();
  const pickTimer = setInterval(() => {
    if (pickAdapter()) clearInterval(pickTimer);
  }, 2000);

  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      targetedThisSession.clear();
      lastLine = "";
      AVC.log("session reset for new video");
    }
  }, 2000);
})();
