// Cursor-style learning agent: always-on transparent panel on the video.
// Mount once when the user opens the extension; word cards update inside it.

import * as romaji from "./romaji";
import { lookup } from "./dictionary";
import { commonnessLabel } from "./levels";
import { isEssentialWord } from "./priority-words";
import { renderMarkdown } from "./markdown-lite";
import { PausableTimer } from "./pausable-timer";
import { PlaybackHold } from "./playback-hold";
import {
  getSettings,
  setSettings,
  getAgentPanelWidth,
  setAgentPanelWidth,
  getAgentPanelCollapsed,
  setAgentPanelCollapsed,
} from "./storage";
import {
  chatPlaceholder,
  contextSubtitleLabel,
  normalizeDirection,
  type LearningDirection,
} from "./direction";
import type { Meter, TierOffer, UsageSnapshot } from "./usage-client";
import type { DictEntry, DisplayScript, Judgment, PauseMode, Settings, Target, Token } from "../types";
import { trackExtensionEvent } from "./extension-events";
import { UI_HOST_ATTR, isTypingEvent, keepFocusOnMouseClick } from "./key-shield";

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
  learningDirection?: LearningDirection;
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
  lensBtn: HTMLButtonElement;
  wordSection: HTMLElement;
  scrollArea: HTMLElement;
  wordIdle: HTMLElement;
  wordActive: HTMLElement;
  collapseBtn: HTMLElement;
  rail: HTMLElement;
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
/** Both auto-dismiss clocks freeze while the learner has the video paused. */
const autoTimer = new PausableTimer();
const autoTimerMax = new PausableTimer();
let userResumed = false;
let activeVideo: HTMLVideoElement | null = null;
let wasPlaying = false;
/**
 * Ownership of the pause a focus-mode card causes (issues #127, #130).
 *
 * This is the single source of truth for "is the video still paused because we
 * paused it". The learner pausing to study, seeking from a stop, or pressing
 * play all release it, and no resume path of ours runs without it.
 */
const cardHold = new PlaybackHold();
/** Teardown for the per-card listeners that feed the hold. */
let videoWatchers: (() => void)[] = [];
let currentJudgments: { val: Judgment; key: string }[] = [];

/** Whether the panel currently sits collapsed to its rail. */
let collapsed = false;

/**
 * The learner is mid-conversation with the copilot. While this holds, no new
 * card may take the panel over: a new card resets the chat to the new word, so
 * one arriving on the video's own clock wiped the question being typed, or the
 * reply being read, every twenty seconds or so.
 */
const CHAT_ENGAGED_MS = 30_000;
/** An unsent draft holds the panel longer, but not forever: an abandoned one
 * must not stop cards for the rest of the episode. */
const CHAT_DRAFT_HOLD_MS = 120_000;
let chatActiveAt = 0;
let chatStreaming = false;

const PANEL_MIN_W = 280;
const PANEL_MAX_W = 560;
const PANEL_DEFAULT_W = 340;
/** Width of the collapsed rail. Deliberately below PANEL_MIN_W so a rail can
 * never be mistaken for a resized panel. */
const PANEL_RAIL_W = 36;
/**
 * Height left clear at the bottom of the sidebar for the host player's control
 * bar (issue #132). The panel is a full-height strip on the right, so its
 * composer and judgment row landed on top of Netflix's subtitle, speed,
 * next-episode and fullscreen buttons, and its blur painted over the rest.
 * Sized from Netflix's bottom-controls container, the tallest of the supported
 * players: roughly 130px on a 720px-high window, 160px on a 1080px one. The
 * floor is what matters; the vh term keeps it proportionate above that and the
 * cap stops it eating a TV-sized panel. e2e/panel-layout.mjs asserts the
 * sidebar's bottom edge clears a 140px bar.
 */
