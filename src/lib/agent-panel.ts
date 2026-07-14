// Cursor-style learning agent: always-on transparent panel on the video.
// Mount once when the user opens the extension; word cards update inside it.

import * as romaji from "./romaji";
import { lookup } from "./dictionary";
import { commonnessLabel } from "./levels";
import { isEssentialWord } from "./priority-words";
import { renderMarkdown } from "./markdown-lite";
import { getSettings, setSettings, getAgentPanelWidth, setAgentPanelWidth } from "./storage";
import type { DictEntry, DisplayScript, Judgment, PauseMode, Target, Token } from "../types";

export type InteractionMode = "ambient" | "focus";

/** Ambient: ~3 subtitle lines at typical anime pace before moving on. */
const AMBIENT_AUTO_DISMISS_SEC = 15;
/** Focus (video paused): enough to read + tap a button. */
const FOCUS_AUTO_DISMISS_SEC = 30;

export interface CardOptions {
  autoResumeSec?: number;
  displayScript?: DisplayScript;
  autoSpeak?: boolean;
  contextEn?: string;
  fromAudio?: boolean;
  tokens?: Token[];
  targetIndex?: number;
  title?: string | null;
  animeContext?: string | null;
  learnerLevel?: number;
  wordsKnown?: number;
}

export interface AgentPanelOptions extends CardOptions {
  interaction: InteractionMode;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface WordContext {
  token: Token;
  entry: DictEntry;
  sentence: string;
  title: string | null;
  isReview: boolean;
  options: AgentPanelOptions;
}

interface CoachResp {
  ok?: boolean;
  error?: string;
  result?: { meaning?: string; nuance?: string; hooks?: string[]; reply?: string };
}

interface Shell {
  root: ShadowRoot;
  ambient: HTMLElement;
  sidebar: HTMLElement;
  panel: HTMLElement;
  modeSelect: HTMLSelectElement;
  wordSection: HTMLElement;
  scrollArea: HTMLElement;
  wordIdle: HTMLElement;
  wordActive: HTMLElement;
  foot: HTMLElement;
  buttons: HTMLElement;
  hint: HTMLElement;
  chatLog: HTMLElement;
  chatInput: HTMLTextAreaElement;
  chatSend: HTMLButtonElement;
  aiOut: HTMLElement;
  explainBtn: HTMLButtonElement;
  hookBtn: HTMLButtonElement;
}

let shell: Shell | null = null;
let mounted = false;
let wordPending = false;
let wordResolve: ((judgment: Judgment | "dismiss") => void) | null = null;
let wordCtx: WordContext | null = null;
let chatHistory: ChatTurn[] = [];
let chatPayload: CoachPayload | null = null;

let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let autoTimer: ReturnType<typeof setTimeout> | null = null;
let autoTimerMax: ReturnType<typeof setTimeout> | null = null;
let playHandler: (() => void) | null = null;
let userResumed = false;
let activeVideo: HTMLVideoElement | null = null;
let wasPlaying = false;
let currentJudgments: { val: Judgment; key: string }[] = [];

const PANEL_MIN_W = 280;
const PANEL_MAX_W = 560;
const PANEL_DEFAULT_W = 340;

interface CoachPayload {
  word: string;
  reading?: string;
  gloss?: string;
  line: string;
  level?: number | null;
  title?: string | null;
  animeContext?: string | null;
  learnerLevel?: number | null;
  wordsKnown?: number | null;
}

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .avc-agent-layer {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
  }
  .avc-agent-ambient {
    position: absolute; inset: 0; pointer-events: none;
    transition: background 480ms ease;
  }
  .avc-agent-ambient.avc-focus {
    background: linear-gradient(
      to left,
      rgba(0, 0, 0, 0.12) 0%,
      rgba(0, 0, 0, 0.04) calc(var(--avc-panel-w, 340px) * 0.6),
      transparent var(--avc-panel-w, 340px)
    );
  }
  .avc-agent-sidebar {
    --avc-panel-w: 340px;
    position: fixed; top: 0; right: 0; bottom: 0;
    width: var(--avc-panel-w);
    min-width: ${PANEL_MIN_W}px;
    max-width: min(${PANEL_MAX_W}px, 42vw);
    display: flex; flex-direction: column;
    /* The bar spans a 340px full-height strip but is mostly transparent, so it
       must not eat page clicks (the video player's fullscreen button etc.,
       P0 #9). The container is click-through; only the real controls opt back
       in (rule below), so the empty middle always passes clicks to the page. */
    pointer-events: none;
    background: rgba(8, 7, 10, 0.05);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    border-left: 1px solid rgba(255, 255, 255, 0.04);
    box-shadow: none;
    color: rgba(236, 234, 228, 0.3);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    overflow: hidden;
    transition:
      background 320ms ease,
      backdrop-filter 320ms ease,
      border-color 320ms ease,
      box-shadow 320ms ease,
      color 320ms ease;
  }
  /* Only the real controls take clicks; pointer-events inherits, so the
     transparent container and the empty scroll middle stay click-through and
     pass straight to the page. The resize grip, head (mode + Close), foot
     (know/ignore) and composer (chat) are always live regardless of whether a
     card is up — so chat/mode/Close/resize work in the idle state too. Inside
     the scroll, each content block is live except the idle hint (plain text),
     which stays click-through to maximize the pass-through area. */
  .avc-agent-resize,
  .avc-agent-head,
  .avc-agent-foot,
  .avc-agent-composer,
  .avc-agent-scroll > *:not(.avc-agent-idle) {
    pointer-events: auto;
  }
  .avc-agent-sidebar:hover,
  .avc-agent-sidebar:focus-within,
  .avc-agent-sidebar.avc-sidebar-active {
    background: rgba(8, 7, 10, 0.82);
    backdrop-filter: blur(20px) saturate(1.12);
    -webkit-backdrop-filter: blur(20px) saturate(1.12);
    border-left-color: rgba(255, 255, 255, 0.1);
    box-shadow: -16px 0 48px rgba(0, 0, 0, 0.18);
    color: rgba(236, 234, 228, 0.78);
  }
  .avc-agent-sidebar.avc-focus-sidebar:not(:hover):not(:focus-within):not(.avc-sidebar-active) {
    background: rgba(8, 7, 10, 0.07);
  }
  .avc-agent-sidebar.avc-focus-sidebar:hover,
  .avc-agent-sidebar.avc-focus-sidebar:focus-within,
  .avc-agent-sidebar.avc-focus-sidebar.avc-sidebar-active {
    background: rgba(8, 7, 10, 0.86);
    border-left-color: rgba(227, 186, 99, 0.14);
  }
  .avc-agent-resize {
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 6px; cursor: col-resize; z-index: 4;
    touch-action: none;
  }
  .avc-agent-resize::after {
    content: ""; position: absolute; left: 2px; top: 50%;
    width: 2px; height: 48px; margin-top: -24px;
    border-radius: 2px; background: rgba(255, 255, 255, 0.08);
    transition: background 120ms, height 120ms;
  }
  .avc-agent-resize:hover::after,
  .avc-agent-resize.avc-dragging::after {
    background: rgba(227, 186, 99, 0.45);
    height: 72px; margin-top: -36px;
  }
  .avc-agent-panel {
    display: flex; flex-direction: column;
    flex: 1; min-height: 0; height: 100%;
    background: transparent;
  }
  .avc-agent-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; padding: 14px 16px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }
  .avc-agent-brand {
    font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(227, 186, 99, 0.55);
  }
  .avc-agent-mode-select {
    font-size: 11px; letter-spacing: 0.04em;
    padding: 5px 28px 5px 10px; border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23b8b4aa' d='M1 1l4 4 4-4'/%3E%3C/svg%3E") no-repeat right 8px center;
    color: rgba(236, 234, 228, 0.75);
    cursor: pointer; appearance: none; -webkit-appearance: none;
    font-family: inherit;
  }
  .avc-agent-mode-select:focus {
    outline: none; border-color: rgba(227, 186, 99, 0.3);
  }
  .avc-agent-head-actions {
    display: flex; align-items: center; gap: 6px; flex-shrink: 0;
  }
  .avc-agent-close {
    width: 26px; height: 26px; padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(236, 234, 228, 0.55);
    font-size: 16px; line-height: 1;
    cursor: pointer; font-family: inherit;
  }
  .avc-agent-close:hover {
    color: rgba(236, 234, 228, 0.92);
    border-color: rgba(255, 255, 255, 0.18);
  }
  .avc-agent-scroll {
    overflow-y: auto; padding: 12px 16px 8px;
    flex: 1; min-height: 0;
    display: flex; flex-direction: column;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,.12) transparent;
  }
  .avc-agent-idle {
    padding: 24px 8px 20px; text-align: center;
    color: rgba(236, 234, 228, 0.32);
    font-size: 12px; line-height: 1.6;
  }
  .avc-agent-idle strong { color: rgba(227, 186, 99, 0.5); font-weight: 500; }
  .avc-agent-word-block { display: none; }
  .avc-agent-word-block.avc-active { display: block; }
  /* Ambient: readable text on a small local card — sidebar background stays glassy */
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active {
    padding: 14px 12px 12px;
    margin: 0 -2px 10px;
    border-radius: 12px;
    background: linear-gradient(
      165deg,
      rgba(6, 5, 9, 0.78) 0%,
      rgba(6, 5, 9, 0.52) 55%,
      rgba(6, 5, 9, 0.42) 100%
    );
    backdrop-filter: blur(14px) saturate(1.08);
    -webkit-backdrop-filter: blur(14px) saturate(1.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-chip {
    color: rgba(236, 234, 228, 0.62);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-word {
    color: rgba(255, 252, 245, 0.97);
    text-shadow:
      0 0 1px rgba(0, 0, 0, 0.95),
      0 1px 2px rgba(0, 0, 0, 0.9),
      0 2px 10px rgba(0, 0, 0, 0.65),
      0 0 24px rgba(0, 0, 0, 0.4);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-reading {
    color: rgba(248, 244, 236, 0.82);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-gloss {
    color: rgba(248, 244, 236, 0.9);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-context,
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-sentence {
    color: rgba(240, 237, 230, 0.82);
    background: rgba(0, 0, 0, 0.22);
    border-left-color: rgba(227, 186, 99, 0.45);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-label {
    color: rgba(236, 234, 228, 0.55);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-romaji-line {
    color: rgba(236, 234, 228, 0.78);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-sentence mark,
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-romaji-line mark {
    color: rgba(255, 220, 140, 0.98);
    text-shadow:
      0 0 1px rgba(0, 0, 0, 0.9),
      0 1px 4px rgba(0, 0, 0, 0.75),
      0 0 16px rgba(227, 168, 72, 0.35);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-foot.avc-active {
    margin: 0 -2px 4px;
    padding: 10px 10px 8px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(6, 5, 9, 0.62);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.22);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-foot.avc-active .avc-agent-know {
    color: rgba(248, 244, 236, 0.88);
    background: rgba(255, 255, 255, 0.08);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-foot.avc-active .avc-agent-ignore {
    color: rgba(236, 234, 228, 0.62);
  }
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-foot.avc-active .avc-agent-hint {
    color: rgba(236, 234, 228, 0.45);
  }
  .avc-agent-chip {
    display: inline-block; font-size: 9px; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgba(236, 234, 228, 0.35);
    margin-bottom: 10px;
  }
  .avc-agent-chip-review { color: rgba(217, 108, 79, 0.65); }
  .avc-agent-word-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .avc-agent-word {
    font-size: 28px; font-weight: 600; line-height: 1.15;
    color: rgba(248, 244, 236, 0.82);
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
    font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif;
  }
  .avc-agent-speak {
    background: rgba(255, 255, 255, 0.05); color: rgba(236, 234, 228, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px;
    padding: 5px 12px; cursor: pointer; font-size: 11px;
    letter-spacing: 0.04em; transition: background 120ms, color 120ms;
    font-family: inherit;
  }
  .avc-agent-speak:hover { background: rgba(255, 255, 255, 0.1); color: rgba(248, 244, 236, 0.9); }
  .avc-agent-reading { font-size: 13px; color: rgba(236, 234, 228, 0.42); margin-bottom: 6px; }
  .avc-agent-gloss { font-size: 14px; line-height: 1.45; color: rgba(236, 234, 228, 0.62); margin-bottom: 12px; }
  .avc-agent-context, .avc-agent-sentence {
    font-size: 12px; line-height: 1.55; color: rgba(236, 234, 228, 0.52);
    margin-bottom: 10px; padding: 8px 10px;
    background: rgba(255, 255, 255, 0.025);
    border-left: 1px solid rgba(227, 186, 99, 0.18);
    border-radius: 0 6px 6px 0;
  }
  .avc-agent-label {
    display: block; font-size: 9px; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgba(236, 234, 228, 0.28); margin-bottom: 4px;
  }
  .avc-agent-ja-line { font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif; font-size: 13px; line-height: 1.65; }
  .avc-agent-romaji-line { margin-bottom: 4px; font-size: 12px; color: rgba(236, 234, 228, 0.55); }
  .avc-agent-tok { cursor: pointer; border-bottom: 1px dotted rgba(236, 234, 228, 0.22); }
  .avc-agent-tok:hover { color: rgba(227, 186, 99, 0.85); }
  .avc-agent-sentence mark, .avc-agent-romaji-line mark {
    background: transparent; color: rgba(227, 186, 99, 0.88); font-weight: 600;
    text-shadow: 0 0 20px rgba(227, 168, 72, 0.25);
  }
  .avc-agent-lookup { margin-top: 6px; font-size: 11px; color: rgba(236, 234, 228, 0.5); }
  .avc-agent-ai { margin: 12px 0 10px; }
  .avc-agent-ai-btns { display: flex; gap: 6px; margin-bottom: 8px; }
  .avc-agent-ai-btn {
    flex: 1; padding: 6px 8px; font-size: 11px; cursor: pointer;
    background: rgba(255, 255, 255, 0.04); color: rgba(236, 234, 228, 0.68);
    border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px;
    transition: background 120ms; font-family: inherit;
  }
  .avc-agent-ai-btn:hover { background: rgba(255, 255, 255, 0.08); }
  .avc-agent-ai-btn:disabled { opacity: 0.4; cursor: default; }
  .avc-agent-ai-out { font-size: 12px; line-height: 1.5; color: rgba(236, 234, 228, 0.62); display: none; }
  .avc-agent-ai-out.avc-visible { display: block; }
  .avc-agent-ai-label {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
    color: rgba(236, 234, 228, 0.3); margin-top: 6px;
  }
  .avc-agent-ai-hooks { margin: 4px 0 0 14px; font-size: 12px; }
  .avc-agent-chat {
    margin-top: auto; padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }
  .avc-agent-chat-label {
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(236, 234, 228, 0.32); margin-bottom: 8px;
  }
  .avc-agent-chat-log {
    flex: 1; min-height: 80px; overflow-y: auto; margin-bottom: 0;
    display: flex; flex-direction: column; gap: 8px;
    scrollbar-width: thin;
  }
  .avc-agent-chat-msg {
    font-size: 12px; line-height: 1.52; padding: 8px 11px;
    border-radius: 10px; max-width: 92%; word-break: break-word;
  }
  .avc-agent-chat-msg.avc-user {
    align-self: flex-end;
    background: rgba(227, 186, 99, 0.1);
    border: 1px solid rgba(227, 186, 99, 0.14);
    color: rgba(248, 244, 236, 0.82);
    border-bottom-right-radius: 3px;
  }
  .avc-agent-chat-msg.avc-assistant {
    align-self: flex-start;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: rgba(236, 234, 228, 0.72);
    border-bottom-left-radius: 3px;
  }
  .avc-agent-chat-msg.avc-streaming::after {
    content: ""; display: inline-block; width: 5px; height: 11px;
    margin-left: 2px; background: rgba(227, 186, 99, 0.5);
    animation: avc-blink 900ms step-end infinite;
  }
  @keyframes avc-blink { 50% { opacity: 0; } }
  .avc-md-p { margin: 0 0 6px; }
  .avc-md-p:last-child { margin-bottom: 0; }
  .avc-md-h2 { font-weight: 600; font-size: 12px; margin: 8px 0 4px; color: rgba(227, 186, 99, 0.7); }
  .avc-md-h3 { font-weight: 600; font-size: 11px; margin: 6px 0 3px; color: rgba(236, 234, 228, 0.65); }
  .avc-md-ul { margin: 4px 0 6px 16px; }
  .avc-md-ul li { margin-bottom: 3px; }
  .avc-md-code {
    font-family: ui-monospace, monospace; font-size: 11px;
    background: rgba(255,255,255,.06); padding: 1px 5px; border-radius: 4px;
  }
  .avc-agent-composer {
    flex-shrink: 0; padding: 10px 14px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
    background: transparent;
    transition: background 320ms ease, border-color 320ms ease;
  }
  .avc-agent-sidebar:hover .avc-agent-composer,
  .avc-agent-sidebar:focus-within .avc-agent-composer,
  .avc-agent-sidebar.avc-sidebar-active .avc-agent-composer {
    border-top-color: rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.12);
  }
  .avc-agent-chat-row { display: flex; gap: 6px; align-items: flex-end; }
  .avc-agent-chat-input {
    flex: 1; resize: none; min-height: 36px; max-height: 96px;
    padding: 8px 10px; font-size: 12px; line-height: 1.4;
    border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.18); color: rgba(248, 244, 236, 0.85);
    font-family: inherit;
  }
  .avc-agent-chat-input:focus {
    outline: none; border-color: rgba(227, 186, 99, 0.25);
    background: rgba(0, 0, 0, 0.22);
  }
  .avc-agent-chat-input::placeholder { color: rgba(236, 234, 228, 0.28); }
  .avc-agent-chat-send {
    padding: 0 12px; height: 36px; border-radius: 8px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(236, 234, 228, 0.78); font-size: 11px;
    transition: background 120ms; font-family: inherit;
  }
  .avc-agent-chat-send:hover { background: rgba(255, 255, 255, 0.1); }
  .avc-agent-chat-send:disabled { opacity: 0.35; cursor: default; }
  .avc-agent-foot {
    padding: 10px 14px; flex-shrink: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: none;
  }
  .avc-agent-foot.avc-active { display: block; }
  .avc-agent-buttons { display: flex; gap: 5px; margin-bottom: 6px; }
  .avc-agent-buttons button {
    flex: 1; border-radius: 6px; padding: 8px 4px 6px; cursor: pointer;
    border: 1px solid transparent; font-family: inherit; font-size: 13px;
    transition: filter 120ms, background 120ms;
  }
  .avc-agent-buttons button:hover { filter: brightness(1.1); }
  .avc-agent-buttons button span {
    display: block; font-size: 9px; margin-top: 2px;
    letter-spacing: 0.02em; opacity: 0.5;
  }
  .avc-agent-know {
    background: rgba(255,255,255,.04); color: rgba(236,234,228,.7);
    border-color: rgba(255,255,255,.1);
  }
  .avc-agent-learn { background: rgba(196, 85, 58, 0.65); color: rgba(255,255,255,.92); }
  .avc-agent-ignore {
    background: transparent; color: rgba(236,234,228,.35);
    border-color: rgba(255,255,255,.06);
  }
  .avc-agent-review-pass { background: rgba(61, 138, 99, 0.65); color: rgba(255,255,255,.92); }
  .avc-agent-review-fail {
    background: transparent; color: rgba(201,106,90,.75);
    border-color: rgba(201,106,90,.25);
  }
  .avc-agent-show-answer {
    width: 100%; margin-bottom: 10px; padding: 7px 12px;
    border-radius: 6px; border: 1px solid rgba(255,255,255,.1);
    background: transparent; color: rgba(236,234,228,.65);
    font-size: 12px; cursor: pointer; font-family: inherit;
  }
  .avc-agent-hint {
    font-size: 9px; color: rgba(236, 234, 228, 0.22);
    text-align: center; letter-spacing: 0.03em;
  }
  @media (prefers-reduced-motion: reduce) {
    .avc-agent-ambient { transition: none; }
    .avc-agent-chat-msg.avc-streaming::after { animation: none; }
  }
`;

function mountHost(): ShadowRoot {
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

function pauseModeToInteraction(mode: PauseMode): InteractionMode {
  return mode === "pause" ? "focus" : "ambient";
}

function applyInteractionMode(interaction: InteractionMode): void {
  if (!shell) return;
  const focus = interaction === "focus";
  shell.ambient.className = focus ? "avc-agent-ambient avc-focus" : "avc-agent-ambient";
  shell.sidebar.classList.toggle("avc-focus-sidebar", focus);
}

function clampPanelWidth(w: number): number {
  return Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, Math.round(w)));
}

function setPanelWidth(sidebar: HTMLElement, w: number): void {
  const clamped = clampPanelWidth(w);
  sidebar.style.setProperty("--avc-panel-w", `${clamped}px`);
  sidebar.style.width = `${clamped}px`;
  sidebar.parentElement?.style.setProperty("--avc-panel-w", `${clamped}px`);
}

function attachResizeHandle(sidebar: HTMLElement, grip: HTMLElement): void {
  let dragging = false;
  let startX = 0;
  let startW = 0;

  const onMove = (e: MouseEvent): void => {
    if (!dragging) return;
    e.preventDefault();
    sidebar.classList.add("avc-sidebar-active");
    setPanelWidth(sidebar, startW + (startX - e.clientX));
  };

  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    grip.classList.remove("avc-dragging");
    sidebar.classList.remove("avc-sidebar-active");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    const w = sidebar.offsetWidth;
    void setAgentPanelWidth(w);
  };

  grip.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    grip.classList.add("avc-dragging");
    sidebar.classList.add("avc-sidebar-active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function wordDisplays(token: Token, entry: { reading: string }, displayScript: DisplayScript) {
  const roma = romaji.toRomaji(entry.reading);
  if (displayScript === "kana") return { big: entry.reading, secondary: `${roma} · ${token.surface}` };
  if (displayScript === "kanji") return { big: token.surface, secondary: `${entry.reading} · ${roma}` };
  const secondary = token.surface === entry.reading ? entry.reading : `${entry.reading} · ${token.surface}`;
  return { big: roma, secondary };
}

function showLookup(out: HTMLElement, tk: Token, entry: DictEntry): void {
  out.textContent = "";
  out.style.display = "";
  const w = document.createElement("span");
  w.textContent = entry.reading && entry.reading !== tk.surface ? `${tk.surface}（${entry.reading}）` : tk.surface;
  w.style.fontWeight = "600";
  const g = document.createElement("span");
  g.textContent = " — " + entry.glosses.slice(0, 3).join("; ");
  g.style.opacity = "0.7";
  out.appendChild(w);
  out.appendChild(g);
}

function buildTappableJa(tokens: Token[], targetIndex: number | undefined, lookupOut: HTMLElement): HTMLElement {
  const line = document.createElement("div");
  line.className = "avc-agent-ja-line";
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
      s.className = "avc-agent-tok";
      s.textContent = tk.surface;
      s.addEventListener("click", (e) => { e.stopPropagation(); showLookup(lookupOut, tk, entry); });
      line.appendChild(s);
    } else {
      line.appendChild(document.createTextNode(tk.surface));
    }
  });
  return line;
}

function buildSentence(
  sentence: string,
  tokens: Token[] | undefined,
  targetIndex: number | undefined,
  surface: string,
  displayScript: DisplayScript
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "avc-agent-sentence";
  const label = document.createElement("span");
  label.className = "avc-agent-label";
  label.textContent = tokens?.length ? "In this line" : "Line";
  el.appendChild(label);

  if (tokens?.length) {
    if (displayScript === "romaji") {
      const pieces = romaji.sentencePieces(tokens, targetIndex ?? -1);
      const romajiLine = document.createElement("div");
      romajiLine.className = "avc-agent-romaji-line";
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
    lookupOut.className = "avc-agent-lookup";
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

function coachErrorText(resp: CoachResp | undefined): string {
  if (!resp || resp.ok) return "";
  if (resp.error === "not_linked" || resp.error === "unauthorized") return "Sign in at animevocab.com to use AI.";
  if (resp.error === "quota_exceeded" || resp.error === "ai_quota_exhausted") return "Monthly AI limit reached.";
  if (resp.error === "ai_not_configured") return "AI is not configured on the server yet.";
  return "AI unavailable. Try again.";
}

function appendAiLine(out: HTMLElement, label: string, body: string): void {
  const l = document.createElement("div");
  l.className = "avc-agent-ai-label";
  l.textContent = label;
  const p = document.createElement("div");
  p.textContent = body;
  out.appendChild(l);
  out.appendChild(p);
}

function renderCoachOut(out: HTMLElement, mode: "explain" | "hooks", resp: CoachResp | undefined): void {
  out.textContent = "";
  out.classList.add("avc-visible");
  if (!resp?.ok) {
    out.textContent = coachErrorText(resp) || "AI unavailable.";
    return;
  }
  const r = resp.result || {};
  if (mode === "explain") {
    if (r.meaning) appendAiLine(out, "Meaning", r.meaning);
    if (r.nuance) appendAiLine(out, "In this scene", r.nuance);
    if (!r.meaning && !r.nuance) out.textContent = "No explanation returned.";
  } else if (Array.isArray(r.hooks) && r.hooks.length) {
    const ul = document.createElement("ul");
    ul.className = "avc-agent-ai-hooks";
    for (const h of r.hooks) { const li = document.createElement("li"); li.textContent = h; ul.appendChild(li); }
    out.appendChild(ul);
  } else {
    out.textContent = "No hooks returned.";
  }
}

function appendChatBubble(log: HTMLElement, role: "user" | "assistant", text: string, streaming = false): HTMLElement {
  const bubble = document.createElement("div");
  bubble.className = `avc-agent-chat-msg avc-${role}${streaming ? " avc-streaming" : ""}`;
  if (role === "user") {
    bubble.textContent = text;
  } else {
    const body = document.createElement("div");
    renderMarkdown(body, text);
    bubble.appendChild(body);
  }
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
  return bubble;
}

function updateStreamBubble(bubble: HTMLElement, text: string): void {
  let body = bubble.querySelector(":scope > div");
  if (!body) {
    body = document.createElement("div");
    bubble.appendChild(body);
  }
  renderMarkdown(body as HTMLElement, text);
  bubble.classList.add("avc-streaming");
  if (shell) shell.chatLog.scrollTop = shell.chatLog.scrollHeight;
}

function finishStreamBubble(bubble: HTMLElement, text: string): void {
  updateStreamBubble(bubble, text);
  bubble.classList.remove("avc-streaming");
}

function payloadFromCtx(ctx: WordContext): CoachPayload {
  return {
    word: ctx.token.base,
    reading: ctx.entry.reading,
    gloss: ctx.entry.glosses[0] || "",
    line: ctx.sentence,
    level: ctx.entry.level,
    title: ctx.title,
    animeContext: ctx.options.animeContext ?? null,
    learnerLevel: ctx.options.learnerLevel ?? null,
    wordsKnown: ctx.options.wordsKnown ?? null,
  };
}

function clearWordTimers(): void {
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  if (autoTimerMax) { clearTimeout(autoTimerMax); autoTimerMax = null; }
  if (playHandler && activeVideo) {
    activeVideo.removeEventListener("play", playHandler);
    playHandler = null;
  }
  if (keyHandler) {
    window.removeEventListener("keydown", keyHandler, true);
    keyHandler = null;
  }
}

function resumeVideoIfNeeded(): void {
  if (wasPlaying && !userResumed && activeVideo?.paused) {
    activeVideo.play().catch(() => {});
  }
  activeVideo = null;
  wasPlaying = false;
  userResumed = false;
}

function finishWord(judgment: Judgment | "dismiss"): void {
  const fn = wordResolve;
  wordPending = false;
  wordResolve = null;
  wordCtx = null;
  clearWordTimers();
  resumeVideoIfNeeded();
  if (shell) {
    shell.wordActive.classList.remove("avc-active");
    shell.wordIdle.style.display = "";
    shell.foot.classList.remove("avc-active");
    shell.buttons.textContent = "";
  }
  currentJudgments = [];
  if (fn) fn(judgment);
}

function effectiveAutoDismissSec(opts: AgentPanelOptions): number {
  const configured = opts.autoResumeSec ?? 0;
  if (configured > 0) return configured;
  return opts.interaction === "focus" ? FOCUS_AUTO_DISMISS_SEC : AMBIENT_AUTO_DISMISS_SEC;
}

function bumpAutoTimer(opts: AgentPanelOptions): void {
  if (autoTimer) clearTimeout(autoTimer);
  const sec = effectiveAutoDismissSec(opts);
  autoTimer = setTimeout(() => finishWord("dismiss"), sec * 1000);
  // Hard cap — never block the next word indefinitely (e.g. mouse parked on sidebar).
  if (!autoTimerMax) {
    const capSec = Math.max(sec + 10, 45);
    autoTimerMax = setTimeout(() => finishWord("dismiss"), capSec * 1000);
  }
}

async function submitChat(): Promise<void> {
  if (!shell) return;
  const payload: CoachPayload = chatPayload || {
    word: "general",
    line: "The learner is watching anime with Japanese subtitles.",
    gloss: "",
    title: null,
  };
  const text = shell.chatInput.value.trim();
  if (!text) return;
  shell.chatInput.value = "";
  appendChatBubble(shell.chatLog, "user", text);
  chatHistory.push({ role: "user", content: text });
  shell.chatSend.disabled = true;
  shell.chatInput.disabled = true;

  const streamBubble = appendChatBubble(shell.chatLog, "assistant", "", true);
  let full = "";
  let raf = 0;
  const flush = (): void => {
    raf = 0;
    updateStreamBubble(streamBubble, full);
  };

  try {
    const port = chrome.runtime.connect({ name: "avc-chat-stream" });
    await new Promise<void>((resolve, reject) => {
      port.onMessage.addListener((msg: { type?: string; delta?: string; error?: string; done?: boolean }) => {
        if (msg.type === "chunk" && typeof msg.delta === "string") {
          full += msg.delta;
          if (!raf) raf = requestAnimationFrame(flush);
        } else if (msg.type === "error") {
          reject(new Error(msg.error || "stream_error"));
        } else if (msg.type === "done") {
          resolve();
        }
      });
      port.onDisconnect.addListener(() => {
        // A disconnect is terminal — no further messages will arrive, so ALWAYS
        // settle (P0 #8). The old guard only rejected on (lastError && !full),
        // so a clean close — or a disconnect after some tokens but before the
        // `done` message (e.g. the service worker recycling) — left this promise
        // pending forever, and the `finally` never re-enabled the composer, so
        // copilot chat locked until a full page reload. resolve/reject after a
        // prior `done`/`error` is a harmless no-op (a promise settles once).
        if (full) resolve();
        else reject(new Error(chrome.runtime.lastError?.message || "disconnected"));
      });
      port.postMessage({
        message: text,
        history: chatHistory.slice(0, -1),
        payload,
      });
    });
    if (raf) cancelAnimationFrame(raf);
    if (!full.trim()) {
      finishStreamBubble(streamBubble, coachErrorText({ ok: false, error: "openai_empty" }) || "No reply.");
    } else {
      finishStreamBubble(streamBubble, full);
      chatHistory.push({ role: "assistant", content: full });
    }
  } catch (err) {
    if (raf) cancelAnimationFrame(raf);
    // If tokens already arrived, keep them — a late metering/network error
    // must not replace a good reply with "AI unavailable."
    if (full.trim()) {
      finishStreamBubble(streamBubble, full);
      chatHistory.push({ role: "assistant", content: full });
    } else {
      const msg = err instanceof Error ? err.message : "network";
      finishStreamBubble(streamBubble, coachErrorText({ ok: false, error: msg }) || "Network error.");
    }
  } finally {
    shell.chatSend.disabled = false;
    shell.chatInput.disabled = false;
    shell.chatInput.focus();
  }
}

async function askCoach(mode: "explain" | "hooks"): Promise<void> {
  if (!shell || !wordCtx) return;
  shell.explainBtn.disabled = true;
  shell.hookBtn.disabled = true;
  shell.aiOut.classList.add("avc-visible");
  shell.aiOut.textContent = "Thinking…";
  bumpAutoTimer(wordCtx.options);
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: "avc-coach",
      mode,
      payload: payloadFromCtx(wordCtx),
    })) as CoachResp | undefined;
    renderCoachOut(shell.aiOut, mode, resp);
  } catch {
    shell.aiOut.textContent = "AI unavailable.";
    shell.aiOut.classList.add("avc-visible");
  } finally {
    shell.explainBtn.disabled = false;
    shell.hookBtn.disabled = false;
  }
}

function renderJudgmentButtons(ctx: WordContext): void {
  if (!shell) return;
  shell.buttons.textContent = "";
  shell.foot.classList.add("avc-active");

  interface ButtonSpec { cls: string; ja: string; en: string; val: Judgment; key: string; }
  let judgments: ButtonSpec[];
  if (ctx.isReview) {
    judgments = [
      { cls: "avc-agent-review-pass", ja: "覚えてた", en: "Got it", val: "review-pass", key: "1" },
      { cls: "avc-agent-review-fail", ja: "忘れた", en: "Forgot", val: "review-fail", key: "2" },
    ];
    shell.hint.textContent = "1 / 2 to judge";
  } else {
    judgments = [
      { cls: "avc-agent-know", ja: "知ってる", en: "Know it", val: "know", key: "1" },
      { cls: "avc-agent-learn", ja: "学ぶ", en: "Learn", val: "learn", key: "2" },
      { cls: "avc-agent-ignore", ja: "無視", en: "Skip", val: "ignore", key: "3" },
    ];
    shell.hint.textContent = "1 / 2 / 3 to judge";
  }
  currentJudgments = judgments.map((j) => ({ val: j.val, key: j.key }));

  judgments.forEach((j) => {
    const btn = document.createElement("button");
    btn.className = j.cls;
    btn.innerHTML = `${j.ja}<span>${j.en}</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      finishWord(j.val);
    });
    shell!.buttons.appendChild(btn);
  });
}

function populateWordSection(ctx: WordContext): void {
  if (!shell) return;
  const { token, entry, sentence, isReview, options: opts } = ctx;
  const displayScript: DisplayScript = opts.displayScript || "romaji";

  shell.wordIdle.style.display = "none";
  shell.wordActive.classList.add("avc-active");
  shell.wordActive.textContent = "";
  shell.aiOut.classList.remove("avc-visible");
  shell.aiOut.textContent = "";
  chatHistory = [];
  shell.chatLog.textContent = "";
  chatPayload = payloadFromCtx(ctx);

  const chip = document.createElement("div");
  chip.className = isReview ? "avc-agent-chip avc-agent-chip-review" : "avc-agent-chip";
  chip.textContent = isReview
    ? "Review"
    : `${isEssentialWord(token.base) ? "Essential · " : ""}${commonnessLabel(entry.level)} · #${entry.freqRank.toLocaleString()}${opts.fromAudio ? " · heard" : ""}`;

  const displays = wordDisplays(token, entry, displayScript);
  const wordRow = document.createElement("div");
  wordRow.className = "avc-agent-word-row";
  const wordEl = document.createElement("div");
  wordEl.className = "avc-agent-word";
  wordEl.textContent = displays.big;
  const speakText = entry.reading || token.reading || token.surface;
  const speakBtn = document.createElement("button");
  speakBtn.className = "avc-agent-speak";
  speakBtn.type = "button";
  speakBtn.textContent = "Hear word";
  speakBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    romaji.speak(speakText);
  });
  wordRow.appendChild(wordEl);
  wordRow.appendChild(speakBtn);

  const readingEl = document.createElement("div");
  readingEl.className = "avc-agent-reading";
  readingEl.textContent = displays.secondary;

  const glossEl = document.createElement("div");
  glossEl.className = "avc-agent-gloss";
  glossEl.textContent = entry.glosses.join(" · ");

  shell.wordActive.appendChild(chip);
  shell.wordActive.appendChild(wordRow);

  if (isReview) {
    readingEl.style.display = "none";
    glossEl.style.display = "none";
    const showBtn = document.createElement("button");
    showBtn.className = "avc-agent-show-answer";
    showBtn.type = "button";
    showBtn.textContent = "Show answer";
    showBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      readingEl.style.display = "";
      glossEl.style.display = "";
      showBtn.remove();
    });
    shell.wordActive.appendChild(showBtn);
  }

  shell.wordActive.appendChild(readingEl);
  shell.wordActive.appendChild(glossEl);

  if (opts.contextEn) {
    const ctxEl = document.createElement("div");
    ctxEl.className = "avc-agent-context";
    const lbl = document.createElement("span");
    lbl.className = "avc-agent-label";
    lbl.textContent = "English subtitle";
    ctxEl.appendChild(lbl);
    ctxEl.appendChild(document.createTextNode(opts.contextEn));
    shell.wordActive.appendChild(ctxEl);
  }

  shell.wordActive.appendChild(buildSentence(sentence, opts.tokens, opts.targetIndex, token.surface, displayScript));
  renderJudgmentButtons(ctx);

  if (opts.autoSpeak && opts.interaction === "focus") {
    setTimeout(() => romaji.speak(entry.reading || token.reading || token.surface), 250);
  }
  bumpAutoTimer(opts);
}

function buildShell(root: ShadowRoot): Shell {
  const layer = document.createElement("div");
  layer.className = "avc-agent-layer";

  const ambient = document.createElement("div");
  ambient.className = "avc-agent-ambient";

  const sidebar = document.createElement("div");
  sidebar.className = "avc-agent-sidebar";
  sidebar.setAttribute("role", "complementary");
  sidebar.setAttribute("aria-label", "AnimeVocab learning agent");

  const resize = document.createElement("div");
  resize.className = "avc-agent-resize";
  resize.setAttribute("aria-label", "Resize panel");
  resize.title = "Drag to resize";
  attachResizeHandle(sidebar, resize);

  const panel = document.createElement("div");
  panel.className = "avc-agent-panel";

  const head = document.createElement("div");
  head.className = "avc-agent-head";
  const brand = document.createElement("div");
  brand.className = "avc-agent-brand";
  brand.textContent = "AnimeVocab";

  const modeSelect = document.createElement("select");
  modeSelect.className = "avc-agent-mode-select";
  modeSelect.setAttribute("aria-label", "Learning mode");
  for (const [val, label] of [
    ["copilot", "Ambient"],
    ["pause", "Focus"],
    ["off", "Off"],
  ] as const) {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label;
    modeSelect.appendChild(opt);
  }
  modeSelect.addEventListener("change", async (e) => {
    e.stopPropagation();
    const mode = modeSelect.value as PauseMode;
    await setSettings({ pauseMode: mode });
    applyInteractionMode(pauseModeToInteraction(mode));
  });
  modeSelect.addEventListener("click", (e) => e.stopPropagation());

  const closeBtn = document.createElement("button");
  closeBtn.className = "avc-agent-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close copilot");
  closeBtn.title = "Close copilot";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    hideAgent();
  });

  const headActions = document.createElement("div");
  headActions.className = "avc-agent-head-actions";
  headActions.appendChild(modeSelect);
  headActions.appendChild(closeBtn);

  head.appendChild(brand);
  head.appendChild(headActions);

  const scrollArea = document.createElement("div");
  scrollArea.className = "avc-agent-scroll";

  const wordIdle = document.createElement("div");
  wordIdle.className = "avc-agent-idle";
  wordIdle.innerHTML = "Watching. New words appear here.<br><strong>Ask anything</strong> in the chat below.";

  const wordActive = document.createElement("div");
  wordActive.className = "avc-agent-word-block";

  const ai = document.createElement("div");
  ai.className = "avc-agent-ai";
  const btns = document.createElement("div");
  btns.className = "avc-agent-ai-btns";
  const explainBtn = document.createElement("button");
  explainBtn.className = "avc-agent-ai-btn";
  explainBtn.type = "button";
  explainBtn.textContent = "Explain";
  const hookBtn = document.createElement("button");
  hookBtn.className = "avc-agent-ai-btn";
  hookBtn.type = "button";
  hookBtn.textContent = "Memory hooks";
  const aiOut = document.createElement("div");
  aiOut.className = "avc-agent-ai-out";
  explainBtn.addEventListener("click", (e) => { e.stopPropagation(); void askCoach("explain"); });
  hookBtn.addEventListener("click", (e) => { e.stopPropagation(); void askCoach("hooks"); });
  btns.appendChild(explainBtn);
  btns.appendChild(hookBtn);
  ai.appendChild(btns);
  ai.appendChild(aiOut);
  wordActive.appendChild(ai);

  const chat = document.createElement("div");
  chat.className = "avc-agent-chat";
  const chatLabel = document.createElement("div");
  chatLabel.className = "avc-agent-chat-label";
  chatLabel.textContent = "Copilot chat";
  const chatLog = document.createElement("div");
  chatLog.className = "avc-agent-chat-log";
  chat.appendChild(chatLabel);
  chat.appendChild(chatLog);

  scrollArea.appendChild(wordIdle);
  scrollArea.appendChild(wordActive);
  scrollArea.appendChild(chat);

  const foot = document.createElement("div");
  foot.className = "avc-agent-foot";
  const buttons = document.createElement("div");
  buttons.className = "avc-agent-buttons";
  const hint = document.createElement("div");
  hint.className = "avc-agent-hint";
  foot.appendChild(buttons);
  foot.appendChild(hint);

  const composer = document.createElement("div");
  composer.className = "avc-agent-composer";
  const chatRow = document.createElement("div");
  chatRow.className = "avc-agent-chat-row";
  const chatInput = document.createElement("textarea");
  chatInput.className = "avc-agent-chat-input";
  chatInput.rows = 1;
  chatInput.placeholder = "Ask about Japanese in this scene…";
  const chatSend = document.createElement("button");
  chatSend.className = "avc-agent-chat-send";
  chatSend.type = "button";
  chatSend.textContent = "Send";
  chatSend.addEventListener("click", (e) => { e.stopPropagation(); void submitChat(); });
  chatInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitChat();
    }
  });
  chatInput.addEventListener("click", (e) => e.stopPropagation());
  chatRow.appendChild(chatInput);
  chatRow.appendChild(chatSend);
  composer.appendChild(chatRow);

  panel.appendChild(head);
  panel.appendChild(scrollArea);
  panel.appendChild(foot);
  panel.appendChild(composer);
  sidebar.appendChild(resize);
  sidebar.appendChild(panel);
  layer.appendChild(ambient);
  layer.appendChild(sidebar);
  root.appendChild(layer);

  sidebar.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("fullscreenchange", () => {
    if (mounted) mountHost();
  });

  return {
    root, ambient, sidebar, panel, modeSelect, wordSection: scrollArea, scrollArea,
    wordIdle, wordActive, foot, buttons, hint, chatLog, chatInput, chatSend,
    aiOut, explainBtn, hookBtn,
  };
}

