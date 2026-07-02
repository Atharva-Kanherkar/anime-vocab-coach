AVC.overlay = (function () {
  let open = false;
  let resolveFn = null;
  let keyHandler = null;
  let autoTimer = null;
  let playHandler = null;
  let userResumed = false;

  const STYLES = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .avc-scrim {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .avc-card {
      background: #1c1c24; color: #f2f2f7;
      border-radius: 14px; padding: 24px;
      width: min(440px, 90vw);
      pointer-events: auto;
      opacity: 0; transform: scale(0.96);
      transition: opacity 150ms ease, transform 150ms ease;
      font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
    }
    .avc-card.avc-visible { opacity: 1; transform: scale(1); }
    .avc-chip {
      display: inline-block; font-size: 11px; color: #9ca3af;
      background: rgba(139,124,246,.15); padding: 4px 10px;
      border-radius: 8px; margin-bottom: 12px;
    }
    .avc-word-row { display: flex; align-items: center; gap: 12px; }
    .avc-word { font-size: 42px; font-weight: bold; line-height: 1.1; letter-spacing: 0.5px; }
    .avc-speak {
      background: rgba(139,124,246,.15); color: #8b7cf6;
      border: 1px solid #8b7cf6; border-radius: 50%;
      width: 40px; height: 40px; min-width: 40px; cursor: pointer;
      font-size: 18px; line-height: 1;
    }
    .avc-secondary { font-size: 18px; color: #8b7cf6; margin: 6px 0 10px; }
    .avc-gloss { font-size: 17px; color: #f2f2f7; margin-bottom: 14px; }
    .avc-context {
      font-size: 14px; color: #f2f2f7; line-height: 1.5;
      margin-bottom: 10px; padding: 10px 12px;
      background: rgba(74,222,128,.08); border-left: 3px solid #4ade80;
      border-radius: 8px;
    }
    .avc-context .avc-label { display: block; font-size: 10px; color: #9ca3af; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 1px; }
    .avc-sentence {
      font-size: 15px; color: #9ca3af; line-height: 1.6;
      margin-bottom: 18px; padding: 10px 12px;
      background: rgba(255,255,255,.04); border-radius: 8px;
    }
    .avc-sentence .avc-label { display: block; font-size: 10px; color: #9ca3af; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 1px; }
    .avc-sentence .avc-ja-small { display: block; font-size: 12px; color: #6b7280; margin-top: 4px; }
    .avc-sentence mark {
      background: transparent; color: #8b7cf6; font-weight: bold;
    }
    .avc-buttons { display: flex; gap: 8px; margin-bottom: 10px; }
    .avc-buttons button {
      flex: 1; border-radius: 8px; padding: 10px 6px; cursor: pointer;
      border: 1px solid transparent; font-family: inherit;
    }
    .avc-buttons button span { display: block; font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .avc-know { background: rgba(74,222,128,.15); color: #4ade80; border-color: #4ade80; font-size: 16px; }
    .avc-learn { background: #8b7cf6; color: #fff; font-size: 16px; }
    .avc-learn span { color: rgba(255,255,255,.7); }
    .avc-ignore { background: transparent; color: #9ca3af; border-color: #9ca3af; font-size: 16px; }
    .avc-review-pass { background: #4ade80; color: #1c1c24; font-size: 16px; }
    .avc-review-pass span { color: rgba(28,28,36,.7); }
    .avc-review-fail { background: transparent; color: #f87171; border-color: #f87171; font-size: 16px; }
    .avc-show-answer {
      background: rgba(139,124,246,.2); color: #8b7cf6; border: 1px solid #8b7cf6;
      border-radius: 8px; padding: 10px 16px; cursor: pointer; font-size: 15px;
      margin-bottom: 14px; width: 100%;
    }
    .avc-hint { font-size: 11px; color: #9ca3af; text-align: center; }
    .avc-toast {
      position: fixed; bottom: 12px; left: 12px;
      background: #1c1c24; color: #f2f2f7; border-radius: 14px;
      padding: 10px 16px; font-size: 14px; pointer-events: auto;
      cursor: pointer; max-width: 360px;
      font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
      opacity: 0; transition: opacity 200ms ease;
      box-shadow: 0 4px 20px rgba(0,0,0,.4);
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

  // What the learner reads depends on displayScript. A scratch beginner
  // (romaji) leads with roman letters; kana/kanji modes for readers.
  function wordDisplays(token, entry, displayScript) {
    const romaji = AVC.romaji.toRomaji(entry.reading);
    if (displayScript === "kana") {
      return { big: entry.reading, secondary: `${romaji} · ${token.surface}` };
    }
    if (displayScript === "kanji") {
      return { big: token.surface, secondary: `${entry.reading} · ${romaji}` };
    }
    const secondary = token.surface === entry.reading
      ? entry.reading
      : `${entry.reading} · ${token.surface}`;
    return { big: romaji, secondary };
  }

  // Build the sentence box safely (no innerHTML on subtitle/transcript text).
  function buildSentence(sentence, tokens, targetIndex, surface, displayScript) {
    const el = document.createElement("div");
    el.className = "avc-sentence";

    const label = document.createElement("span");
    label.className = "avc-label";
    label.textContent = "In this line";
    el.appendChild(label);

    if (displayScript === "romaji" && tokens && tokens.length) {
      const pieces = AVC.romaji.sentencePieces(tokens, targetIndex);
      pieces.forEach((p, idx) => {
        const node = p.highlight ? document.createElement("mark") : document.createTextNode("");
        if (p.highlight) {
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
      video.play().catch(() => {});
    }
  }

  function showCard(target, sentence, video, options) {
    if (open) return Promise.resolve("dismiss");
    open = true;
    userResumed = false;

    const opts = options || {};
    const displayScript = opts.displayScript || "romaji";
    const { token, entry, isReview } = target;
    const wasPlaying = video && !video.paused && !video.ended;

    if (wasPlaying && video) video.pause();

    if (video) {
      playHandler = () => { userResumed = true; };
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
    chip.className = "avc-chip";
    chip.textContent = isReview
      ? "復習 · Review — you learned this word. Remember it?"
      : `N${entry.level}-ish · #${entry.freqRank.toLocaleString()}${opts.fromAudio ? " · 🎧 heard just now" : ""}`;

    const displays = wordDisplays(token, entry, displayScript);

    const wordRow = document.createElement("div");
    wordRow.className = "avc-word-row";
    const wordEl = document.createElement("div");
    wordEl.className = "avc-word";
    wordEl.textContent = displays.big;
    const speakBtn = document.createElement("button");
    speakBtn.className = "avc-speak";
    speakBtn.textContent = "🔊";
    speakBtn.title = "Hear it";
    speakBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      AVC.romaji.speak(token.surface);
    });
    wordRow.appendChild(wordEl);
    wordRow.appendChild(speakBtn);

    const secondaryEl = document.createElement("div");
    secondaryEl.className = "avc-secondary";
    secondaryEl.textContent = displays.secondary;

    const glossEl = document.createElement("div");
    glossEl.className = "avc-gloss";
    glossEl.textContent = entry.glosses.join(" · ");

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
        { cls: "avc-review-pass", ja: "覚えてた", en: "Got it", val: "review-pass", key: "1" },
        { cls: "avc-review-fail", ja: "忘れた", en: "Forgot", val: "review-fail", key: "2" }
      ];
      hint.textContent = "Esc to close · 1 / 2 keys work too";
    } else {
      judgments = [
        { cls: "avc-know", ja: "知ってる", en: "I know it", val: "know", key: "1" },
        { cls: "avc-learn", ja: "学ぶ", en: "Learn it", val: "learn", key: "2" },
        { cls: "avc-ignore", ja: "無視", en: "Ignore", val: "ignore", key: "3" }
      ];
      hint.textContent = "Esc to close · 1 / 2 / 3 keys work too";
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

    document.addEventListener("fullscreenchange", onFsChange);
    function onFsChange() {
      if (open) mountHost();
    }

    requestAnimationFrame(() => card.classList.add("avc-visible"));

    if (opts.autoSpeak) {
      setTimeout(() => AVC.romaji.speak(token.surface), 250);
    }

    const autoSec = opts.autoResumeSec || 0;
    if (autoSec > 0) {
      autoTimer = setTimeout(() => {
        finish(root, video, wasPlaying, "dismiss");
      }, autoSec * 1000);
    }

    return new Promise((resolve) => {
      resolveFn = (judgment) => {
        document.removeEventListener("fullscreenchange", onFsChange);
        resolve(judgment);
      };
    });
  }

  let toastTimer = null;

  function showToast(target, sentence, video, onOpen) {
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
    const romaji = AVC.romaji.toRomaji(entry.reading);
    toast.textContent = `${romaji} (${token.surface}) — ${entry.glosses[0] || ""}`;
    toast.onclick = () => {
      if (toastTimer) clearTimeout(toastTimer);
      toast.classList.remove("avc-visible");
      if (onOpen) onOpen();
    };

    requestAnimationFrame(() => toast.classList.add("avc-visible"));

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("avc-visible");
    }, 5000);
  }

  function isOpen() {
    return open;
  }

  return { showCard, showToast, isOpen, mountHost };
})();
