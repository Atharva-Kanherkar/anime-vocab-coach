// Subtitle Lens: an interactive mirror of the current subtitle line, floated
// just above the site's native subtitles. Hover any Japanese word for an
// instant local dictionary popup; click (or press Q) to save it as a card.
// English-line words that translate a word in the Japanese line are hoverable
// too and link back to it. Everything here is local (kuromoji + bundled
// JMdict + chrome.storage) — no account, no quota, no network.
//
// Invariant shared with the agent panel ("P0 #9"): the overlay container is
// pointer-events: none and only word spans opt back in, so the lens can sit
// over the player without eating clicks on its controls.
import { lookup } from "./dictionary";
import { toRomaji } from "./romaji";
import { commonnessLabel } from "./levels";
import { buildGlossIndex, linkEnglishWord } from "./gloss-link";
import * as storage from "./storage";
import { log, warn } from "./log";
import type { Judgment, Token, VocabMap, WordSource } from "../types";

export interface SubLensOptions {
  /** Pause the video while a word popup is open, resume on leave. */
  peekPause: boolean;
  getVideo: () => HTMLVideoElement | null;
  getTitle: () => string | null;
  /** Called after a word is saved so the caller can refresh its vocab cache. */
  onJudged?: () => void;
}

interface HoverContext {
  base: string;
  meta: { reading: string; gloss: string; level: number; freqRank: number };
  source: WordSource;
  el: HTMLElement;
}

const AUTO_HIDE_MS = 12_000;
const RESUME_DELAY_MS = 220;

const STYLES = `
  :host { all: initial; }
  .lens {
    position: fixed; left: 0; top: 0; z-index: 2147483644;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    pointer-events: none;
    font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif;
    opacity: 0; transition: opacity 160ms ease;
  }
  .lens.on { opacity: 1; }
  .line {
    max-width: min(78vw, 860px);
    padding: 5px 14px 6px; border-radius: 10px;
    background: rgba(8, 7, 10, 0.72); backdrop-filter: blur(3px);
    color: rgba(236, 234, 228, 0.96);
    text-align: center; line-height: 1.55;
    text-shadow: 0 1px 2px rgba(0,0,0,.6);
  }
  .line.jp { font-size: clamp(17px, 2.3vw, 26px); font-weight: 600; }
  .line.en {
    font-size: clamp(12px, 1.4vw, 16px); font-weight: 400;
    color: rgba(236, 234, 228, 0.78);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .tok { pointer-events: auto; cursor: pointer; border-radius: 3px;
    padding: 0 1px; border-bottom: 2px solid transparent; }
  .tok.new { border-bottom-color: rgba(227, 186, 99, 0.55); }
  .tok.learning { border-bottom-color: rgba(217, 108, 79, 0.65); }
  .tok:hover, .tok.linked-hot { background: rgba(227, 186, 99, 0.18); }
  .tok.saved { border-bottom-color: rgba(143, 176, 209, 0.8); }
  .en .tok { border-bottom: 1px dotted rgba(236, 234, 228, 0.35); }
  .en .tok:hover { color: rgba(227, 186, 99, 0.9); }
  .tip {
    position: fixed; z-index: 2; pointer-events: auto;
    min-width: 220px; max-width: 340px;
    padding: 10px 12px; border-radius: 12px;
    background: rgba(8, 7, 10, 0.94); backdrop-filter: blur(6px);
    border: 1px solid rgba(227, 186, 99, 0.25);
    box-shadow: 0 8px 28px rgba(0,0,0,.55);
    color: rgba(236, 234, 228, 0.95); text-align: left;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    display: none;
  }
  .tip.on { display: block; }
  .tip-word {
    font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
    font-size: 22px; font-weight: 700; line-height: 1.3;
  }
  .tip-reading { font-size: 13px; color: rgba(227, 186, 99, 0.9); margin-top: 1px; }
  .tip-gloss { font-size: 13px; line-height: 1.45; margin-top: 6px; }
  .tip-meta { font-size: 11px; color: rgba(236, 234, 228, 0.5); margin-top: 6px;
    display: flex; gap: 8px; align-items: center; }
  .tip-state { color: rgba(143, 176, 209, 0.95); }
  .tip-actions { display: flex; gap: 6px; margin-top: 9px; }
  .tip-btn {
    flex: 1; padding: 5px 8px; border-radius: 8px; cursor: pointer;
    border: 1px solid rgba(236, 234, 228, 0.16);
    background: rgba(255,255,255,.05); color: rgba(236, 234, 228, .9);
    font-size: 12px; font-family: inherit; transition: background 120ms;
  }
  .tip-btn:hover { background: rgba(227, 186, 99, 0.2); }
  .tip-btn.primary {
    border-color: rgba(227, 186, 99, 0.5); background: rgba(227, 186, 99, 0.16);
    color: rgba(227, 186, 99, 0.95); font-weight: 600;
  }
  .tip-btn kbd {
    font-family: ui-monospace, monospace; font-size: 10px; opacity: .65;
    border: 1px solid rgba(236,234,228,.25); border-radius: 3px; padding: 0 3px;
    margin-left: 4px;
  }
  .tip-saved { color: rgba(143, 176, 209, 0.95); font-size: 12px;
    margin-top: 9px; font-weight: 600; }
  .tip-link { font-size: 11px; color: rgba(236, 234, 228, 0.55); margin-top: 4px; }
`;

