/**
 * The N5 course, as Listening Mode sees it (background side).
 *
 * animevocab.com is the source of truth: the lesson comes from the course API
 * for the linked account, and everything the extension learns while listening
 * (lesson words heard, an episode finished) goes back to it. What is kept here
 * is a short-lived copy of the lesson and an outbox that survives the service
 * worker going to sleep or the network dropping.
 */
import { BACKEND_URL } from "../config";
import { getSyncToken } from "./storage";
import { courseLessonFromState, lessonUrl, type CourseLesson } from "./course-listening";

const CACHE_KEY = "n5Listen";
const OUTBOX_KEY = "n5ListenOutbox";
/** Long enough not to ask on every video, short enough to follow the website. */
const FRESH_MS = 10 * 60_000;
const ID = /^[a-z0-9][a-z0-9-]{0,127}$/;

interface Cache {
  tokenHash: string;
  lesson: CourseLesson | null;
  episodeId: string | null;
  fetchedAt: number;
}
interface Outbox {
  tokenHash: string;
  heard: Record<string, string[]>;
  watched: { episodeId: string; idempotencyKey: string }[];
}
class CourseError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

let tail: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = tail.then(fn, fn);
  tail = next.catch(() => {});
  return next;
}

async function identity(): Promise<{ token: string; tokenHash: string } | null> {
  const token = await getSyncToken();
  if (!token) return null;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return { token, tokenHash: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("") };
}

async function request(token: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(BACKEND_URL + "/v1/n5" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: "Bearer " + token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) throw new CourseError(response.status, `course_${response.status}`);
  const raw = await response.text();
  if (raw.length > 65_536) throw new CourseError(502, "course_too_large");
  return JSON.parse(raw);
}

async function readCache(): Promise<Cache | null> {
  const raw = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] as Cache | undefined;
  return raw && typeof raw.tokenHash === "string" ? raw : null;
}

async function readOutbox(tokenHash: string): Promise<Outbox> {
  const raw = (await chrome.storage.local.get(OUTBOX_KEY))[OUTBOX_KEY] as Outbox | undefined;
  // Another account's pending work is never sent with this one's token.
  if (!raw || raw.tokenHash !== tokenHash) return { tokenHash, heard: {}, watched: [] };
  return { tokenHash, heard: raw.heard || {}, watched: Array.isArray(raw.watched) ? raw.watched : [] };
}

async function writeOutbox(outbox: Outbox): Promise<void> {
  await chrome.storage.local.set({ [OUTBOX_KEY]: outbox });
}

function withPending(lesson: CourseLesson | null, outbox: Outbox): CourseLesson | null {
  if (!lesson) return null;
  const pending = outbox.heard[lesson.id] || [];
  return { ...lesson, heard: [...new Set([...lesson.heard, ...pending])] };
}

/** Send what the outbox holds. A rejected item is dropped (retrying cannot
 * fix it); a network failure keeps it for the next try. */
async function flush(token: string, tokenHash: string): Promise<void> {
  const outbox = await readOutbox(tokenHash);
  for (const [lessonId, wordIds] of Object.entries(outbox.heard)) {
    try {
      const saved = (await request(token, "/heard", { lessonId, wordIds: wordIds.slice(0, 20) })) as { heard?: unknown };
      delete outbox.heard[lessonId];
      const cache = await readCache();
      if (cache?.tokenHash === tokenHash && cache.lesson?.id === lessonId && Array.isArray(saved?.heard)) {
        const ids = new Set(cache.lesson.words.map((w) => w.id));
        cache.lesson.heard = saved.heard.filter((id): id is string => typeof id === "string" && ids.has(id));
        await chrome.storage.local.set({ [CACHE_KEY]: cache });
      }
    } catch (error) {
      if (error instanceof CourseError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429) delete outbox.heard[lessonId];
      else break;
    }
    await writeOutbox(outbox);
  }
  for (const event of [...outbox.watched]) {
    try {
      await request(token, "/events", { episodeId: event.episodeId, kind: "watch_complete", idempotencyKey: event.idempotencyKey });
    } catch (error) {
      if (!(error instanceof CourseError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429)) break;
    }
    outbox.watched = outbox.watched.filter((e) => e.idempotencyKey !== event.idempotencyKey);
    await writeOutbox(outbox);
  }
}

/** The lesson Listening follows for the linked account, or null when there
 * is none (not signed in, not enrolled, no course access). */
