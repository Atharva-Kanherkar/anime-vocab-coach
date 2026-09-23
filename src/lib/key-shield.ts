// Keeps keystrokes aimed at our own UI away from the host page.
//
// Netflix and YouTube bind their player shortcuts (space = play/pause, f =
// fullscreen, m = mute, arrows = seek, digits = jump) on the window, some in the
// capture phase. Keyboard events are composed, so a key typed into the copilot
// chat — inside our shadow root — travels window → document → … → host before
// it ever reaches the textarea. The `stopPropagation()` the textarea's own
// listener used to call ran far too late: the player had already paused or
// resumed the video. And because the event is retargeted to the shadow host
// outside our tree, the page's "is the user typing?" check sees a plain <div>
// and treats every letter as a shortcut.
//
// The shield is a window capture listener installed at document_start, before
// any page script runs, so it is the first listener the event meets. When the
// event belongs to our UI it stops it dead, then replays a non-composed copy on
// the original target. That copy runs our own listeners (Enter to send, the
// judge keys, Escape) and cannot leave our shadow tree, so the page never sees
// either one. Typing still works: the original event's default action (the
// character landing in the textarea) does not depend on propagation.

/** Marks an element that hosts AnimeVocab UI (a shadow host). */
export const UI_HOST_ATTR = "data-avc-ui";

const KEY_EVENTS = ["keydown", "keyup", "keypress"] as const;

type ShieldWindow = Window & { __avcKeyShield?: boolean };

/** True when the event started inside one of our UI hosts. */
export function fromOurUi(e: Event): boolean {
  for (const node of e.composedPath()) {
    if (node instanceof Element && node.hasAttribute(UI_HOST_ATTR)) return true;
  }
  return false;
}

/** The element the event really started on, through any open shadow root.
 * `e.target` is retargeted to the shadow host for listeners outside it. */
export function originalTarget(e: Event): EventTarget | null {
  const path = e.composedPath();
  return path.length ? path[0] : e.target;
}

/** Whether typing into this element is typing, not a shortcut. */
export function isEditableTarget(node: EventTarget | null): boolean {
  const el = node as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

/** True when the learner is typing into a field — ours or the page's. */
export function isTypingEvent(e: Event): boolean {
  if (isEditableTarget(originalTarget(e))) return true;
  // Focus can sit in an editable while the event targets something else.
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return isEditableTarget(active);
}

/**
 * A mouse click on one of our buttons must not move keyboard focus onto it.
 *
 * Focus left on a panel button kept every later key inside our UI: Space, the
 * player's play/pause key, re-pressed "Explain" or the Subtitle Lens toggle
 * instead of reaching the video. Keyboard users still Tab to the buttons as
 * usual; this only stops the pointer from parking focus there. A <select> and
 * the text fields are exempt, since they need focus to work at all.
 */
export function keepFocusOnMouseClick(root: ShadowRoot): void {
  root.addEventListener("mousedown", (e) => {
    const el = e.composedPath()[0] as Element | null;
    if (!el || typeof (el as Element).closest !== "function") return;
    if (el.closest("input, textarea, select, [contenteditable]")) return;
    if (el.closest("button, [role='button']")) e.preventDefault();
  });
}

function relay(e: KeyboardEvent): void {
  const target = originalTarget(e);
  // Only replay inside a shadow tree: a non-composed event dispatched on a
  // light-DOM node would bubble straight back out to the page.
  if (!(target instanceof Node) || !(target.getRootNode() instanceof ShadowRoot)) return;
  const copy = new KeyboardEvent(e.type, {
    key: e.key,
    code: e.code,
    location: e.location,
    repeat: e.repeat,
    isComposing: e.isComposing,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    bubbles: true,
    cancelable: true,
    composed: false,
  });
  // Our handlers cancel the copy (Enter must not add a newline); carry that
  // back to the real event, whose default action is the one that counts.
  if (!target.dispatchEvent(copy)) e.preventDefault();
}

function shield(e: Event): void {
  // Our own replay never reaches the window (it is not composed); anything else
  // untrusted is the page's business.
  if (!e.isTrusted || !fromOurUi(e)) return;
  e.stopImmediatePropagation();
  relay(e as KeyboardEvent);
}

/**
 * Install once per window. Returns false when it was already installed — the
 * document_start script normally gets there first, and the content script
 * calls this again as a fallback for tabs it was injected into late.
 */
export function installKeyShield(win: Window = window): boolean {
  const w = win as ShieldWindow;
  if (w.__avcKeyShield) return false;
  w.__avcKeyShield = true;
  for (const type of KEY_EVENTS) win.addEventListener(type, shield, true);
  return true;
}