const PANEL_BOTTOM_CLEARANCE = "clamp(140px, 15vh, 190px)";

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
  direction?: LearningDirection;
}

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .avc-agent-layer {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    /* Owned by the layer so the ambient wash respects the same host-control
       clearance the sidebar does. Painting over those controls is half of
       issue #132; stopping only the click targets leaves the tint behind. */
    --avc-panel-bottom: ${PANEL_BOTTOM_CLEARANCE};
    --avc-panel-w: ${PANEL_DEFAULT_W}px;
  }
  .avc-agent-ambient {
    position: absolute; inset: 0; bottom: var(--avc-panel-bottom);
    pointer-events: none;
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
    position: fixed; top: 0; right: 0; bottom: var(--avc-panel-bottom);
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
  /* Collapsed: a rail on the right edge and nothing else. The card stays
     mounted behind it, so expanding brings the same word back. */
  .avc-agent-sidebar.avc-collapsed {
    width: ${PANEL_RAIL_W}px;
    min-width: ${PANEL_RAIL_W}px;
    max-width: ${PANEL_RAIL_W}px;
  }
  .avc-agent-sidebar.avc-collapsed .avc-agent-panel,
  .avc-agent-sidebar.avc-collapsed .avc-agent-resize {
    display: none;
  }
  .avc-agent-rail {
    display: none;
    position: absolute; inset: 0;
    flex-direction: column; align-items: center; justify-content: flex-start;
    gap: 10px; padding: 12px 0;
    pointer-events: auto; cursor: pointer;
    background: rgba(8, 7, 10, 0.55);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
  }
  .avc-agent-sidebar.avc-collapsed .avc-agent-rail { display: flex; }
  .avc-agent-rail:hover { background: rgba(8, 7, 10, 0.78); }
  .avc-agent-rail-mark {
    font-size: 10px; letter-spacing: 0.14em; color: rgba(227, 186, 99, 0.7);
    writing-mode: vertical-rl; text-transform: uppercase;
  }
  .avc-agent-rail-open {
    font-size: 13px; line-height: 1; color: rgba(236, 234, 228, 0.6);
  }
  /* A card waiting behind the rail. The mark alone was 0.7 -> 1.0 alpha of the
     same hue inside a 36px strip, which is not a notification; the whole rail
     takes the accent so the waiting state is visible without looking for it. */
  .avc-agent-sidebar.avc-collapsed.avc-has-card .avc-agent-rail {
    background: rgba(227, 186, 99, 0.16);
    border-left-color: rgba(227, 186, 99, 0.55);
    box-shadow: -6px 0 18px rgba(227, 186, 99, 0.18);
  }
  .avc-agent-sidebar.avc-collapsed.avc-has-card .avc-agent-rail-mark {
    color: rgba(227, 186, 99, 1);
  }
  .avc-agent-sidebar.avc-collapsed.avc-has-card .avc-agent-rail-open {
    color: rgba(236, 234, 228, 0.95);
  }
  .avc-agent-collapse {
    width: 26px; height: 26px; padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(236, 234, 228, 0.55);
    font-size: 13px; line-height: 1;
    cursor: pointer; font-family: inherit;
  }
  .avc-agent-collapse:hover {
    color: rgba(236, 234, 228, 0.9);
    border-color: rgba(255, 255, 255, 0.2);
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
  .avc-agent-lens-toggle {
    height: 26px; padding: 0 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(236, 234, 228, 0.45);
    font-size: 11px; line-height: 1; letter-spacing: 0.04em;
    cursor: pointer; font-family: inherit;
    text-decoration: line-through;
  }
  .avc-agent-lens-toggle[aria-pressed="true"] {
    color: rgba(227, 186, 99, 0.95);
    border-color: rgba(227, 186, 99, 0.35);
    text-decoration: none;
  }
  .avc-agent-lens-toggle:hover { border-color: rgba(255, 255, 255, 0.22); }
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
  .avc-agent-sidebar:not(.avc-focus-sidebar) .avc-agent-word-block.avc-active .avc-agent-word-kana {
    font-size: 16px;
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
  .avc-agent-word-kana {
    font-size: 22px; font-weight: 500; line-height: 1.2;
    color: rgba(227, 186, 99, 0.78);
    margin: -2px 0 6px; letter-spacing: 0.02em;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
    font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif;
  }
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

  /* ── Limit-reached sheet ───────────────────────────────────────────────
     Centered over the video rather than tucked in the sidebar: hitting a cap
     is the one moment the learner has to be told something, and the sidebar
     is transparent until hovered. Backdrop takes clicks so the page can't be
     driven behind it, but Escape / the backdrop / "Not now" all dismiss. */
  .avc-agent-paywall {
    position: fixed; inset: 0; z-index: 12;
    display: flex; align-items: center; justify-content: center;
    padding: 24px; pointer-events: auto;
    background: rgba(6, 5, 8, 0.62);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    opacity: 0; transition: opacity 200ms ease;
  }
  .avc-agent-paywall.avc-visible { opacity: 1; }
  .avc-agent-paywall-card {
    width: min(440px, 100%); max-height: 100%; overflow-y: auto;
    padding: 26px 26px 22px; border-radius: 16px;
    background: rgba(14, 12, 17, 0.97);
    border: 1px solid rgba(227, 186, 99, 0.18);
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.6);
    color: rgba(240, 238, 232, 0.92);
    transform: translateY(8px) scale(0.985);
    transition: transform 220ms cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  .avc-agent-paywall.avc-visible .avc-agent-paywall-card {
    transform: translateY(0) scale(1);
  }
  .avc-agent-paywall-kicker {
    font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
    color: rgba(227, 186, 99, 0.7);
  }
  .avc-agent-paywall-title {
    margin-top: 8px; font-size: 19px; line-height: 1.3; font-weight: 600;
  }
  .avc-agent-paywall-body {
    margin-top: 8px; font-size: 13px; line-height: 1.55;
    color: rgba(236, 234, 228, 0.62);
  }
  .avc-agent-meter { margin-top: 16px; }
  .avc-agent-meter + .avc-agent-meter { margin-top: 10px; }
  .avc-agent-meter-row {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 8px; font-size: 11px; letter-spacing: 0.03em;
    color: rgba(236, 234, 228, 0.5);
  }
  .avc-agent-meter-val { color: rgba(236, 234, 228, 0.8); font-variant-numeric: tabular-nums; }
  .avc-agent-meter-track {
    margin-top: 6px; height: 5px; border-radius: 3px; overflow: hidden;
    background: rgba(255, 255, 255, 0.07);
  }
  .avc-agent-meter-fill {
    height: 100%; border-radius: 3px; background: rgba(227, 186, 99, 0.75);
    transition: width 320ms ease;
  }
  .avc-agent-meter-fill.avc-meter-full { background: rgba(201, 106, 90, 0.85); }
  .avc-agent-plans { margin-top: 20px; display: flex; flex-direction: column; gap: 9px; }
  .avc-agent-plan {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; width: 100%; text-align: left;
    padding: 12px 14px; border-radius: 10px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: inherit; font-family: inherit;
    transition: border-color 140ms, background 140ms, transform 140ms;
  }
  .avc-agent-plan:hover { background: rgba(255, 255, 255, 0.06); transform: translateY(-1px); }
  .avc-agent-plan:focus-visible { outline: 2px solid rgba(227, 186, 99, 0.6); outline-offset: 2px; }
  .avc-agent-plan.avc-plan-featured {
    border-color: rgba(227, 186, 99, 0.42);
    background: rgba(227, 186, 99, 0.09);
  }
  .avc-agent-plan-name { font-size: 13px; font-weight: 600; }
  .avc-agent-plan-perk {
    margin-top: 2px; font-size: 11px; line-height: 1.45;
    color: rgba(236, 234, 228, 0.55);
  }
  .avc-agent-plan-price {
    flex-shrink: 0; font-size: 13px; font-weight: 600;
    color: rgba(227, 186, 99, 0.92); white-space: nowrap;
  }
  .avc-agent-paywall-foot {
    margin-top: 16px; display: flex; align-items: center;
    justify-content: space-between; gap: 12px;
  }
  .avc-agent-paywall-note {
    font-size: 10.5px; line-height: 1.45; color: rgba(236, 234, 228, 0.35);
  }
  .avc-agent-paywall-dismiss {
    flex-shrink: 0; padding: 7px 14px; border-radius: 7px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.12); background: transparent;
    color: rgba(236, 234, 228, 0.62); font-size: 12px; font-family: inherit;
    transition: background 140ms, color 140ms;
  }
  .avc-agent-paywall-dismiss:hover {
    background: rgba(255, 255, 255, 0.06); color: rgba(240, 238, 232, 0.9);
  }

  @media (prefers-reduced-motion: reduce) {
    .avc-agent-ambient { transition: none; }
    .avc-agent-chat-msg.avc-streaming::after { animation: none; }
    .avc-agent-paywall,
    .avc-agent-paywall-card,
    .avc-agent-meter-fill { transition: none; }
  }
`;

function mountHost(): ShadowRoot {
  let host = document.getElementById("avc-overlay-host");
  const parent = document.fullscreenElement || document.body;
  if (!host) {
    host = document.createElement("div");
    host.id = "avc-overlay-host";
    host.style.cssText = "all:initial; position:fixed; inset:0; z-index:2147483647; pointer-events:none;";
    // Keystrokes inside this host are ours, not the player's (lib/key-shield).
    host.setAttribute(UI_HOST_ATTR, "");
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

/** The width the panel returns to when expanded, so collapse can be undone. */
let expandedWidth = PANEL_DEFAULT_W;

function setPanelWidth(sidebar: HTMLElement, w: number): void {
  const clamped = clampPanelWidth(w);
  expandedWidth = clamped;
  sidebar.style.setProperty("--avc-panel-w", `${clamped}px`);
  sidebar.style.width = `${clamped}px`;
  if (!collapsed) sidebar.parentElement?.style.setProperty("--avc-panel-w", `${clamped}px`);
}

/**
 * Collapse to the rail, or expand back.
 *
 * Deliberately not `hideAgent`: the shell, the pending card and the chat stay
 * exactly as they are, so a learner can reach the host player's controls
 * mid-card and come back to the same word (issue #132).
 */
function setCollapsed(next: boolean, persist = true): void {
  if (!shell) return;
  collapsed = next;
  shell.sidebar.classList.toggle("avc-collapsed", next);
  shell.collapseBtn.setAttribute("aria-expanded", String(!next));
  shell.rail.setAttribute("aria-expanded", String(!next));
  // The ambient wash is drawn from --avc-panel-w on the layer, which the
  // sidebar's own class cannot reach. Without this the collapsed strip keeps a
  // 340px darkened band over the player: click-through, but not out of the way.
  shell.sidebar.parentElement?.style.setProperty(
    "--avc-panel-w",
    `${next ? PANEL_RAIL_W : expandedWidth}px`
  );
  if (persist) void setAgentPanelCollapsed(next);
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

function wordDisplays(
  token: Token,
  entry: { reading: string },
  displayScript: DisplayScript,
  direction: LearningDirection
): { big: string; secondary: string; kana?: string } {
  if (normalizeDirection(direction) === "ja-en") {
    return {
      big: token.surface || token.base,
      secondary: entry.reading || token.base,
    };
  }
  const roma = romaji.toRomaji(entry.reading);
  if (displayScript === "kana") return { big: entry.reading, secondary: `${roma} · ${token.surface}` };
  if (displayScript === "kanji") return { big: token.surface, secondary: `${entry.reading} · ${roma}` };
  // Dual script: romaji to read, kana promoted to its own full-size line so the
  // learner starts pairing shapes with sounds instead of skipping past them.
  // The kanji surface stays in the small line — it is the third step, not this one.
  if (displayScript === "romaji-kana") {
    return {
      big: roma,
      kana: entry.reading,
      secondary: token.surface === entry.reading ? "" : token.surface,
    };
  }
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
  displayScript: DisplayScript,
  direction: LearningDirection = "en-ja"
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "avc-agent-sentence";
  const label = document.createElement("span");
  label.className = "avc-agent-label";
  label.textContent = tokens?.length ? "In this line" : "Line";
  el.appendChild(label);

  if (tokens?.length) {
    const romajiSentence = displayScript === "romaji" || displayScript === "romaji-kana";
    if (normalizeDirection(direction) === "en-ja" && romajiSentence) {
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

/** Quota errors from any AI surface, mapped to the meter they exhausted. */
function limitKindFromError(error: string | undefined): LimitKind | null {
  if (error === "quota_exceeded" || error === "ai_quota_exhausted") return "ai";
  if (error === "auto_quota_exhausted") return "auto";
  return null;
}

function coachErrorText(resp: CoachResp | undefined): string {
  if (!resp || resp.ok) return "";
  if (resp.error === "not_linked" || resp.error === "unauthorized") return "Sign in at animevocab.com to use AI.";
  if (resp.error === "quota_exceeded" || resp.error === "ai_quota_exhausted") return "Monthly AI limit reached.";
  if (resp.error === "auto_quota_exhausted") return "Monthly word-picking limit reached.";
  if (resp.error === "ai_not_configured") return "AI is not configured on the server yet.";
  return "AI unavailable. Try again.";
}

/** Raise the limit sheet if this response was a quota rejection. The inline
 * text stays as a record of what happened; the sheet is what the learner
 * actually notices on a panel that's transparent until hovered. */
function surfaceQuotaError(resp: CoachResp | undefined): void {
  if (!resp || resp.ok) return;
  const kind = limitKindFromError(resp.error);
  if (kind) void reportLimitReached(kind);
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
    direction: normalizeDirection(ctx.options.learningDirection),
  };
}

function clearWordTimers(): void {
  autoTimer.clear();
  autoTimerMax.clear();
  // Detach every listener this card added. They exist only to feed the hold,
  // and the hold's whole life is one card, so letting them outlive it would
  // let a previous video's events reach the next one's hold — the same bleed
  // issue #125 was about.
  for (const off of videoWatchers) off();
  videoWatchers = [];
  if (keyHandler) {
    window.removeEventListener("keydown", keyHandler, true);
    shell?.root.removeEventListener("keydown", keyHandler as EventListener);
    keyHandler = null;
  }
}

function resumeVideoIfNeeded(): void {
  // Release first and unconditionally, so a card that ends down any path
  // cannot leave a hold standing for the next one to inherit.
  const held = cardHold.release();
  // Only a pause we still own, and only on the video we took it on. A
  // focus-mode card pauses and resumes when the card resolves, which is the
  // point of Focus mode, but if the learner paused (issue #127) or seeked
  // (issue #130) while the card was up then the stop is theirs.
  // Never into a hidden tab: that is audio starting in a window the learner
  // has left (the Lens already forfeits its pause the same way).
  if (held && held === activeVideo && wasPlaying && !userResumed && held.paused && !document.hidden) {
    held.play().catch(() => {});
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
    shell.sidebar.classList.remove("avc-has-card");
  }
  currentJudgments = [];
  if (fn) fn(judgment);
}

function effectiveAutoDismissSec(opts: AgentPanelOptions): number {
  const configured = opts.autoResumeSec ?? 0;
  if (configured > 0) return configured;
  return opts.interaction === "focus" ? FOCUS_AUTO_DISMISS_SEC : AMBIENT_AUTO_DISMISS_SEC;
}

/** Re-check interval while a conversation keeps a card open past its time. */
const CHAT_HOLD_RECHECK_MS = 5_000;

function bumpAutoTimer(opts: AgentPanelOptions): void {
  const sec = effectiveAutoDismissSec(opts);
  autoTimer.arm(sec * 1000, () => dismissUnlessChatting(autoTimer));
  // Hard cap: never block the next word indefinitely (e.g. mouse parked on
  // sidebar). Frozen with the main clock while paused, which is safe because a
  // paused video produces no new lines to block.
  if (!autoTimerMax.armed) {
    const capSec = Math.max(sec + 10, 45);
    autoTimerMax.arm(capSec * 1000, () => dismissUnlessChatting(autoTimerMax));
  }
}

/** Time out a card, unless the learner is talking to the copilot about it:
 * the card is the chat's subject, and closing it mid-question is exactly the
 * interruption the chat exists to avoid. The cap still applies once they stop. */
function dismissUnlessChatting(timer: PausableTimer): void {
  if (isChatEngaged()) {
    timer.arm(CHAT_HOLD_RECHECK_MS, () => dismissUnlessChatting(timer));
    return;
  }
  finishWord("dismiss");
}

/** True while the learner is typing to, waiting on, or reading the copilot. */
export function isChatEngaged(): boolean {
  if (!shell || !mounted) return false;
  if (chatStreaming) return true;
  // Time-bounded on purpose. Focus alone is no signal: the composer keeps it
  // after every reply, and holding on focus would stop cards indefinitely.
  const since = Date.now() - chatActiveAt;
  if (since < CHAT_ENGAGED_MS) return true;
  return since < CHAT_DRAFT_HOLD_MS && shell.chatInput.value.trim() !== "";
}

/** Freeze both dismissal clocks while the learner studies a paused frame. */
function freezeAutoTimers(): void {
  autoTimer.freeze();
  autoTimerMax.freeze();
}

function thawAutoTimers(): void {
  autoTimer.thaw();
  autoTimerMax.thaw();
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
  chatStreaming = true;
  chatActiveAt = Date.now();

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
      surfaceQuotaError({ ok: false, error: msg });
    }
  } finally {
    chatStreaming = false;
    // The reply has only just landed; give the learner time to read it.
    chatActiveAt = Date.now();
    // The panel may have been closed while the reply streamed.
    if (shell) {
      shell.chatSend.disabled = false;
      shell.chatInput.disabled = false;
      shell.chatInput.focus();
    }
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
    surfaceQuotaError(resp);
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
  const direction = normalizeDirection(opts.learningDirection);
  const displayScript: DisplayScript = opts.displayScript || "romaji";

  shell.wordIdle.style.display = "none";
  shell.wordActive.classList.add("avc-active");
  shell.wordActive.textContent = "";
  shell.aiOut.classList.remove("avc-visible");
  shell.aiOut.textContent = "";
  chatHistory = [];
  shell.chatLog.textContent = "";
  chatPayload = payloadFromCtx(ctx);
  shell.chatInput.placeholder = chatPlaceholder(direction);

  const chip = document.createElement("div");
  chip.className = isReview ? "avc-agent-chip avc-agent-chip-review" : "avc-agent-chip";
  chip.textContent = isReview
    ? "Review"
    : `${isEssentialWord(token.base) ? "Essential · " : ""}${commonnessLabel(entry.level)} · #${entry.freqRank.toLocaleString()}${opts.fromAudio ? " · heard" : ""}`;

  const displays = wordDisplays(token, entry, displayScript, direction);
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

  // Dual-script mode only: a full-size kana line under the romaji.
  const kanaEl = displays.kana ? document.createElement("div") : null;
  if (kanaEl) {
    kanaEl.className = "avc-agent-word-kana";
    kanaEl.textContent = displays.kana!;
  }

  const readingEl = document.createElement("div");
  readingEl.className = "avc-agent-reading";
  readingEl.textContent = displays.secondary;
  const hasSecondary = !!displays.secondary;
  if (!hasSecondary) readingEl.style.display = "none";

  const glossEl = document.createElement("div");
  glossEl.className = "avc-agent-gloss";
  glossEl.textContent = entry.glosses.join(" · ");

  shell.wordActive.appendChild(chip);
  shell.wordActive.appendChild(wordRow);
  if (kanaEl) shell.wordActive.appendChild(kanaEl);

  if (isReview) {
    readingEl.style.display = "none";
    glossEl.style.display = "none";
    // The dual-script kana line is an answer too, not a prompt — withhold it.
    if (kanaEl) kanaEl.style.display = "none";
    const showBtn = document.createElement("button");
    showBtn.className = "avc-agent-show-answer";
    showBtn.type = "button";
    showBtn.textContent = "Show answer";
    showBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (hasSecondary) readingEl.style.display = "";
      glossEl.style.display = "";
      if (kanaEl) kanaEl.style.display = "";
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
    lbl.textContent = contextSubtitleLabel(direction);
    ctxEl.appendChild(lbl);
    ctxEl.appendChild(document.createTextNode(opts.contextEn));
    shell.wordActive.appendChild(ctxEl);
  }

  shell.wordActive.appendChild(
    buildSentence(sentence, opts.tokens, opts.targetIndex, token.surface, displayScript, direction)
  );
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

  // The Subtitle Lens, on or off, from where the learner already is. Turning
  // our subtitles off to just listen used to mean finding a settings page.
  const lensBtn = document.createElement("button");
  lensBtn.className = "avc-agent-lens-toggle";
  lensBtn.type = "button";
  lensBtn.textContent = "CC";
  lensBtn.setAttribute("aria-label", "Subtitle Lens");
  lensBtn.setAttribute("aria-pressed", "true");
  lensBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    void getSettings().then((s) => setSettings({ subLens: s.subLens === false }));
  });

  const closeBtn = document.createElement("button");
  closeBtn.className = "avc-agent-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close copilot");
  closeBtn.title = "Close copilot";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAgentByUser();
  });

  // Collapse is not close: the card survives it. Labels and titles say so,
  // because two adjacent icon buttons that do different things to your work
  // need to be told apart before they are clicked.
  const collapseBtn = document.createElement("button");
  collapseBtn.className = "avc-agent-collapse";
  collapseBtn.type = "button";
  collapseBtn.setAttribute("aria-label", "Collapse copilot to a rail, keeping the current word");
  collapseBtn.setAttribute("aria-expanded", "true");
  collapseBtn.title = "Collapse to the edge (keeps the current word)";
  collapseBtn.textContent = "›";
  collapseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setCollapsed(true);
  });

  const headActions = document.createElement("div");
  headActions.className = "avc-agent-head-actions";
  headActions.appendChild(lensBtn);
  headActions.appendChild(modeSelect);
  headActions.appendChild(collapseBtn);
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
    // Fallback for a tab without the document_start shield; see lib/key-shield.
    e.stopPropagation();
    // Enter while an IME is composing (typing Japanese) confirms the
    // conversion; it must not send a half-typed message.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitChat();
    }
  });
  chatInput.addEventListener("input", () => { chatActiveAt = Date.now(); });
  // Clicking into the composer is the start of a question.
  chatInput.addEventListener("focus", () => { chatActiveAt = Date.now(); });
  chatInput.addEventListener("click", (e) => e.stopPropagation());
  chatRow.appendChild(chatInput);
  chatRow.appendChild(chatSend);
  composer.appendChild(chatRow);

  panel.appendChild(head);
  panel.appendChild(scrollArea);
  panel.appendChild(foot);
  panel.appendChild(composer);
  // The rail: the only live target while collapsed, so everything else in the
  // strip passes clicks to the player underneath.
  const rail = document.createElement("div");
  rail.className = "avc-agent-rail";
  rail.setAttribute("role", "button");
  rail.setAttribute("tabindex", "0");
  rail.setAttribute("aria-label", "Expand AnimeVocab copilot");
  rail.setAttribute("aria-expanded", "true");
  rail.title = "Expand copilot";
  const railMark = document.createElement("span");
  railMark.className = "avc-agent-rail-mark";
  railMark.textContent = "AnimeVocab";
  const railOpen = document.createElement("span");
  railOpen.className = "avc-agent-rail-open";
  railOpen.textContent = "‹";
  rail.appendChild(railOpen);
  rail.appendChild(railMark);
  const expand = (e: Event): void => {
    e.stopPropagation();
    setCollapsed(false);
  };
  rail.addEventListener("click", expand);
  rail.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); // Space on a role="button" would scroll the page
    expand(e);
  });

  sidebar.appendChild(resize);
  sidebar.appendChild(panel);
  sidebar.appendChild(rail);
  layer.appendChild(ambient);
  layer.appendChild(sidebar);
  root.appendChild(layer);

  sidebar.addEventListener("click", (e) => e.stopPropagation());
  keepFocusOnMouseClick(root);
  // In fullscreen the host sits inside the player, whose double-click toggles
  // fullscreen; selecting a word in the chat must not throw the learner out.
  sidebar.addEventListener("dblclick", (e) => e.stopPropagation());

  document.addEventListener("fullscreenchange", () => {
    if (mounted) mountHost();
  });

  return {
    root, ambient, sidebar, panel, modeSelect, lensBtn, wordSection: scrollArea, scrollArea,
    wordIdle, wordActive, foot, buttons, hint, chatLog, chatInput, chatSend,
    aiOut, explainBtn, hookBtn, collapseBtn, rail,
  };
}