async function lesson(refresh: boolean): Promise<{ lesson: CourseLesson | null; cache: Cache | null }> {
  const who = await identity();
  if (!who) return { lesson: null, cache: null };
  const cached = await readCache();
  const mine = cached?.tokenHash === who.tokenHash ? cached : null;
  if (mine && !refresh && Date.now() - mine.fetchedAt < FRESH_MS) {
    return { lesson: withPending(mine.lesson, await readOutbox(who.tokenHash)), cache: mine };
  }
  let next: Cache;
  try {
    const state = await request(who.token, "/extension/state");
    const context = (state as { context?: { episodeId?: unknown } } | null)?.context;
    next = {
      tokenHash: who.tokenHash,
      lesson: courseLessonFromState(state),
      episodeId: typeof context?.episodeId === "string" && ID.test(context.episodeId) ? context.episodeId : null,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    // No access or no account is an answer; anything else is a blip, and the
    // last known lesson is better than none while it lasts.
    if (!(error instanceof CourseError && (error.status === 401 || error.status === 404))) {
      return { lesson: withPending(mine?.lesson ?? null, await readOutbox(who.tokenHash)), cache: mine };
    }
    next = { tokenHash: who.tokenHash, lesson: null, episodeId: null, fetchedAt: Date.now() };
  }
  if ((await getSyncToken()) !== who.token) return { lesson: null, cache: null };
  await chrome.storage.local.set({ [CACHE_KEY]: next });
  return { lesson: withPending(next.lesson, await readOutbox(who.tokenHash)), cache: next };
}

interface N5Message {
  type?: unknown;
  refresh?: unknown;
  lessonId?: unknown;
  wordIds?: unknown;
}

const APP_ORIGINS = ["https://animevocab.com", "https://www.animevocab.com"];

/**
 * Course messages:
 * - avc-n5-lesson   the lesson to follow (content scripts, popup)
 * - avc-n5-heard    lesson words just heard (content scripts)
 * - avc-n5-finish   finish the episode: stop listening, record it, open practice
 * - avc-n5-refresh  the course changed on animevocab.com
 */
export function handleN5(
  raw: unknown,
  sender: chrome.runtime.MessageSender,
  stopCapture: (tabId: number) => Promise<void>
): Promise<unknown> {
  return serial(async () => {
    try {
      if (sender.id !== chrome.runtime.id) return { ok: false, error: "forbidden" };
      const msg = (raw && typeof raw === "object" ? raw : {}) as N5Message;
      if (msg.type === "avc-n5-refresh") {
        const fromApp = !!sender.url && APP_ORIGINS.includes(new URL(sender.url).origin);
        const fromExtension = !!sender.url && sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`);
        if (!fromApp && !fromExtension) return { ok: false, error: "forbidden" };
        const { lesson: next } = await lesson(true);
        return { ok: true, lesson: next };
      }
      if (msg.type === "avc-n5-lesson") {
        const { lesson: next } = await lesson(msg.refresh === true);
        return { ok: true, lesson: next };
      }
      if (msg.type === "avc-n5-heard") {
        const who = await identity();
        const { lesson: current } = await lesson(false);
        if (!who || !current || msg.lessonId !== current.id || !Array.isArray(msg.wordIds)) return { ok: false, error: "no_lesson" };
        const known = new Set(current.words.map((w) => w.id));
        const fresh = msg.wordIds.filter((id): id is string => typeof id === "string" && known.has(id) && !current.heard.includes(id));
        if (!fresh.length) return { ok: true, lesson: current };
        const outbox = await readOutbox(who.tokenHash);
        outbox.heard[current.id] = [...new Set([...(outbox.heard[current.id] || []), ...fresh])].slice(0, 20);
        await writeOutbox(outbox);
        // Queued behind this handler, not awaited: the line's moment should not wait on the network.
        void serial(() => flush(who.token, who.tokenHash)).catch(() => {});
        return { ok: true, lesson: withPending(current, outbox) };
      }
      if (msg.type === "avc-n5-finish") {
        const tabId = sender.tab?.id;
        const who = await identity();
        const { lesson: current, cache } = await lesson(false);
        if (tabId === undefined || !who || !current || !cache?.episodeId) return { ok: false, error: "There is no course episode to finish." };
        await stopCapture(tabId);
        const outbox = await readOutbox(who.tokenHash);
        if (!outbox.watched.some((e) => e.episodeId === cache.episodeId)) {
          outbox.watched.push({ episodeId: cache.episodeId, idempotencyKey: crypto.randomUUID() });
          await writeOutbox(outbox); // durable before the network or the tab handoff
        }
        await flush(who.token, who.tokenHash).catch(() => {});
        await chrome.tabs.create({ url: lessonUrl(current, "practice") });
        return { ok: true };
      }
      return { ok: false, error: "unknown_message" };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Course connection is unavailable." };
    }
  });
}

/** A different account: forget the old one's lesson. Its outbox stays keyed
 * to its token and is never sent with another. */
export async function invalidateN5(): Promise<void> {
  await chrome.storage.local.remove(CACHE_KEY);
}

/** Retry pending heard words and finished episodes (on the sync alarm). */
export async function retryPendingN5(): Promise<void> {
  try {
    const who = await identity();
    if (who) await serial(() => flush(who.token, who.tokenHash));
  } catch { /* stays in the outbox */ }
}
