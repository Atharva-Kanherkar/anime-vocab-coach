// Cursor-style learning agent: persistent transparent panel on the video.
// ambient = watch uninterrupted (copilot). focus = pauses video (pause mode).

import * as romaji from "./romaji";
import { lookup } from "./dictionary";
import { commonnessLabel } from "./levels";
import type { DictEntry, DisplayScript, Judgment, Target, Token } from "../types";

export type InteractionMode = "ambient" | "focus";

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

export interface AgentPanelOptions extends CardOptions {
  interaction: InteractionMode;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface CoachResp {
  ok?: boolean;
  error?: string;
  result?: { meaning?: string; nuance?: string; hooks?: string[]; reply?: string };
}

let agentOpen = false;
let agentResolve: ((judgment: Judgment | "dismiss") => void) | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let autoTimer: ReturnType<typeof setTimeout> | null = null;
let playHandler: (() => void) | null = null;
let userResumed = false;
let activeVideo: HTMLVideoElement | null = null;
let wasPlaying = false;

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .avc-agent-layer {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
  }
  .avc-agent-ambient {
    position: absolute; inset: 0; opacity: 0;
    transition: opacity 520ms ease;
  }
  .avc-agent-ambient.avc-ambient { opacity: 1; }
  .avc-agent-ambient.avc-focus {
    opacity: 1;
    background:
      radial-gradient(ellipse 100% 80% at 50% 100%, rgba(8, 6, 4, 0.55) 0%, transparent 62%),
      radial-gradient(ellipse 70% 50% at 92% 88%, rgba(227, 168, 72, 0.14) 0%, transparent 55%);
  }
  .avc-agent-ambient.avc-ambient-tone {
    background:
      radial-gradient(ellipse 85% 65% at 90% 92%, rgba(227, 168, 72, 0.16) 0%, transparent 58%),
      radial-gradient(ellipse 50% 40% at 8% 90%, rgba(217, 108, 79, 0.04) 0%, transparent 50%);
  }
  .avc-agent-panel {
    position: fixed; right: 20px; bottom: 22px;
    width: min(420px, calc(100vw - 40px));
    max-height: min(78vh, 640px);
    display: flex; flex-direction: column;
    pointer-events: auto;
    background: rgba(10, 9, 8, 0.62);
    backdrop-filter: blur(24px) saturate(1.2);
    -webkit-backdrop-filter: blur(24px) saturate(1.2);
    border: 1px solid rgba(227, 186, 99, 0.22);
    border-radius: 16px;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.04) inset,
      0 24px 64px rgba(0, 0, 0, 0.45),
      0 0 100px rgba(227, 168, 72, 0.08);
    color: rgba(248, 244, 236, 0.96);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    transform: translateY(16px) scale(0.98);
    opacity: 0;
    transition: opacity 320ms ease, transform 400ms cubic-bezier(0.22, 1, 0.36, 1);
    overflow: hidden;
  }
  .avc-agent-panel.avc-visible { opacity: 1; transform: translateY(0) scale(1); }
  .avc-agent-panel.avc-focus-panel {
    border-color: rgba(227, 186, 99, 0.32);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.06) inset,
      0 28px 72px rgba(0, 0, 0, 0.52),
      0 0 120px rgba(227, 168, 72, 0.12);
  }
  .avc-agent-head {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(227, 186, 99, 0.12);
    flex-shrink: 0;
  }
  .avc-agent-brand {
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(227, 186, 99, 0.75);
  }
  .avc-agent-mode {
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    border: 1px solid rgba(227, 186, 99, 0.28);
    color: rgba(240, 239, 236, 0.65);
    background: rgba(227, 186, 99, 0.08);
  }
  .avc-agent-mode.avc-focus-mode {
    border-color: rgba(217, 108, 79, 0.35);
    color: rgba(217, 140, 110, 0.9);
    background: rgba(217, 108, 79, 0.1);
  }
  .avc-agent-close {
    width: 28px; height: 28px; border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(240, 239, 236, 0.5);
    font-size: 17px; line-height: 1; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: color 120ms, border-color 120ms, background 120ms;
  }
  .avc-agent-close:hover {
    color: rgba(240, 239, 236, 0.9);
    border-color: rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.08);
  }
  .avc-agent-body {
    overflow-y: auto; padding: 12px 16px 14px;
    flex: 1; min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(227,186,99,.25) transparent;
  }
  .avc-agent-chip {
    display: inline-block; font-size: 10px; letter-spacing: 0.07em;
    text-transform: uppercase; color: rgba(240, 239, 236, 0.45);
    margin-bottom: 10px;
  }
  .avc-agent-chip-review { color: rgba(217, 108, 79, 0.85); }
  .avc-agent-word-row { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; }
  .avc-agent-word {
    font-size: 32px; font-weight: 650; line-height: 1.1;
    font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif;
  }
  .avc-agent-speak {
    background: transparent; color: rgba(240, 239, 236, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 6px;
    padding: 3px 10px; cursor: pointer; font-size: 11px;
    letter-spacing: 0.04em; transition: color 120ms, border-color 120ms;
  }
  .avc-agent-speak:hover { color: rgba(240, 239, 236, 0.9); border-color: rgba(255, 255, 255, 0.3); }
  .avc-agent-reading { font-size: 14px; color: rgba(240, 239, 236, 0.52); margin-bottom: 8px; }
  .avc-agent-gloss { font-size: 15px; line-height: 1.45; color: rgba(240, 239, 236, 0.88); margin-bottom: 12px; }
  .avc-agent-context, .avc-agent-sentence {
    font-size: 13px; line-height: 1.55; color: rgba(240, 239, 236, 0.72);
    margin-bottom: 10px; padding: 9px 12px;
    background: rgba(255, 255, 255, 0.03);
    border-left: 2px solid rgba(227, 186, 99, 0.22);
    border-radius: 0 8px 8px 0;
  }
  .avc-agent-label {
    display: block; font-size: 9px; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgba(240, 239, 236, 0.35); margin-bottom: 4px;
  }
  .avc-agent-ja-line { font-family: "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif; font-size: 14px; line-height: 1.65; }
  .avc-agent-romaji-line { margin-bottom: 4px; font-size: 13px; }
  .avc-agent-tok { cursor: pointer; border-bottom: 1px dotted rgba(240, 239, 236, 0.3); }
  .avc-agent-tok:hover { color: #e3ba63; }
  .avc-agent-sentence mark, .avc-agent-romaji-line mark {
    background: transparent; color: #e3ba63; font-weight: 650;
  }
  .avc-agent-lookup { margin-top: 6px; font-size: 12px; }
  .avc-agent-ai { margin: 12px 0 10px; }
  .avc-agent-ai-btns { display: flex; gap: 6px; margin-bottom: 8px; }
  .avc-agent-ai-btn {
    flex: 1; padding: 6px 8px; font-size: 12px; cursor: pointer;
    background: rgba(227, 186, 99, 0.08); color: rgba(240, 239, 236, 0.85);
    border: 1px solid rgba(227, 186, 99, 0.22); border-radius: 8px;
    transition: background 120ms, border-color 120ms;
  }
  .avc-agent-ai-btn:hover { background: rgba(227, 186, 99, 0.14); border-color: rgba(227, 186, 99, 0.35); }
  .avc-agent-ai-btn:disabled { opacity: 0.45; cursor: default; }
  .avc-agent-ai-out { font-size: 12px; line-height: 1.5; color: rgba(240, 239, 236, 0.82); }
  .avc-agent-ai-label {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
    color: rgba(240, 239, 236, 0.38); margin-top: 6px;
  }
  .avc-agent-ai-hooks { margin: 4px 0 0 14px; font-size: 12px; }
  .avc-agent-chat {
    margin-top: 10px; padding-top: 10px;
    border-top: 1px solid rgba(227, 186, 99, 0.12);
  }
  .avc-agent-chat-label {
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(227, 186, 99, 0.6); margin-bottom: 8px;
  }
  .avc-agent-chat-log {
    max-height: 132px; overflow-y: auto; margin-bottom: 8px;
    display: flex; flex-direction: column; gap: 6px;
    scrollbar-width: thin;
  }
  .avc-agent-chat-msg {
    font-size: 12px; line-height: 1.45; padding: 7px 10px;
    border-radius: 8px; max-width: 95%;
  }
  .avc-agent-chat-msg.avc-user {
    align-self: flex-end;
    background: rgba(227, 186, 99, 0.12);
    border: 1px solid rgba(227, 186, 99, 0.2);
    color: rgba(248, 244, 236, 0.92);
  }
  .avc-agent-chat-msg.avc-assistant {
    align-self: flex-start;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(240, 239, 236, 0.82);
  }
  .avc-agent-chat-row { display: flex; gap: 6px; }
  .avc-agent-chat-input {
    flex: 1; resize: none; min-height: 36px; max-height: 72px;
    padding: 8px 10px; font-size: 12px; line-height: 1.4;
    border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.25); color: rgba(248, 244, 236, 0.92);
    font-family: inherit;
  }
  .avc-agent-chat-input:focus {
    outline: none; border-color: rgba(227, 186, 99, 0.35);
  }
  .avc-agent-chat-input::placeholder { color: rgba(240, 239, 236, 0.3); }
  .avc-agent-chat-send {
    padding: 0 12px; border-radius: 8px; cursor: pointer;
    border: 1px solid rgba(227, 186, 99, 0.28);
    background: rgba(227, 186, 99, 0.12);
    color: rgba(248, 244, 236, 0.9); font-size: 12px;
    transition: background 120ms;
  }
  .avc-agent-chat-send:hover { background: rgba(227, 186, 99, 0.2); }
  .avc-agent-chat-send:disabled { opacity: 0.4; cursor: default; }
  .avc-agent-foot {
    padding: 10px 16px 14px; flex-shrink: 0;
    border-top: 1px solid rgba(227, 186, 99, 0.1);
    background: rgba(0, 0, 0, 0.15);
  }
  .avc-agent-buttons { display: flex; gap: 6px; margin-bottom: 8px; }
  .avc-agent-buttons button {
    flex: 1; border-radius: 8px; padding: 9px 4px 7px; cursor: pointer;
    border: 1px solid transparent; font-family: inherit; font-size: 14px;
    transition: filter 120ms, border-color 120ms;
  }
  .avc-agent-buttons button:hover { filter: brightness(1.12); }
  .avc-agent-buttons button span {
    display: block; font-size: 9.5px; margin-top: 2px;
    letter-spacing: 0.02em; opacity: 0.55;
  }
  .avc-agent-know {
    background: rgba(255,255,255,.04); color: rgba(240,239,236,.85);
    border-color: rgba(255,255,255,.14);
  }
  .avc-agent-learn { background: rgba(196, 85, 58, 0.85); color: #fff; }
  .avc-agent-ignore {
    background: transparent; color: rgba(240,239,236,.4);
    border-color: rgba(255,255,255,.08);
  }
  .avc-agent-review-pass { background: rgba(61, 138, 99, 0.85); color: #fff; }
  .avc-agent-review-fail {
    background: transparent; color: #c96a5a;
    border-color: rgba(201,106,90,.4);
  }
  .avc-agent-show-answer {
    width: 100%; margin-bottom: 10px; padding: 8px 12px;
    border-radius: 8px; border: 1px solid rgba(255,255,255,.16);
    background: transparent; color: rgba(240,239,236,.8);
    font-size: 13px; cursor: pointer;
  }
  .avc-agent-hint {
    font-size: 10px; color: rgba(240, 239, 236, 0.28);
    text-align: center; letter-spacing: 0.03em;
  }
  @media (prefers-reduced-motion: reduce) {
    .avc-agent-panel, .avc-agent-ambient { transition: none; transform: none; }
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

function appendChatBubble(log: HTMLElement, role: "user" | "assistant", text: string): void {
  const bubble = document.createElement("div");
  bubble.className = `avc-agent-chat-msg avc-${role}`;
  bubble.textContent = text;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}

function buildChatSection(
  token: Token,
  entry: DictEntry,
  sentence: string,
  title: string | null,
  onActivity: () => void
): HTMLElement {
  const chat = document.createElement("div");
  chat.className = "avc-agent-chat";
  const label = document.createElement("div");
  label.className = "avc-agent-chat-label";
  label.textContent = "Ask about this word";
  const log = document.createElement("div");
  log.className = "avc-agent-chat-log";
  const row = document.createElement("div");
  row.className = "avc-agent-chat-row";
  const input = document.createElement("textarea");
  input.className = "avc-agent-chat-input";
  input.rows = 1;
  input.placeholder = "Why did they say it this way?";
  const send = document.createElement("button");
  send.className = "avc-agent-chat-send";
  send.type = "button";
  send.textContent = "Send";

  const history: ChatTurn[] = [];

  const submit = async (): Promise<void> => {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    onActivity();
    appendChatBubble(log, "user", text);
    history.push({ role: "user", content: text });
    send.disabled = true;
    input.disabled = true;
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: "avc-coach-chat",
        message: text,
        history: history.slice(0, -1),
        payload: {
          word: token.base,
          reading: entry.reading,
          gloss: entry.glosses[0] || "",
          line: sentence,
          level: entry.level,
          title,
        },
      })) as CoachResp | undefined;
      if (!resp?.ok || !resp.result?.reply) {
        appendChatBubble(log, "assistant", coachErrorText(resp) || "No reply.");
        return;
      }
      history.push({ role: "assistant", content: resp.result.reply });
      appendChatBubble(log, "assistant", resp.result.reply);
    } catch {
      appendChatBubble(log, "assistant", "Network error.");
    } finally {
      send.disabled = false;
      input.disabled = false;
      input.focus();
    }
  };

  send.addEventListener("click", (e) => { e.stopPropagation(); void submit(); });
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  });
  input.addEventListener("click", (e) => e.stopPropagation());

  row.appendChild(input);
  row.appendChild(send);
  chat.appendChild(label);
  chat.appendChild(log);
  chat.appendChild(row);
  return chat;
}