/**
 * Show a transient toast on the page (click or 6.5s to dismiss). Mounts into the
 * overlay's shadow host so it survives without the full panel and isn't styled
 * by the page. Used to surface listening/sync errors that otherwise only showed
 * as an easy-to-miss toolbar badge.
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export function showToast(
  text: string,
  kind: "error" | "info" = "info",
  action?: ToastAction
): void {
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
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = action.label;
    btn.style.cssText =
      "display:block; margin-top:9px; padding:5px 11px; border-radius:7px; cursor:pointer;" +
      `border:1px solid ${accent}; background:transparent; color:${accent};` +
      "font:inherit; font-size:12px; font-weight:600;";
    // The click bubbles to the toast's own dismiss handler, so the toast closes
    // on its own after the action runs.
    btn.addEventListener("click", () => action.onClick());
    toast.appendChild(btn);
  }
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

// ── Limit-reached sheet ────────────────────────────────────────────────────
// Before this existed, running out was invisible: Listening Mode stopped with a
// 6-second toast, the coach printed "Monthly AI limit reached." into a panel
// that is transparent until hovered, and word picking silently downgraded to
// the offline heuristic. None of them said what to do next.

export type LimitKind = "ai" | "auto" | "listening";

/** One sheet per kind per page — a learner watching an episode should be told
 * once, not on every subsequent subtitle line that hits the same wall. */
