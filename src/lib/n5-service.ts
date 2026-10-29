import { BACKEND_URL } from "../config";
import { getSyncToken, getSettings } from "./storage";
import { parseN5Command, parseN5PilotState, queueObservation, isStreamingUrl, hostedPracticeUrl, type PilotState, type WatchEvent, type PilotCommand } from "./n5-pilot";
interface Cache { tokenHash: string; state: PilotState; queue: WatchEvent[] }
interface Binding { ownerId: string; tokenHash: string; tabId: number; frameId: number; url: string; sessionId: string; context: NonNullable<PilotState["context"]>; lesson: NonNullable<PilotState["lesson"]> }
class PilotError extends Error { constructor(readonly code: string, message: string) { super(message); } }
const pointerKey = "n5PilotOwner";
const cacheKey = (owner: string) => `n5Pilot:${owner}`;
const bindingsKey = "n5PilotBindings";
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> { const next = tail.then(fn, fn); tail = next.catch(() => {}); return next; }
export async function bounded<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PilotError("timeout", "The player did not respond. Retry from the video tab.")), ms); })]); }
  finally { clearTimeout(timer!); }
}
async function identity() {
  const token = await getSyncToken();
  if (!token) throw new PilotError("not_linked", "Connect your AnimeVocab account first.");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return { token, tokenHash: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("") };
}
async function unchanged(token: string) { if (await getSyncToken() !== token) throw new PilotError("account_changed", "Your account changed. Reload the course."); }
async function request(token: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(BACKEND_URL + "/v1/n5" + path, { method: body === undefined ? "GET" : "POST", headers: { Authorization: "Bearer " + token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error" });
  await unchanged(token);
  if (!response.ok) {
    const code = response.status === 401 ? "not_linked" : response.status === 404 ? "unavailable" : response.status === 409 ? "stale_content" : "retry_needed";
    throw new PilotError(code, code === "unavailable" ? "N5 preview is unavailable for this account. Ordinary watching still works." : code === "not_linked" ? "Reconnect your AnimeVocab account." : "Course sync could not finish. Pending observations are kept; retry later.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new PilotError("invalid_response", "Course response was empty.");
  let raw = "", size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new PilotError("invalid_response", "Course response is too large."); }
      raw += decoder.decode(next.value, { stream: true });
    }
    return JSON.parse(raw + decoder.decode());
  } finally { reader.releaseLock(); }
}
async function cached(tokenHash: string): Promise<Cache | null> {
  const pointer = (await chrome.storage.local.get(pointerKey))[pointerKey] as { ownerId?: string; tokenHash?: string } | undefined;
  if (!pointer || pointer.tokenHash !== tokenHash || typeof pointer.ownerId !== "string") return null;
  const stored = (await chrome.storage.local.get(cacheKey(pointer.ownerId)))[cacheKey(pointer.ownerId)] as Cache | undefined;
  if (!stored || stored.tokenHash !== tokenHash) return null;
  const state = parseN5PilotState(stored.state);
  if (!state || state.ownerId !== pointer.ownerId || !Array.isArray(stored.queue) || stored.queue.length > 100) return null;
  try { let queue: WatchEvent[] = []; for (const event of stored.queue) queue = queueObservation(queue, event); return { tokenHash, state, queue }; } catch { return null; }
}
async function save(cache: Cache, token: string) {
  await unchanged(token);
  await chrome.storage.local.set({ [cacheKey(cache.state.ownerId)]: cache, [pointerKey]: { ownerId: cache.state.ownerId, tokenHash: cache.tokenHash } });
  await unchanged(token);
}
async function fresh(token: string, tokenHash: string): Promise<Cache> {
  const state = parseN5PilotState(await request(token, "/extension/state"));
  if (!state) throw new PilotError("invalid_response", "Course content did not match the expected script or version.");
  const old = (await chrome.storage.local.get(cacheKey(state.ownerId)))[cacheKey(state.ownerId)] as Cache | undefined;
  let queue: WatchEvent[] = [];
  // Re-linking the same verified owner may recover its pending outbox. A new
  // owner can never inherit the previous owner's pending events.
  try { if (old && Array.isArray(old.queue)) for (const event of old.queue) queue = queueObservation(queue, event); }
  catch { throw new PilotError("invalid_queue", "Pending observations need recovery. Nothing has been deleted."); }
  const cache = { tokenHash, state, queue }; await save(cache, token); return cache;
}
async function flush(cache: Cache, token: string) {
  for (const event of [...cache.queue].slice(0, 10)) {
    if (event.contentVersion !== cache.state.context?.contentVersion) throw new PilotError("stale_content", "A pending observation uses retired content. It is kept for recovery.");
    await request(token, "/events", { episodeId: event.episodeId, kind: "watch_complete", idempotencyKey: event.idempotencyKey });
    await unchanged(token);
    cache.queue = cache.queue.filter(e => e.idempotencyKey !== event.idempotencyKey);
    cache.state.watched = true;
    await save(cache, token);
  }
}
async function bindings(): Promise<Record<string, Binding>> {
  const raw = (await chrome.storage.session.get(bindingsKey))[bindingsKey];
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, Binding> : {};
}
async function forget(tabId?: number) {
  const all = await bindings();
  const selected = tabId === undefined ? Object.values(all) : all[tabId] ? [all[tabId]] : [];
  for (const b of selected) {
    delete all[b.tabId];
    await chrome.tabs.sendMessage(b.tabId, { type: "avc-n5-unmount" }, { frameId: b.frameId }).catch(() => {});
  }
  await chrome.storage.session.set({ [bindingsKey]: all });
}
export function invalidateN5(tabId?: number): Promise<void> { return serial(() => forget(tabId)); }
function ownedSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || !sender.url) return false;
  try { const u = new URL(sender.url); return u.protocol === "chrome-extension:" && u.host === chrome.runtime.id && ["/course/course.html", "/popup/popup.html"].includes(u.pathname); } catch { return false; }
}
function appSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || !sender.url) return false;
  try { return ["https://animevocab.com", "https://www.animevocab.com"].includes(new URL(sender.url).origin); } catch { return false; }
}
async function boundPlayer(command: PilotCommand, sender: chrome.runtime.MessageSender, tokenHash: string): Promise<Binding> {
  const tabId = ownedSender(sender) ? command.tabId : sender.tab?.id;
  const b = tabId === undefined ? undefined : (await bindings())[tabId];
  if (!b || b.tokenHash !== tokenHash || (!ownedSender(sender) && (sender.frameId !== b.frameId || !sender.url || !isStreamingUrl(sender.url)))) throw new PilotError("player_changed", "Confirm the current video in N5 Course before continuing.");
  const tab = await chrome.tabs.get(b.tabId);
  if (tab.url !== b.url) { await forget(b.tabId); throw new PilotError("player_changed", "The episode changed. Confirm the new video first."); }
  return b;
}
export function handleN5(raw: unknown, sender: chrome.runtime.MessageSender, stopCapture: (tabId: number) => Promise<void>): Promise<unknown> {
  return serial(async () => {
    try {
      if (sender.id !== chrome.runtime.id) throw new PilotError("forbidden", "Invalid course sender.");
      const command = parseN5Command(raw);
      if (!command) throw new PilotError("invalid_message", "Invalid course action.");
      const own = ownedSender(sender);
      const playerAction = ["avc-n5-watch", "avc-n5-start-assessment", "avc-n5-detach", "avc-n5-session", "avc-n5-invalidated"];
      if (!own && command.tabId !== undefined) throw new PilotError("forbidden", "Player actions use the sending tab only.");
      if (!own && !(command.type === "avc-n5-refresh" && appSender(sender)) && !(playerAction.includes(command.type) && sender.tab?.id !== undefined && sender.url && isStreamingUrl(sender.url))) throw new PilotError("forbidden", "This course action is unavailable here.");
      if (command.type === "avc-n5-invalidated") { const b = (await bindings())[sender.tab!.id!]; if (b?.frameId === sender.frameId) await forget(b.tabId); return { ok: true }; }
      const { token, tokenHash } = await identity();
      if (command.type === "avc-n5-session") {
        const b = await boundPlayer(command, sender, tokenHash);
        return { ok: true, lesson: b.lesson, context: b.context, sessionId: b.sessionId };
      }
      if (command.type === "avc-n5-detach") {
        const b = await boundPlayer(command, sender, tokenHash); await forget(b.tabId); return { ok: true };
      }
      let cache = await cached(tokenHash);
      let offline = false, warning: string | undefined;
      if (!cache || command.refresh || command.type === "avc-n5-refresh" || ["avc-n5-enrol", "avc-n5-attach", "avc-n5-watch", "avc-n5-start-assessment"].includes(command.type)) {
        try { cache = await fresh(token, tokenHash); }
        catch (error) {
          if (error instanceof PilotError) { if (["unavailable", "not_linked"].includes(error.code)) { await chrome.storage.local.remove(pointerKey); await forget(); } throw error; }
          if (!cache || command.type === "avc-n5-enrol") throw error;
          offline = true;
        }
      }
      if (!cache) throw new PilotError("offline", "Connect once to load your course, then retry.");
      if (command.type === "avc-n5-enrol") {
        await request(token, "/enrolments", { trackId: "your-lie-in-april-2014", script: command.script, idempotencyKey: crypto.randomUUID() });
        cache = await fresh(token, tokenHash);
        await forget();
      }
      if (command.type === "avc-n5-attach") {
        if (!cache.state.context || !cache.state.lesson) throw new PilotError("choose_script", "Choose your course script first.");
        if ((await getSettings()).learningDirection === "ja-en" && !command.confirmJapanese) throw new PilotError("confirm_japanese", "Confirm Japanese for course focus. Your English deck and settings will be preserved.");
        const tab = await chrome.tabs.get(command.tabId!);
        if (!tab.url || !isStreamingUrl(tab.url)) throw new PilotError("unsupported_player", "Open a YouTube, Netflix or Crunchyroll video, then confirm it here.");
        const frames = await chrome.scripting.executeScript({ target: { tabId: command.tabId!, allFrames: true }, func: () => { const v = document.querySelector("video"); return v ? v.clientWidth * v.clientHeight : 0; } });
        const player = frames.filter(f => (f.result || 0) > 0).sort((a, b) => (b.result || 0) - (a.result || 0))[0];
        if (!player) throw new PilotError("missing_player", "Wait for the player to load, then retry.");
        await unchanged(token);
        const ack = await bounded(chrome.tabs.sendMessage(command.tabId!, { type: "avc-n5-mount", context: cache.state.context, lesson: cache.state.lesson }, { frameId: player.frameId })) as { ok?: boolean; sessionId?: string };
        if (!ack?.ok || typeof ack.sessionId !== "string") throw new PilotError("missing_player", "Reload the player tab to load N5 Course.");
        await unchanged(token);
        const all = await bindings();
        all[command.tabId!] = { ownerId: cache.state.ownerId, tokenHash, tabId: command.tabId!, frameId: player.frameId, url: tab.url, sessionId: ack.sessionId, context: cache.state.context, lesson: cache.state.lesson };
        await chrome.storage.session.set({ [bindingsKey]: all });
      }
      if (command.type === "avc-n5-watch" || command.type === "avc-n5-start-assessment") {
        const b = await boundPlayer(command, sender, tokenHash);
        if (b.ownerId !== cache.state.ownerId || b.context.contentVersion !== cache.state.context?.contentVersion || b.context.script !== cache.state.context?.script) throw new PilotError("stale_content", "Your course changed. Reload and confirm the lesson again.");
        const ack = await bounded(chrome.tabs.sendMessage(b.tabId, { type: "avc-n5-pause", sessionId: b.sessionId }, { frameId: b.frameId })) as { ok?: boolean };
        if (!ack?.ok) throw new PilotError("player_changed", "The current video could not be paused. Confirm it again.");
        try { await stopCapture(b.tabId); }
        catch { throw new PilotError("capture_stop", "Audio capture could not be stopped. Stop Listening Mode and retry."); }
        await unchanged(token);
        cache.queue = queueObservation(cache.queue, { episodeId: b.context.episodeId, contentVersion: b.context.contentVersion, idempotencyKey: crypto.randomUUID(), observedAt: Date.now() });
        await save(cache, token); // Durable before any network delivery or tab handoff.
        if (command.type === "avc-n5-start-assessment") await chrome.tabs.create({ url: hostedPracticeUrl(b.context) });
      }
      for (const b of Object.values(await bindings())) {
        if (b.tokenHash === tokenHash && (b.context.script !== cache.state.context?.script || b.context.contentVersion !== cache.state.context?.contentVersion)) await forget(b.tabId);
      }
      if (!offline) {
        try { await flush(cache, token); }
        catch (error) {
          if (error instanceof PilotError && ["not_linked", "account_changed", "unavailable"].includes(error.code)) { await chrome.storage.local.remove(pointerKey); await forget(); throw error; }
          warning = error instanceof Error ? error.message : "Pending observations are kept.";
          offline = true;
        }
      }
      await unchanged(token);
      return { ok: true, state: cache.state, pending: cache.queue.length, offline, warning, players: Object.values(await bindings()).filter(b => b.tokenHash === tokenHash).map(b => b.tabId) };
    } catch (error) {
      return { ok: false, code: error instanceof PilotError ? error.code : "offline", error: error instanceof PilotError ? error.message : "Course connection is unavailable. Saved observations are kept; retry when online." };
    }
  });
}

/** Retry only durable pending work; ordinary watching does not poll course APIs. */
export async function retryPendingN5(): Promise<void> {
  try {
    const who = await identity();
    const cache = await cached(who.tokenHash);
    if (cache?.queue.length) await handleN5({ type: "avc-n5-state", refresh: true }, { id: chrome.runtime.id, url: chrome.runtime.getURL("course/course.html") }, async () => {});
  } catch { /* pending work remains durable until the account is reconnected */ }
}