function buildAiQuickSection(
  token: Token,
  entry: DictEntry,
  sentence: string,
  title: string | null,
  onActivity: () => void
): HTMLElement {
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
  const out = document.createElement("div");
  out.className = "avc-agent-ai-out";
  out.style.display = "none";
  btns.appendChild(explainBtn);
  btns.appendChild(hookBtn);
  ai.appendChild(btns);
  ai.appendChild(out);

  const ask = async (mode: "explain" | "hooks"): Promise<void> => {
    onActivity();
    explainBtn.disabled = true;
    hookBtn.disabled = true;
    out.style.display = "";
    out.textContent = "Thinking…";
    try {
      const resp = (await chrome.runtime.sendMessage({
        type: "avc-coach",
        mode,
        payload: { word: token.base, reading: entry.reading, gloss: entry.glosses[0] || "", line: sentence, level: entry.level, title },
      })) as CoachResp | undefined;
      renderCoachOut(out, mode, resp);
    } catch {
      out.textContent = "AI unavailable.";
    } finally {
      explainBtn.disabled = false;
      hookBtn.disabled = false;
    }
  };
  explainBtn.addEventListener("click", (e) => { e.stopPropagation(); void ask("explain"); });
  hookBtn.addEventListener("click", (e) => { e.stopPropagation(); void ask("hooks"); });
  return ai;
}