const limitShown = new Set<LimitKind>();
let paywallEl: HTMLElement | null = null;
let paywallKeyHandler: ((e: KeyboardEvent) => void) | null = null;
/** The shadow root the sheet's key handler also listens on. */
let paywallRoot: ShadowRoot | null = null;

function planLabel(plan: string): string {
  if (plan === "max") return "Max";
  if (plan === "pro") return "Pro";
  return "Free";
}

function hoursLabel(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function buildMeter(label: string, used: number, limit: number, unit: "calls" | "minutes"): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "avc-agent-meter";

  const row = document.createElement("div");
  row.className = "avc-agent-meter-row";
  const name = document.createElement("span");
  name.textContent = label;
  const val = document.createElement("span");
  val.className = "avc-agent-meter-val";
  val.textContent =
    unit === "minutes"
      ? `${hoursLabel(Math.min(used, limit))} / ${hoursLabel(limit)}`
      : `${Math.min(used, limit).toLocaleString()} / ${limit.toLocaleString()}`;
  row.appendChild(name);
  row.appendChild(val);

  const track = document.createElement("div");
  track.className = "avc-agent-meter-track";
  const fill = document.createElement("div");
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  fill.className = pct >= 100 ? "avc-agent-meter-fill avc-meter-full" : "avc-agent-meter-fill";
  fill.style.width = `${pct}%`;
  track.appendChild(fill);

  wrap.appendChild(row);
  wrap.appendChild(track);
  return wrap;
}