/**
 * Show a transient toast on the page (click or 6.5s to dismiss). Mounts into the
 * overlay's shadow host so it survives without the full panel and isn't styled
 * by the page. Used to surface listening/sync errors that otherwise only showed
 * as an easy-to-miss toolbar badge.
 */
export function showToast(text: string, kind: "error" | "info" = "info"): void {
  if (!text) return;
  const root = mountHost();
  let layer = root.getElementById("avc-toast-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "avc-toast-layer";
    layer.style.cssText =
      "position:fixed; top:16px; left:50%; transform:translateX(-50%);" +
      "z-index:2147483647; display:flex; flex-direction:column; gap:8px;" +
      "align-items:center; pointer-events:none;" +
      "font-family:system-ui,-apple-system,'Segoe UI',sans-serif;";
    root.appendChild(layer);
  }
  const accent = kind === "error" ? "#f87171" : "#e3ba63";
  const toast = document.createElement("div");
  toast.style.cssText =
    "pointer-events:auto; max-width:min(380px, 92vw); padding:11px 14px; border-radius:10px;" +
    "background:rgba(18,16,22,0.95); color:rgba(240,238,232,0.96); font-size:13px; line-height:1.45;" +
    `border:1px solid ${accent}44; border-left:3px solid ${accent};` +
    "box-shadow:0 10px 30px rgba(0,0,0,0.45); cursor:pointer;" +
    "backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);" +
    "opacity:0; transform:translateY(-6px); transition:opacity 180ms ease, transform 180ms ease;";
  toast.textContent = text;
  layer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });
  let removed = false;
  const remove = (): void => {
    if (removed) return;
    removed = true;
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    setTimeout(() => toast.remove(), 200);
  };
  toast.addEventListener("click", remove);
  setTimeout(remove, 6500);
}