let host: HTMLDivElement | null = null;
let root: ShadowRoot | null = null;
let lensEl: HTMLDivElement | null = null;
let tipEl: HTMLDivElement | null = null;
let opts: SubLensOptions | null = null;
let vocabSnapshot: VocabMap = {};
let hover: HoverContext | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let positionTimer: ReturnType<typeof setInterval> | null = null;
let wePaused = false;
let keysBound = false;
let currentLine = "";

function ensureMounted(): void {
  const parent = (document.fullscreenElement as HTMLElement | null) || document.body;
  if (host && host.parentElement === parent) return;
  if (!host) {
    host = document.createElement("div");
    host.setAttribute("data-avc-sub-lens", "");
    root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLES;
    root.appendChild(style);
    lensEl = document.createElement("div");
    lensEl.className = "lens";
    lensEl.addEventListener("mouseenter", onLensEnter);
    lensEl.addEventListener("mouseleave", onLensLeave);
    root.appendChild(lensEl);
    tipEl = document.createElement("div");
    tipEl.className = "tip";
    tipEl.addEventListener("mouseenter", onLensEnter);
    tipEl.addEventListener("mouseleave", onLensLeave);
    root.appendChild(tipEl);
    document.addEventListener("fullscreenchange", ensureMounted);
  }
  parent.appendChild(host);
}

function position(): void {
  if (!lensEl || !opts) return;
  const video = opts.getVideo();
  if (!video) return;
  const r = video.getBoundingClientRect();
  if (r.width < 200 || r.height < 120) return;
  // Sit in the lower quarter of the video, above where native subs render.
  lensEl.style.left = `${r.left + r.width / 2}px`;
  lensEl.style.top = `${r.top + r.height * 0.76}px`;
  lensEl.style.transform = "translate(-50%, -100%)";
  lensEl.style.maxWidth = `${Math.max(280, r.width * 0.86)}px`;
}

function armAutoHide(): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (hover) { armAutoHide(); return; } // never yank the line mid-read
    lensEl?.classList.remove("on");
    currentLine = "";
  }, AUTO_HIDE_MS);
}

function onLensEnter(): void {
  if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  if (!opts?.peekPause) return;
  const video = opts.getVideo();
  if (video && !video.paused) {
    video.pause();
    wePaused = true;
  }
}

function onLensLeave(): void {
  hideTip();
  if (!wePaused) return;
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    if (!wePaused) return;
    wePaused = false;
    const video = opts?.getVideo();
    // Only resume a pause we caused, and only if the user hasn't taken over.
    if (video && video.paused) video.play().catch(() => {});
  }, RESUME_DELAY_MS);
}