function limitCopy(kind: LimitKind, usage: UsageSnapshot | null): { title: string; body: string } {
  const plan = planLabel(usage?.plan || "free");
  if (kind === "listening") {
    const hours = usage?.listening ? hoursLabel(usage.listening.limit) : "this month's";
    return {
      title: "Listening Mode is out of hours",
      body: `You've used all ${hours} of Listening Mode on ${plan} this month. Subtitle capture, reviews and your saved words all keep working — only live audio transcription is paused.`,
    };
  }
  if (kind === "auto") {
    return {
      title: "Smart word picking is paused",
      body: `You've used this month's ${plan} allowance for automatic word picking and pronunciation audio. AnimeVocab falls back to its offline picker and your browser's voice, so cards keep coming — they're just less finely chosen.`,
    };
  }
  const limit = usage?.ai ? usage.ai.limit.toLocaleString() : "this month's";
  return {
    title: "You're out of AI messages",
    body: `That's all ${limit} coach explanations, memory hooks and chat replies on ${plan} for this month. Everything else — cards, reviews, Listening Mode — keeps working.`,
  };
}

function buildPlanButton(tier: TierOffer, featured: boolean): HTMLElement | null {
  if (!tier.checkoutUrl) return null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = featured ? "avc-agent-plan avc-plan-featured" : "avc-agent-plan";

  const left = document.createElement("div");
  const name = document.createElement("div");
  name.className = "avc-agent-plan-name";
  name.textContent = tier.name;
  const perk = document.createElement("div");
  perk.className = "avc-agent-plan-perk";
  perk.textContent = `${tier.aiCallsPerMonth.toLocaleString()} AI messages · ${hoursLabel(tier.listeningMinutes)} Listening`;
  left.appendChild(name);
  left.appendChild(perk);

  const price = document.createElement("div");
  price.className = "avc-agent-plan-price";
  price.textContent = tier.priceLabel;

  btn.appendChild(left);
  btn.appendChild(price);
  btn.addEventListener("click", () => {
    trackExtensionEvent("upgrade_prompt_clicked");
    trackExtensionEvent("checkout_started");
    chrome.runtime.sendMessage({ type: "avc-open-url", url: tier.checkoutUrl }).catch(() => {});
    dismissLimitSheet();
  });
  return btn;
}