export function isAgentMounted(): boolean {
  return mounted;
}

export function ensureAgentMounted(): void {
  const root = mountHost();
  if (!root.querySelector("style")) {
    root.innerHTML = `<style>${STYLES}</style>`;
  }
  if (mounted && shell) return;

  shell = buildShell(root);
  mounted = true;
  romaji.preloadVoices();

  void Promise.all([getSettings(), getAgentPanelWidth()]).then(([s, w]) => {
    if (!shell) return;
    shell.modeSelect.value = s.pauseMode;
    applyInteractionMode(pauseModeToInteraction(s.pauseMode));
    setPanelWidth(shell.sidebar, w || PANEL_DEFAULT_W);
  });
}

/** Remove the sidebar from this tab until opened again. */
export function hideAgent(): void {
  if (wordPending) finishWord("dismiss");
  chatHistory = [];
  chatPayload = null;
  const host = document.getElementById("avc-overlay-host");
  if (host) host.remove();
  shell = null;
  mounted = false;
}

export function isAgentActive(): boolean {
  return mounted;
}

export function isOpen(): boolean {
  return wordPending;
}

export function dismissAgent(): void {
  if (wordPending) finishWord("dismiss");
}

export function showAgentPanel(
  target: Target,
  sentence: string,
  video: HTMLVideoElement | null,
  options: AgentPanelOptions
): Promise<Judgment | "dismiss"> {
  ensureAgentMounted();
  return presentWord(target, sentence, video, options);
}