function stateLabel(base: string): string {
  const rec = vocabSnapshot[base];
  if (!rec) return "";
  if (rec.state === "learning") return "Learning";
  if (rec.state === "known") return "Known";
  return "";
}

function hideTip(): void {
  hover = null;
  tipEl?.classList.remove("on");
}

function showTip(ctx: HoverContext, linkedFrom?: string): void {
  if (!tipEl) return;
  hover = ctx;
  const { meta } = ctx;
  const romaji = meta.reading ? toRomaji(meta.reading) : "";
  const state = stateLabel(ctx.base);
  tipEl.innerHTML = "";

  const word = document.createElement("div");
  word.className = "tip-word";
  word.textContent = ctx.base;
  tipEl.appendChild(word);

  if (meta.reading && meta.reading !== ctx.base) {
    const reading = document.createElement("div");
    reading.className = "tip-reading";
    reading.textContent = romaji ? `${meta.reading} · ${romaji}` : meta.reading;
    tipEl.appendChild(reading);
  }

  if (linkedFrom) {
    const link = document.createElement("div");
    link.className = "tip-link";
    link.textContent = `“${linkedFrom}” in the English line ↩`;
    tipEl.appendChild(link);
  }

  const gloss = document.createElement("div");
  gloss.className = "tip-gloss";
  gloss.textContent = meta.gloss;
  tipEl.appendChild(gloss);

  const metaRow = document.createElement("div");
  metaRow.className = "tip-meta";
  const freq = document.createElement("span");
  freq.textContent = commonnessLabel(meta.level);
  metaRow.appendChild(freq);
  if (state) {
    const st = document.createElement("span");
    st.className = "tip-state";
    st.textContent = state;
    metaRow.appendChild(st);
  }
  tipEl.appendChild(metaRow);

  const rec = vocabSnapshot[ctx.base];
  if (rec && (rec.state === "learning" || rec.state === "known")) {
    const saved = document.createElement("div");
    saved.className = "tip-saved";
    saved.textContent = rec.state === "learning" ? "✓ In your deck" : "✓ Marked known";
    tipEl.appendChild(saved);
  } else {
    const actions = document.createElement("div");
    actions.className = "tip-actions";
    const mkBtn = (label: string, key: string, judgment: Judgment, primary: boolean) => {
      const b = document.createElement("button");
      b.className = primary ? "tip-btn primary" : "tip-btn";
      b.innerHTML = `${label}<kbd>${key}</kbd>`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        void judgeHovered(judgment);
      });
      actions.appendChild(b);
    };
    mkBtn("学ぶ Learn", "Q", "learn", true);
    mkBtn("知ってる Know", "K", "know", false);
    mkBtn("無視 Skip", "X", "ignore", false);
    tipEl.appendChild(actions);
  }

  // Position above the hovered token, clamped to the viewport.
  const tr = ctx.el.getBoundingClientRect();
  tipEl.classList.add("on");
  const tw = tipEl.offsetWidth || 260;
  const th = tipEl.offsetHeight || 140;
  const left = Math.max(8, Math.min(window.innerWidth - tw - 8, tr.left + tr.width / 2 - tw / 2));
  const top = Math.max(8, tr.top - th - 10);
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${top}px`;
}

async function judgeHovered(judgment: Judgment): Promise<void> {
  const ctx = hover;
  if (!ctx) return;
  try {
    await storage.judgeWord(ctx.base, judgment, ctx.meta, ctx.source);
    const state = judgment === "learn" ? "learning" : judgment === "know" ? "known" : "ignored";
    vocabSnapshot = { ...vocabSnapshot, [ctx.base]: { ...(vocabSnapshot[ctx.base] || {}), state } as VocabMap[string] };
    ctx.el.classList.remove("new", "learning");
    if (judgment === "learn") ctx.el.classList.add("saved");
    showTip(ctx); // re-render as saved
    opts?.onJudged?.();
    log("sub-lens saved:", ctx.base, judgment);
  } catch (err) {
    warn("sub-lens save failed:", err);
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (!hover || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  const key = e.key.toLowerCase();
  const judgment: Judgment | null = key === "q" ? "learn" : key === "k" ? "know" : key === "x" ? "ignore" : null;
  if (!judgment) return;
  e.preventDefault();
  e.stopPropagation();
  void judgeHovered(judgment);
}

function tokenClass(base: string): string {
  const rec = vocabSnapshot[base];
  if (!rec || rec.state === "new") return "new";
  if (rec.state === "learning") return "learning";
  return "";
}

/** Render the current subtitle pair. Call on every emitted line. */
export function showLensLine(
  text: string,
  en: string,
  tokens: Token[],
  vocab: VocabMap,
  options: SubLensOptions
): void {
  opts = options;
  vocabSnapshot = vocab;
  if (text === currentLine) return;
  currentLine = text;
  ensureMounted();
  if (!lensEl) return;
  hideTip();
  lensEl.innerHTML = "";

  const source: WordSource = { title: options.getTitle(), line: text, en: en || null };
  const jpSpans: (HTMLElement | null)[] = [];

  const jpLine = document.createElement("div");
  jpLine.className = "line jp";
  tokens.forEach((tk) => {
    const entry = lookup(tk.base);
    if (!entry) {
      jpLine.appendChild(document.createTextNode(tk.surface));
      jpSpans.push(null);
      return;
    }
    const s = document.createElement("span");
    s.className = `tok ${tokenClass(tk.base)}`.trim();
    s.textContent = tk.surface;
    const ctx: HoverContext = {
      base: tk.base,
      meta: {
        reading: entry.reading || tk.reading,
        gloss: entry.glosses.slice(0, 3).join("; "),
        level: entry.level,
        freqRank: entry.freqRank,
      },
      source,
      el: s,
    };
    s.addEventListener("mouseenter", () => showTip(ctx));
    s.addEventListener("click", (e) => { e.stopPropagation(); showTip(ctx); void judgeHovered("learn"); });
    jpLine.appendChild(s);
    jpSpans.push(s);
  });
  lensEl.appendChild(jpLine);

  if (en) {
    const glossIndex = buildGlossIndex(tokens, lookup);
    const enLine = document.createElement("div");
    enLine.className = "line en";
    for (const piece of en.split(/(\s+)/)) {
      const idx = /\s/.test(piece) ? -1 : linkEnglishWord(piece, glossIndex);
      const jpSpan = idx >= 0 ? jpSpans[idx] : null;
      const token = idx >= 0 ? tokens[idx] : null;
      const entry = token ? lookup(token.base) : null;
      if (!token || !entry) {
        enLine.appendChild(document.createTextNode(piece));
        continue;
      }
      const s = document.createElement("span");
      s.className = "tok";
      s.textContent = piece;
      const ctx: HoverContext = {
        base: token.base,
        meta: {
          reading: entry.reading || token.reading,
          gloss: entry.glosses.slice(0, 3).join("; "),
          level: entry.level,
          freqRank: entry.freqRank,
        },
        source,
        el: s,
      };
      s.addEventListener("mouseenter", () => {
        jpSpan?.classList.add("linked-hot");
        showTip(ctx, piece);
      });
      s.addEventListener("mouseleave", () => jpSpan?.classList.remove("linked-hot"));
      s.addEventListener("click", (e) => { e.stopPropagation(); showTip(ctx, piece); void judgeHovered("learn"); });
      enLine.appendChild(s);
    }
    lensEl.appendChild(enLine);
  }

  position();
  lensEl.classList.add("on");
  armAutoHide();

  if (!positionTimer) positionTimer = setInterval(position, 500);
  if (!keysBound) {
    keysBound = true;
    window.addEventListener("keydown", onKeyDown, true);
  }
}

/** Hide the lens (session reset / feature toggled off). */
export function hideLens(): void {
  currentLine = "";
  hideTip();
  lensEl?.classList.remove("on");
  if (wePaused) {
    wePaused = false;
    const video = opts?.getVideo();
    if (video && video.paused) video.play().catch(() => {});
  }
}