export function dismissLimitSheet(): void {
  if (paywallKeyHandler) {
    window.removeEventListener("keydown", paywallKeyHandler, true);
    paywallRoot?.removeEventListener("keydown", paywallKeyHandler as EventListener);
    paywallKeyHandler = null;
    paywallRoot = null;
  }
  const el = paywallEl;
  if (!el) return;
  paywallEl = null;
  el.classList.remove("avc-visible");
  setTimeout(() => el.remove(), 220);
}

/**
 * Explain a cap that was just hit and offer the way out. `usage` is optional:
 * without it the sheet still explains what stopped, it just can't draw meters.
 */
export function showLimitSheet(kind: LimitKind, usage: UsageSnapshot | null): void {
  const root = mountHost();
  if (!root.querySelector("style")) root.innerHTML = `<style>${STYLES}</style>`;
  dismissLimitSheet();

  const overlay = document.createElement("div");
  overlay.className = "avc-agent-paywall";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Monthly limit reached");

  const card = document.createElement("div");
  card.className = "avc-agent-paywall-card";
  // Clicks inside the card must not reach the backdrop's dismiss handler.
  card.addEventListener("click", (e) => e.stopPropagation());

  const kicker = document.createElement("div");
  kicker.className = "avc-agent-paywall-kicker";
  kicker.textContent = `${planLabel(usage?.plan || "free")} plan · monthly limit`;

  const copy = limitCopy(kind, usage);
  const title = document.createElement("div");
  title.className = "avc-agent-paywall-title";
  title.textContent = copy.title;
  const body = document.createElement("div");
  body.className = "avc-agent-paywall-body";
  body.textContent = copy.body;

  card.appendChild(kicker);
  card.appendChild(title);
  card.appendChild(body);

  if (usage) {
    // The meter that ran out comes first and is always shown — an "auto" sheet
    // that listed only AI messages and Listening was reporting balances for two
    // features that were still working, and none for the one that stopped.
    const all: Record<LimitKind, [string, Meter | null, "calls" | "minutes"]> = {
      ai: ["AI messages", usage.ai, "calls"],
      auto: ["Word picking & audio", usage.auto, "calls"],
      listening: ["Listening Mode", usage.listening, "minutes"],
    };
    const order: LimitKind[] = [kind, ...(["ai", "auto", "listening"] as LimitKind[]).filter((k) => k !== kind)];
    for (const k of order) {
      const [label, m, unit] = all[k];
      if (m && m.limit > 0) card.appendChild(buildMeter(label, m.used, m.limit, unit));
    }
  }

  const upgrades: HTMLElement[] = [];
  if (usage?.tiers) {
    // Only offer a genuine step up: a Pro subscriber sees Max, not Pro again.
    if (usage.plan === "free") {
      const pro = buildPlanButton(usage.tiers.pro, true);
      if (pro) upgrades.push(pro);
    }
    if (usage.plan === "free" || usage.plan === "pro") {
      const max = buildPlanButton(usage.tiers.max, usage.plan === "pro");
      if (max) upgrades.push(max);
    }
  }

  if (upgrades.length) {
    trackExtensionEvent("upgrade_prompt_shown");
    const plans = document.createElement("div");
    plans.className = "avc-agent-plans";
    for (const u of upgrades) plans.appendChild(u);
    card.appendChild(plans);
  }

  const foot = document.createElement("div");
  foot.className = "avc-agent-paywall-foot";
  const note = document.createElement("div");
  note.className = "avc-agent-paywall-note";
  note.textContent = upgrades.length
    ? "Cancel anytime. Your saved words stay yours either way."
    : "Your allowance resets at the start of next month.";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "avc-agent-paywall-dismiss";
  dismiss.textContent = "Not now";
  dismiss.addEventListener("click", dismissLimitSheet);
  foot.appendChild(note);
  foot.appendChild(dismiss);
  card.appendChild(foot);

  overlay.appendChild(card);
  overlay.addEventListener("click", dismissLimitSheet);
  root.appendChild(overlay);
  paywallEl = overlay;

  paywallKeyHandler = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    dismissLimitSheet();
  };
  window.addEventListener("keydown", paywallKeyHandler, true);
  // Focus is on the sheet's own button, so the key shield keeps Escape inside
  // our shadow root; listen there too.
  paywallRoot = root;
  root.addEventListener("keydown", paywallKeyHandler as EventListener);

  requestAnimationFrame(() => overlay.classList.add("avc-visible"));
  dismiss.focus();
}