function cleanupAgent(root: ShadowRoot | null): void {
  agentOpen = false;
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  if (keyHandler) {
    window.removeEventListener("keydown", keyHandler, true);
    keyHandler = null;
  }
  if (playHandler && activeVideo) {
    activeVideo.removeEventListener("play", playHandler);
    playHandler = null;
  }
  userResumed = false;
  if (root) root.querySelector(".avc-agent-layer")?.remove();
  if (wasPlaying && !userResumed && activeVideo?.paused) {
    activeVideo.play().catch(() => {});
  }
  activeVideo = null;
  wasPlaying = false;
}

function finishAgent(root: ShadowRoot, judgment: Judgment | "dismiss"): void {
  const fn = agentResolve;
  cleanupAgent(root);
  agentResolve = null;
  if (fn) fn(judgment);
}

export function dismissAgent(): void {
  if (!agentOpen) return;
  finishAgent(mountHost(), "dismiss");
}

export function isAgentActive(): boolean {
  return agentOpen;
}

export function isOpen(): boolean {
  return agentOpen;
}

export function showAgentPanel(
  target: Target,
  sentence: string,
  video: HTMLVideoElement | null,
  options: AgentPanelOptions
): Promise<Judgment | "dismiss"> {
  if (agentOpen) dismissAgent();

  const opts = options;
  const displayScript: DisplayScript = opts.displayScript || "romaji";
  const { token, entry, isReview } = target;
  const focus = opts.interaction === "focus";

  wasPlaying = !!(video && !video.paused && !video.ended);
  activeVideo = video;
  userResumed = false;

  if (focus && wasPlaying && video) video.pause();
  if (video) {
    playHandler = () => { userResumed = true; };
    video.addEventListener("play", playHandler);
  }

  return new Promise((resolve) => {
    agentOpen = true;
    agentResolve = resolve;

    const root = mountHost();
    if (!root.querySelector("style")) root.innerHTML = `<style>${STYLES}</style>`;
    root.querySelector(".avc-agent-layer")?.remove();

    const layer = document.createElement("div");
    layer.className = "avc-agent-layer";

    const ambient = document.createElement("div");
    ambient.className = `avc-agent-ambient avc-visible ${focus ? "avc-focus" : "avc-ambient-tone"}`;

    const panel = document.createElement("div");
    panel.className = `avc-agent-panel ${focus ? "avc-focus-panel" : ""}`;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "AnimeVocab learning agent");

    const head = document.createElement("div");
    head.className = "avc-agent-head";
    const brand = document.createElement("div");
    brand.className = "avc-agent-brand";
    brand.textContent = "AnimeVocab";
    const modeBadge = document.createElement("div");
    modeBadge.className = `avc-agent-mode ${focus ? "avc-focus-mode" : ""}`;
    modeBadge.textContent = focus ? "Focus" : "Ambient";
    const closeBtn = document.createElement("button");
    closeBtn.className = "avc-agent-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Dismiss");
    closeBtn.textContent = "\u00d7";
    const headLeft = document.createElement("div");
    headLeft.style.display = "flex";
    headLeft.style.alignItems = "center";
    headLeft.style.gap = "10px";
    headLeft.appendChild(brand);
    headLeft.appendChild(modeBadge);
    head.appendChild(headLeft);
    head.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "avc-agent-body";

    const chip = document.createElement("div");
    chip.className = isReview ? "avc-agent-chip avc-agent-chip-review" : "avc-agent-chip";
    chip.textContent = isReview
      ? "Review"
      : `${commonnessLabel(entry.level)} · #${entry.freqRank.toLocaleString()}${opts.fromAudio ? " · heard" : ""}`;

    const displays = wordDisplays(token, entry, displayScript);
    const wordRow = document.createElement("div");
    wordRow.className = "avc-agent-word-row";
    const wordEl = document.createElement("div");
    wordEl.className = "avc-agent-word";
    wordEl.textContent = displays.big;
    const speakBtn = document.createElement("button");
    speakBtn.className = "avc-agent-speak";
    speakBtn.type = "button";
    speakBtn.textContent = "Listen";
    speakBtn.addEventListener("click", (e) => { e.stopPropagation(); romaji.speak(token.surface); });
    wordRow.appendChild(wordEl);
    wordRow.appendChild(speakBtn);

    const readingEl = document.createElement("div");
    readingEl.className = "avc-agent-reading";
    readingEl.textContent = displays.secondary;

    const glossEl = document.createElement("div");
    glossEl.className = "avc-agent-gloss";
    glossEl.textContent = entry.glosses.join(" · ");

    body.appendChild(chip);
    body.appendChild(wordRow);

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
      body.appendChild(showBtn);
    }

    body.appendChild(readingEl);
    body.appendChild(glossEl);

    if (opts.contextEn) {
      const ctx = document.createElement("div");
      ctx.className = "avc-agent-context";
      const lbl = document.createElement("span");
      lbl.className = "avc-agent-label";
      lbl.textContent = "English subtitle";
      ctx.appendChild(lbl);
      ctx.appendChild(document.createTextNode(opts.contextEn));
      body.appendChild(ctx);
    }

    body.appendChild(buildSentence(sentence, opts.tokens, opts.targetIndex, token.surface, displayScript));

    const bumpAutoTimer = (): void => {
      if (autoTimer) clearTimeout(autoTimer);
      const sec = opts.autoResumeSec || 0;
      if (focus && sec > 0) {
        autoTimer = setTimeout(() => finishAgent(root, "dismiss"), sec * 1000);
      }
    };

    body.appendChild(buildAiQuickSection(token, entry, sentence, opts.title || null, bumpAutoTimer));
    body.appendChild(buildChatSection(token, entry, sentence, opts.title || null, bumpAutoTimer));

    const foot = document.createElement("div");
    foot.className = "avc-agent-foot";
    const buttons = document.createElement("div");
    buttons.className = "avc-agent-buttons";
    const hint = document.createElement("div");
    hint.className = "avc-agent-hint";

    interface ButtonSpec { cls: string; ja: string; en: string; val: Judgment; key: string; }
    let judgments: ButtonSpec[];
    if (isReview) {
      judgments = [
        { cls: "avc-agent-review-pass", ja: "覚えてた", en: "Got it", val: "review-pass", key: "1" },
        { cls: "avc-agent-review-fail", ja: "忘れた", en: "Forgot", val: "review-fail", key: "2" },
      ];
      hint.textContent = "Esc dismiss · 1 / 2";
    } else {
      judgments = [
        { cls: "avc-agent-know", ja: "知ってる", en: "Know it", val: "know", key: "1" },
        { cls: "avc-agent-learn", ja: "学ぶ", en: "Learn", val: "learn", key: "2" },
        { cls: "avc-agent-ignore", ja: "無視", en: "Skip", val: "ignore", key: "3" },
      ];
      hint.textContent = "Esc dismiss · 1 / 2 / 3";
    }

    judgments.forEach((j) => {
      const btn = document.createElement("button");
      btn.className = j.cls;
      btn.innerHTML = `${j.ja}<span>${j.en}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        finishAgent(root, j.val);
      });
      buttons.appendChild(btn);
    });

    foot.appendChild(buttons);
    foot.appendChild(hint);
    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(foot);
    layer.appendChild(ambient);
    layer.appendChild(panel);
    root.appendChild(layer);

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      finishAgent(root, "dismiss");
    });
    panel.addEventListener("click", (e) => e.stopPropagation());

    keyHandler = (e: KeyboardEvent) => {
      if (!agentOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finishAgent(root, "dismiss");
        return;
      }
      const match = judgments.find((j) => j.key === e.key);
      if (match && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        e.stopPropagation();
        finishAgent(root, match.val);
      }
    };
    window.addEventListener("keydown", keyHandler, true);

    const onFsChange = (): void => {
      if (agentOpen) mountHost();
    };
    document.addEventListener("fullscreenchange", onFsChange);

    requestAnimationFrame(() => panel.classList.add("avc-visible"));

    if (opts.autoSpeak && focus) {
      setTimeout(() => romaji.speak(token.surface), 250);
    }

    if (focus && (opts.autoResumeSec || 0) > 0) bumpAutoTimer();

    agentResolve = (judgment) => {
      document.removeEventListener("fullscreenchange", onFsChange);
      resolve(judgment);
    };
  });
}
