// The in-page sign-in chip (#206).
//
// While signed out the extension still needs to say why nothing is happening.
// The chip is the smallest possible surface: one primary action and a dismiss
// control, in a shadow root so the host page cannot restyle it and its
// keyboard shortcuts cannot reach our button.
//
// This module owns only the chip. The content script decides whether it should
// be up (lib/signin-gate.shouldShowSigninChip) and mounts or unmounts it.
import { trackSignin } from "./feature-events";
import { UI_HOST_ATTR, keepFocusOnMouseClick } from "./key-shield";
import { SIGNIN_CHIP_DISMISSED_KEY, SIGNIN_GATE_COPY } from "./signin-gate";

/** The message the background turns into the link-first flow. */
export const OPEN_SIGNIN_MESSAGE = "avc-open-signin";

/** How long the primary button stays in its busy state if the worker never answers. */
const BUSY_TIMEOUT_MS = 15_000;

/** A player iframe smaller than this is an ad or a thumbnail, not the video. */
const MIN_PLAYER_IFRAME = 320;

const STYLES = `
  :host { all: initial; }
  .chip {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483000;
    width: 296px;
    box-sizing: border-box;
    padding: 14px 16px 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    background: #16171d;
    color: #f4f4f6;
    font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  }
  .title {
    margin: 0 0 4px;
    padding-right: 18px;
    font-size: 14px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  .note {
    margin: 0 0 12px;
    color: #b9bac4;
    font-size: 12px;
  }
  .actions { display: flex; align-items: center; gap: 10px; }
  .cta {
    flex: 1;
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 9px;
    background: #f4f4f6;
    color: #16171d;
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }
  .cta:hover { background: #ffffff; }
  .cta:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }
  .cta[disabled] { opacity: 0.7; cursor: default; }
  .dismiss {
    flex: none;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #9a9ba6;
    font: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .dismiss:hover { background: rgba(255, 255, 255, 0.08); color: #f4f4f6; }
  .dismiss:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }
  @media (prefers-reduced-motion: no-preference) {
    .chip { animation: rise 160ms ease-out; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px); } }
  }
`;

let host: HTMLDivElement | null = null;
let cta: HTMLButtonElement | null = null;
let busyTimer: ReturnType<typeof setTimeout> | null = null;
let busy = false;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function setBusy(next: boolean): void {
  busy = next;
  if (busyTimer) { clearTimeout(busyTimer); busyTimer = null; }
  if (!cta) return;
  cta.disabled = next;
  cta.textContent = next ? SIGNIN_GATE_COPY.chipBusy : SIGNIN_GATE_COPY.chipCta;
  if (next) busyTimer = setTimeout(() => setBusy(false), BUSY_TIMEOUT_MS);
}

/** A video, or a player iframe large enough to be the thing being watched. */
export function hasPlayableMedia(doc: Document = document): boolean {
  if (doc.querySelector("video")) return true;
  const frames = doc.querySelectorAll("iframe");
  for (const frame of Array.from(frames)) {
    const r = frame.getBoundingClientRect();
    if (r.width >= MIN_PLAYER_IFRAME && r.height >= MIN_PLAYER_IFRAME) return true;
  }
  return false;
}

/** The learner closed the chip on this profile. */
export async function getSigninChipDismissed(): Promise<boolean> {
  try {
    const r = await chrome.storage.local.get([SIGNIN_CHIP_DISMISSED_KEY]);
    return r[SIGNIN_CHIP_DISMISSED_KEY] === true;
  } catch {
    return false;
  }
}

export async function setSigninChipDismissed(): Promise<void> {
  try {
    await chrome.storage.local.set({ [SIGNIN_CHIP_DISMISSED_KEY]: true });
  } catch {
    // The chip still comes down for this page even if the write fails.
  }
}

export function isSigninChipMounted(): boolean {
  return !!host;
}

/** Mount the chip if it is not already up. Safe to call on every poll. */
export function mountSigninChip(): void {
  if (host) return;
  const parent = (document.fullscreenElement as HTMLElement | null) || document.body;
  if (!parent) return;

  host = document.createElement("div");
  host.setAttribute("data-avc-signin-chip", "");
  // Keystrokes aimed at the chip are ours, not the player's (lib/key-shield).
  host.setAttribute(UI_HOST_ATTR, "");

  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  root.appendChild(style);

  const chip = document.createElement("div");
  chip.className = "chip";
  chip.setAttribute("role", "region");
  chip.setAttribute("aria-label", SIGNIN_GATE_COPY.chipTitle);
  chip.innerHTML =
    `<p class="title">${esc(SIGNIN_GATE_COPY.chipTitle)}</p>` +
    `<p class="note">${esc(SIGNIN_GATE_COPY.chipNote)}</p>` +
    `<div class="actions">` +
    `<button type="button" class="cta">${esc(SIGNIN_GATE_COPY.chipCta)}</button>` +
    `<button type="button" class="dismiss" aria-label="${esc(SIGNIN_GATE_COPY.chipDismiss)}" title="${esc(SIGNIN_GATE_COPY.chipDismiss)}">\u00d7</button>` +
    `</div>`;
  root.appendChild(chip);
  keepFocusOnMouseClick(root);

  cta = chip.querySelector<HTMLButtonElement>(".cta");
  cta?.addEventListener("click", () => {
    if (busy) return;
    setBusy(true);
    void trackSignin("signin_started", "content_chip");
    try {
      void chrome.runtime
        .sendMessage({ type: OPEN_SIGNIN_MESSAGE, from: "content_chip" })
        .then(() => setBusy(false))
        .catch(() => setBusy(false));
    } catch {
      setBusy(false);
    }
  });

  chip.querySelector<HTMLButtonElement>(".dismiss")?.addEventListener("click", () => {
    void setSigninChipDismissed();
    unmountSigninChip();
    void trackSignin("signin_gate_dismissed", "content_chip");
  });

  parent.appendChild(host);
  // Follow the player in and out of fullscreen, like the Lens.
  document.addEventListener("fullscreenchange", onFullscreenChange);
  void trackSignin("signin_gate_shown", "content_chip");
}

/** Take the chip down. Safe when it is not up. */
export function unmountSigninChip(): void {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  if (busyTimer) { clearTimeout(busyTimer); busyTimer = null; }
  busy = false;
  cta = null;
  host?.remove();
  host = null;
}

function onFullscreenChange(): void {
  if (!host) return;
  const parent = (document.fullscreenElement as HTMLElement | null) || document.body;
  if (parent && host.parentElement !== parent) parent.appendChild(host);
}