/** Show the sheet the first time each kind of cap is hit on this page. Returns
 * true if it opened. Fetching usage goes through the background worker — a
 * content script's fetch is bound by the page's CORS, not ours. */
export async function reportLimitReached(kind: LimitKind): Promise<boolean> {
  if (limitShown.has(kind)) return false;
  limitShown.add(kind);
  let usage: UsageSnapshot | null = null;
  try {
    const res = (await chrome.runtime.sendMessage({ type: "avc-usage" })) as
      | { ok?: boolean; usage?: UsageSnapshot }
      | undefined;
    if (res?.ok && res.usage) usage = res.usage;
  } catch {
    /* background asleep or offline — the sheet still explains what stopped */
  }
  showLimitSheet(kind, usage);
  return true;
}

export function isAgentMounted(): boolean {
  return mounted;
}

/** Notified whenever the panel opens or closes, however it happened: popup
 * command, the panel's own close button, or a page reload restoring it. The
 * content script forwards this so a reload can bring the panel back with
 * Listening Mode instead of leaving the two out of step (issue #126). */
let visibilityListener: ((open: boolean) => void) | null = null;

export function onAgentVisibility(listener: (open: boolean) => void): void {
  visibilityListener = listener;
}

function announceVisibility(open: boolean): void {
  try {
    visibilityListener?.(open);
  } catch {
    /* never let a listener break mounting */
  }
}

export function ensureAgentMounted(): void {
  const root = mountHost();
  if (!root.querySelector("style")) {
    root.innerHTML = `<style>${STYLES}</style>`;
  }
  if (mounted && shell) return;

  shell = buildShell(root);
  // A fresh shell renders expanded; the stored choice is re-applied below, so
  // the flag must not carry a previous mount's state into this one.
  collapsed = false;
  mounted = true;
  romaji.preloadVoices();
  announceVisibility(true);

  void Promise.all([getSettings(), getAgentPanelWidth(), getAgentPanelCollapsed()]).then(
    ([s, w, collapsed]) => {
      if (!shell) return;
      applyPanelSettings(s);
      setPanelWidth(shell.sidebar, w || PANEL_DEFAULT_W);
      // Re-applying the learner's own choice, so it is not written back.
      if (collapsed) setCollapsed(true, false);
    }
  );
}

