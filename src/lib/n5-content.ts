import { mountN5Focus } from "./n5-focus-panel";
import { parseN5PilotState, type PilotState } from "./n5-pilot";
interface Incoming { type?: string; sessionId?: string; context?: unknown; lesson?: unknown }
export function installN5Content(video: () => HTMLVideoElement | null, sessionId: () => string, setFocus: (active: boolean) => void): void {
  let selectedVideo: HTMLVideoElement | null = null;
  let selectedSession = "";
  let removePanel: (() => void) | null = null;
  let ended = false;
  function clear() { removePanel?.(); removePanel = null; selectedVideo = null; selectedSession = ""; setFocus(false); }
  function valid() { return selectedVideo !== null && selectedVideo === video() && selectedSession === sessionId(); }
  function mount(lesson: NonNullable<PilotState["lesson"]>, pinned: string) {
    clear(); selectedVideo = video(); selectedSession = pinned;
    if (!selectedVideo || pinned !== sessionId()) { clear(); return false; }
    setFocus(true);
    removePanel = mountN5Focus(lesson, async () => {
      if (!valid()) throw new Error("The episode changed. Confirm the new video in N5 Course.");
      const response = await chrome.runtime.sendMessage({ type: "avc-n5-start-assessment" });
      if (!response?.ok) throw new Error(response?.error || "Practice could not open. Please retry.");
    }, () => { clear(); void chrome.runtime.sendMessage({ type: "avc-n5-detach" }).catch(() => {}); });
    return true;
  }
  function lessonFromMessage(msg: Incoming) {
    return parseN5PilotState({ apiVersion: 1, ownerId: "projection", context: msg.context, lesson: msg.lesson, watched: false, activeAttempts: [], completedAttempts: 0, mastery: false });
  }
  chrome.runtime.onMessage.addListener((msg: Incoming, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    if (msg.type === "avc-n5-unmount") { clear(); sendResponse({ ok: true }); return; }
    if (msg.type === "avc-n5-mount") {
      const state = lessonFromMessage(msg);
      sendResponse({ ok: !!state?.lesson && mount(state.lesson, sessionId()), sessionId: selectedSession }); return;
    }
    if (msg.type === "avc-n5-pause") {
      const current = video();
      if (!valid() || msg.sessionId !== selectedSession || !current) { clear(); sendResponse({ ok: false }); return; }
      current.pause(); sendResponse({ ok: current.paused }); return;
    }
  });
  // Reloads restore only the exact bound video identity. New episodes require confirmation.
  void chrome.runtime.sendMessage({ type: "avc-n5-session" }).then((state) => {
    if (!ended && !removePanel && state?.ok && typeof state.sessionId === "string") {
      const parsed = lessonFromMessage(state); if (parsed?.lesson) mount(parsed.lesson, state.sessionId);
    }
  }).catch(() => {});
  const timer = setInterval(() => {
    if (removePanel && !valid()) { clear(); void chrome.runtime.sendMessage({ type: "avc-n5-invalidated" }).catch(() => {}); }
  }, 400);
  window.addEventListener("pagehide", () => { ended = true; clearInterval(timer); clear(); }, { once: true });
}
