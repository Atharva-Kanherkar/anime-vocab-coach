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
      width: min(420px, 90vw);
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
    .avc-word { font-size: 44px; font-weight: bold; line-height: 1.1; }
    .avc-reading { font-size: 20px; color: #8b7cf6; margin: 6px 0 10px; }
    .avc-gloss { font-size: 17px; color: #f2f2f7; margin-bottom: 14px; }
    .avc-sentence {
      font-size: 15px; color: #9ca3af; line-height: 1.6;
      margin-bottom: 18px; padding: 10px 12px;
      background: rgba(255,255,255,.04); border-radius: 8px;
    }
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

  function highlightSentence(sentence, surface) {
    const escaped = surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return sentence.replace(new RegExp(escaped, "g"), (m) => `<mark>${m}</mark>`);
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
    chip.textContent = isReview ? "復習 · Review" : `N${6 - entry.level}-ish · #${entry.freqRank.toLocaleString()}`;

    const wordEl = document.createElement("div");
    wordEl.className = "avc-word";
    wordEl.textContent = token.surface;

    const readingEl = document.createElement("div");
    readingEl.className = "avc-reading";
    readingEl.textContent = entry.reading;

    const glossEl = document.createElement("div");
    glossEl.className = "avc-gloss";
    glossEl.textContent = entry.glosses.join(" · ");

    const sentenceEl = document.createElement("div");
    sentenceEl.className = "avc-sentence";
    sentenceEl.innerHTML = highlightSentence(sentence, token.surface);

    const buttons = document.createElement("div");
    buttons.className = "avc-buttons";

    const hint = document.createElement("div");
    hint.className = "avc-hint";

    card.appendChild(chip);
    card.appendChild(wordEl);

    if (isReview) {
      readingEl.style.display = "none";
      glossEl.style.display = "none";

      const showBtn = document.createElement("button");
      showBtn.className = "avc-show-answer";
      showBtn.textContent = "Show answer";
      showBtn.addEventListener("click", () => {
        readingEl.style.display = "";
        glossEl.style.display = "";
        showBtn.remove();
      });
      card.appendChild(showBtn);
    }

    card.appendChild(readingEl);
    card.appendChild(glossEl);
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

    const autoSec = options?.autoResumeSec || 0;
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
    toast.textContent = `${token.surface} ${entry.reading} — ${entry.glosses[0] || ""}`;
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