/**
 * Reflect settings in the panel's own controls. Called on mount and whenever
 * settings change anywhere (popup, options page, this panel), so the header
 * never shows a mode the extension is no longer in.
 */
export function applyPanelSettings(s: Settings): void {
  if (!shell) return;
  shell.modeSelect.value = s.pauseMode;
  // Mid-card, the card keeps the interaction it opened with; a Focus card that
  // stopped the video still owns that pause and still resumes it.
  if (!wordPending) applyInteractionMode(pauseModeToInteraction(s.pauseMode));
  const lensOn = normalizeDirection(s.learningDirection) === "en-ja" && s.subLens !== false;
  shell.lensBtn.setAttribute("aria-pressed", String(lensOn));
  shell.lensBtn.title = lensOn
    ? "Subtitle Lens on — click to hide our subtitles and just listen"
    : "Subtitle Lens off — click to show interactive subtitles";
  shell.lensBtn.hidden = normalizeDirection(s.learningDirection) !== "en-ja";
}

/**
 * The learner closed the copilot on this tab. Automatic cards used to mount it
 * straight back — the next word reopened the panel they had just closed, and
 * recorded it as open for the next reload. Now only an explicit open (the
 * popup, or a reload restoring a panel that was open) brings it back.
 */
let closedByUser = false;

export function closeAgentByUser(): void {
  closedByUser = true;
  hideAgent();
}

export function openAgent(): void {
  closedByUser = false;
  ensureAgentMounted();
}

export function isClosedByUser(): boolean {
  return closedByUser;
}

/** Remove the sidebar from this tab until opened again. */
export function hideAgent(): void {
  if (wordPending) finishWord("dismiss");
  chatHistory = [];
  chatPayload = null;
  const host = document.getElementById("avc-overlay-host");
  if (host) host.remove();
  shell = null;
  const was = mounted;
  mounted = false;
  if (was) announceVisibility(false);
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

  // Collapsed, the panel is a 36px rail with no readable card in it. Stopping
  // the video for a word the learner cannot see is a worse interruption than
  // the overlap collapsing exists to escape (issue #132), so a collapsed panel
  // behaves as ambient: the card waits on the rail, playback carries on.
  if (options.interaction === "focus" && wasPlaying && video && !collapsed) {
    // Taking the hold *is* the pause: the hold records that the pause event
    // about to be queued is ours, so it does not read as the learner's and
    // freeze the dismissal clock.
    cardHold.hold(video, () => video.pause());
  }
  if (video) {
    const on = <K extends keyof HTMLMediaElementEventMap>(
      type: K,
      fn: (e: HTMLMediaElementEventMap[K]) => void
    ): void => {
      video.addEventListener(type, fn as EventListener);
      videoWatchers.push(() => video.removeEventListener(type, fn as EventListener));
    };

    on("play", () => {
      userResumed = true;
      cardHold.noticePlay(video.paused);
      thawAutoTimers();
    });
    on("pause", () => {
      // Our own pause changes nothing. Theirs is the learner taking the
      // controls just as firmly as pressing play is (issue #127): the card's
      // own resume must not undo it, and the dismissal clock stops so the card
      // is still there when they look up.
      if (cardHold.noticePause()) return;
      freezeAutoTimers();
    });
    // Seeking from a stop is the learner moving to another moment, still
    // stopped. It is issue #130's exact gesture and it ends our claim.
    on("seeking", () => cardHold.noticeSeek(video.paused));
    on("seeked", () => cardHold.noticeSeek(video.paused));

    // A card that arrives on an already-paused frame (a review fired from the
    // panel, say) is the same pause-to-study case: hold it until playback.
    // `wasPlaying` is already false here, so there is nothing to resume.
    if (video.paused && !cardHold.owned()) freezeAutoTimers();

    // Stop the clock while the tab is hidden. Left running, a Focus card timed
    // out in a background tab and resumed the video there; now it waits for the
    // learner to come back to it.
    const onVisibility = (): void => {
      if (document.hidden) {
        freezeAutoTimers();
        return;
      }
      // Back: run again unless the stop is the learner's own.
      if (!video.paused || cardHold.owned()) thawAutoTimers();
    };
    document.addEventListener("visibilitychange", onVisibility);
    videoWatchers.push(() => document.removeEventListener("visibilitychange", onVisibility));
  }

  wordCtx = ctx;
  wordPending = true;
  populateWordSection(ctx);
  // A collapsed panel must not swallow a word silently: the rail marks that
  // one is waiting behind it.
  shell?.sidebar.classList.add("avc-has-card");
  applyInteractionMode(options.interaction);

  keyHandler = (e: KeyboardEvent) => {
    if (!wordPending) return;
    // Never hijack 1/2/3 (or any judge key) while the user is typing — into a
    // page field (a YouTube search box) or into our own chat. The chat lives in
    // a shadow root, so a window listener sees the event retargeted to the host
    // <div>; isTypingEvent looks through that. Typing "2" in a question used to
    // save the word as Learn and swallow the digit.
    if (e.metaKey || e.ctrlKey || e.altKey || isTypingEvent(e)) return;
    const match = currentJudgments.find((j) => j.key === e.key);
    if (match) {
      e.preventDefault();
      e.stopPropagation();
      finishWord(match.val);
    }
  };
  window.addEventListener("keydown", keyHandler, true);
  // With focus on one of the panel's buttons the key shield keeps the key in
  // our shadow root, so the judge keys have to be heard there as well.
  shell?.root.addEventListener("keydown", keyHandler as EventListener);

  return new Promise((resolve) => {
    wordResolve = resolve;
  });
}