export function presentWord(
  target: Target,
  sentence: string,
  video: HTMLVideoElement | null,
  options: AgentPanelOptions
): Promise<Judgment | "dismiss"> {
  ensureAgentMounted();
  if (wordPending) finishWord("dismiss");

  const ctx: WordContext = {
    token: target.token,
    entry: target.entry,
    sentence,
    title: options.title || null,
    isReview: target.isReview,
    options,
  };

  wasPlaying = !!(video && !video.paused && !video.ended);
  activeVideo = video;
  userResumed = false;

  if (options.interaction === "focus" && wasPlaying && video) video.pause();
  if (video) {
    playHandler = () => { userResumed = true; };
    video.addEventListener("play", playHandler);
  }

  wordCtx = ctx;
  wordPending = true;
  populateWordSection(ctx);
  applyInteractionMode(options.interaction);

  keyHandler = (e: KeyboardEvent) => {
    if (!wordPending) return;
    // Never hijack 1/2/3 (or any judge key) while the user is typing into a page
    // field — a YouTube search box is an <input>, and contenteditable/select
    // count too. Check both the event target and the focused element.
    const isEditable = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable === true;
    };
    if (isEditable(e.target) || isEditable(document.activeElement)) return;
    const match = currentJudgments.find((j) => j.key === e.key);
    if (match) {
      e.preventDefault();
      e.stopPropagation();
      finishWord(match.val);
    }
  };
  window.addEventListener("keydown", keyHandler, true);

  return new Promise((resolve) => {
    wordResolve = resolve;
  });
}
