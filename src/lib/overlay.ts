import * as romaji from "./romaji";
import { lookup } from "./dictionary";
import type { DictEntry, DisplayScript, Judgment, Target, Token } from "../types";

let open = false;
let resolveFn: ((judgment: Judgment) => void) | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let autoTimer: ReturnType<typeof setTimeout> | null = null;
let playHandler: (() => void) | null = null;
let userResumed = false;

const STYLES = `
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
  .avc-romaji-line { margin-bottom: 4px; }
  .avc-ja-line { font-family: var(--jp, inherit); font-size: 15px; line-height: 1.7; }
  .avc-tok { cursor: pointer; border-bottom: 1px dotted rgba(240,239,236,.35); }
  .avc-tok:hover { color: #e3ba63; border-bottom-color: #e3ba63; }
  .avc-lookup { margin-top: 8px; font-size: 13px; color: rgba(240,239,236,.9); }
  .avc-lookup-word { font-weight: 600; }
  .avc-lookup-gloss { color: rgba(240,239,236,.7); }
  .avc-sentence mark {
    background: transparent; color: #d96c4f; font-weight: 700;
  }
  .avc-ai { margin: 4px 0 14px; }
  .avc-ai-btns { display: flex; gap: 8px; }
  .avc-ai-btn {
    flex: 1; padding: 7px 10px; font-size: 13px; cursor: pointer;
    background: rgba(227,186,99,.12); color: #f0efec;
    border: 1px solid rgba(227,186,99,.4); border-radius: 8px;
  }
  .avc-ai-btn:hover { background: rgba(227,186,99,.2); }
  .avc-ai-btn:disabled { opacity: .5; cursor: default; }
  .avc-ai-out { margin-top: 8px; font-size: 13px; line-height: 1.5; color: rgba(240,239,236,.9); }
  .avc-ai-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: rgba(240,239,236,.45); margin-top: 8px; }
  .avc-ai-hooks { margin: 4px 0 0 16px; }
  .avc-ai-hooks li { margin: 3px 0; }
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

export function mountHost(): ShadowRoot {
  let host = document.getElementById("avc-overlay-host");
  const parent = document.fullscreenElement || document.body;
  if (!host) {
    host = document.createElement("div");
    host.id = "avc-overlay-host";
    host.style.cssText = "all:initial; position:fixed; inset:0; z-index:2147483647; pointer-events:none;";
    host.attachShadow({ mode: "open" });
  }
  if (host.parentElement !== parent) parent.appendChild(host);
  return host.shadowRoot!;
}

// What the learner reads depends on displayScript. A scratch beginner
// (romaji) leads with roman letters; kana/kanji modes for readers.
function wordDisplays(token: Token, entry: { reading: string }, displayScript: DisplayScript) {
  const roma = romaji.toRomaji(entry.reading);
  if (displayScript === "kana") {
    return { big: entry.reading, secondary: `${roma} · ${token.surface}` };
  }
  if (displayScript === "kanji") {
    return { big: token.surface, secondary: `${entry.reading} · ${roma}` };
  }
  const secondary = token.surface === entry.reading
    ? entry.reading
    : `${entry.reading} · ${token.surface}`;
  return { big: roma, secondary };
}

// Show a tapped word's dictionary entry inline (textContent — safe).
function showLookup(out: HTMLElement, tk: Token, entry: DictEntry): void {
  out.textContent = "";
  out.style.display = "";
  const w = document.createElement("span");
  w.className = "avc-lookup-word";
  w.textContent = entry.reading && entry.reading !== tk.surface ? `${tk.surface}（${entry.reading}）` : tk.surface;
  const g = document.createElement("span");
  g.className = "avc-lookup-gloss";
  g.textContent = " — " + entry.glosses.slice(0, 3).join("; ");
  out.appendChild(w);
  out.appendChild(g);
}

// A tappable Japanese line: every word the dictionary knows is clickable and
// looks itself up (the Migaku "hover any word" behavior). The target word is
// highlighted. Non-dictionary spans render as plain text.
function buildTappableJa(tokens: Token[], targetIndex: number | undefined, lookupOut: HTMLElement): HTMLElement {
  const line = document.createElement("div");
  line.className = "avc-ja-line";
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
      s.className = "avc-tok";
      s.textContent = tk.surface;
      s.addEventListener("click", (e) => { e.stopPropagation(); showLookup(lookupOut, tk, entry); });
      line.appendChild(s);
    } else {
      line.appendChild(document.createTextNode(tk.surface));
    }
  });
  return line;
}

// Build the sentence box safely (no innerHTML on subtitle/transcript text).
function buildSentence(
  sentence: string,
  tokens: Token[] | undefined,
  targetIndex: number | undefined,
  surface: string,
  displayScript: DisplayScript
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "avc-sentence";

  const label = document.createElement("span");
  label.className = "avc-label";
  label.textContent = "In this line — tap any word to look it up";
  el.appendChild(label);

  if (tokens && tokens.length) {
    // Beginner romaji reading line on top (kept), then the tappable JP line.
    if (displayScript === "romaji") {
      const pieces = romaji.sentencePieces(tokens, targetIndex ?? -1);
      const romajiLine = document.createElement("div");
      romajiLine.className = "avc-romaji-line";
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
    lookupOut.className = "avc-lookup";
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

function cleanup(root: ShadowRoot | null, video: HTMLVideoElement | null): void {
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

function finish(root: ShadowRoot, video: HTMLVideoElement | null, wasPlaying: boolean, judgment: Judgment): void {
  const fn = resolveFn;
  cleanup(root, video);
  resolveFn = null;
  if (fn) fn(judgment);
  if (wasPlaying && !userResumed && video && video.paused) {
    video.play().catch(() => {});
  }
}

// ---------- AI coach on the card ----------
interface CoachResp { ok?: boolean; error?: string; result?: { meaning?: string; nuance?: string; hooks?: string[] }; }

function appendAiLine(out: HTMLElement, label: string, body: string): void {
  const l = document.createElement("div");
  l.className = "avc-ai-label";
  l.textContent = label;
  const p = document.createElement("div");
  p.className = "avc-ai-body";
  p.textContent = body; // textContent — never inject model output as HTML
  out.appendChild(l);
  out.appendChild(p);
}

function renderAi(out: HTMLElement, mode: "explain" | "hooks", resp: CoachResp | undefined): void {
  out.textContent = "";
  if (!resp || !resp.ok) {
    out.textContent =
      resp?.error === "not_linked" || resp?.error === "unauthorized" ? "Sign in at animevocab.com to use the AI coach."
      : resp?.error === "quota_exceeded" || resp?.error === "ai_quota_exhausted" ? "You've used this month's AI coach calls."
      : resp?.error === "ai_not_configured" ? "AI coach isn't set up on the server yet."
      : "AI coach unavailable. Try again.";
    return;
  }
  const r = resp.result || {};
  if (mode === "explain") {
    if (r.meaning) appendAiLine(out, "Meaning", r.meaning);
    if (r.nuance) appendAiLine(out, "Why said this way", r.nuance);
    if (!r.meaning && !r.nuance) out.textContent = "No explanation came back.";
  } else if (Array.isArray(r.hooks) && r.hooks.length) {
    const ul = document.createElement("ul");
    ul.className = "avc-ai-hooks";
    for (const h of r.hooks) { const li = document.createElement("li"); li.textContent = h; ul.appendChild(li); }
    out.appendChild(ul);
  } else {
    out.textContent = "No hooks came back.";
  }
}

// Explain / memory-hook buttons that call the coach for THIS word in THIS line
// (via the background, which holds the token and host permission).
function buildAiSection(token: Token, entry: DictEntry, sentence: string, title: string | null): HTMLElement {
  const ai = document.createElement("div");
  ai.className = "avc-ai";
  const btns = document.createElement("div");
  btns.className = "avc-ai-btns";
  const explainBtn = document.createElement("button");
  explainBtn.className = "avc-ai-btn";
  explainBtn.type = "button";
  explainBtn.textContent = "✨ Explain";
  const hookBtn = document.createElement("button");
  hookBtn.className = "avc-ai-btn";
  hookBtn.type = "button";
  hookBtn.textContent = "💡 Hooks";
  const out = document.createElement("div");
  out.className = "avc-ai-out";
  out.style.display = "none";
  btns.appendChild(explainBtn);
  btns.appendChild(hookBtn);
  ai.appendChild(btns);
  ai.appendChild(out);

  const ask = async (mode: "explain" | "hooks"): Promise<void> => {
    // Don't let auto-resume dismiss the card while the learner reads AI output.
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    explainBtn.disabled = true;
    hookBtn.disabled = true;
    out.style.display = "";
    out.textContent = "Thinking…";
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: "avc-coach",
        mode,
        payload: { word: token.base, reading: entry.reading, gloss: entry.glosses[0] || "", line: sentence, level: entry.level, title }
      })) as CoachResp | undefined;
      renderAi(out, mode, resp);
    } catch {
      out.textContent = "AI coach unavailable. Try again.";
    } finally {
      explainBtn.disabled = false;
      hookBtn.disabled = false;
    }
  };
  explainBtn.addEventListener("click", (e) => { e.stopPropagation(); void ask("explain"); });
  hookBtn.addEventListener("click", (e) => { e.stopPropagation(); void ask("hooks"); });
  return ai;
}

export interface CardOptions {
  autoResumeSec?: number;
  displayScript?: DisplayScript;
  autoSpeak?: boolean;
  contextEn?: string;
  fromAudio?: boolean;
  tokens?: Token[];
  targetIndex?: number;
  title?: string | null;
}

export function showCard(
  target: Target,
  sentence: string,
  video: HTMLVideoElement | null,
  options?: CardOptions
): Promise<Judgment> {
  if (open) return Promise.resolve("dismiss");
  open = true;
  userResumed = false;

  const opts = options || {};
  const displayScript: DisplayScript = opts.displayScript || "romaji";
  const { token, entry, isReview } = target;
  const wasPlaying = !!(video && !video.paused && !video.ended);

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
  chip.className = isReview ? "avc-chip avc-chip-review" : "avc-chip";
  chip.textContent = isReview
    ? "Review — you learned this word. Remember it?"
    : `N${entry.level} · #${entry.freqRank.toLocaleString()}${opts.fromAudio ? " · heard just now" : ""}`;

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
    romaji.speak(token.surface);
  });
  wordRow.appendChild(wordEl);
  wordRow.appendChild(speakBtn);

  const secondaryEl = document.createElement("div");
  secondaryEl.className = "avc-secondary";
  secondaryEl.textContent = displays.secondary;

  const glossEl = document.createElement("div");
  glossEl.className = "avc-gloss";
  glossEl.textContent = entry.glosses.join(" · ");

  let contextEl: HTMLDivElement | null = null;
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

  // AI coach, right on the card — explain the phrasing or get a memory hook for
  // this exact word in this exact line. Routed through the background (CORS),
  // and only works when linked to an account (otherwise a gentle prompt).
  card.appendChild(buildAiSection(token, entry, sentence, opts.title || null));

  interface ButtonSpec { cls: string; ja: string; en: string; val: Judgment; key: string; }
  let judgments: ButtonSpec[];
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

  keyHandler = (e: KeyboardEvent) => {
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
    setTimeout(() => romaji.speak(token.surface), 250);
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

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(
  target: Target,
  _sentence: string,
  _video: HTMLVideoElement | null,
  onOpen?: () => void
): void {
  const root = mountHost();
  if (!root.querySelector("style")) {
    root.innerHTML = `<style>${STYLES}</style>`;
  }

  let toast = root.querySelector<HTMLDivElement>(".avc-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "avc-toast";
    root.appendChild(toast);
  }

  const { token, entry } = target;
  const roma = romaji.toRomaji(entry.reading);
  toast.textContent = `${roma} (${token.surface}) — ${entry.glosses[0] || ""}`;
  toast.onclick = () => {
    if (toastTimer) clearTimeout(toastTimer);
    toast!.classList.remove("avc-visible");
    if (onOpen) onOpen();
  };

  requestAnimationFrame(() => toast!.classList.add("avc-visible"));

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast!.classList.remove("avc-visible");
  }, 5000);
}

export function isOpen(): boolean {
  return open;
}
