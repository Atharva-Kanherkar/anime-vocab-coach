import { beforeEach, describe, expect, it, vi } from "vitest";
const env = vi.hoisted(() => ({ token: "avc_st_alice" as string | null, local: {} as Record<string, unknown>, create: vi.fn(), network: vi.fn() }));
vi.mock("../src/lib/storage", () => ({ getSyncToken: async () => env.token }));
import { handleN5, invalidateN5, retryPendingN5 } from "../src/lib/n5-service";

const LESSON = "your-lie-in-april-u01";
const EPISODE = "your-lie-in-april-2014-s1-e01";
const words = [
  { id: "tomodachi", reading: "tomodachi", meaning: "friend", kana: "ともだち" },
  { id: "piano", reading: "piano", meaning: "piano", kana: "ピアノ" },
];
const snapshot = (heard: string[] = []) => ({
  apiVersion: 1, ownerId: "alice",
  context: { courseId: "n5-foundations", trackId: "your-lie-in-april-2014", unitId: "unit-1", episodeId: EPISODE, lessonId: LESSON, contentVersion: "course-1", script: "romaji" },
  lesson: { id: LESSON, contentVersion: "course-1", script: "romaji", canDo: "Greet someone new.", unit: 1, title: "Greet", episode: { number: 1, title: "Monotone/Colorful" }, vocabulary: words, grammar: [], heard },
  watched: false, activeAttempts: [], completedAttempts: 0, mastery: false,
});
const tab = { id: "extension", url: "https://www.netflix.com/watch/1", tab: { id: 7 } } as chrome.runtime.MessageSender;
const popup = { id: "extension", url: "chrome-extension://extension/popup/popup.html" } as chrome.runtime.MessageSender;
const app = { id: "extension", url: "https://animevocab.com/app/n5", tab: { id: 3 } } as chrome.runtime.MessageSender;
const clone = <T>(v: T): T => structuredClone(v);
const stop = vi.fn(async () => {});
type Reply = { ok: boolean; error?: string; lesson?: { id: string; heard: string[]; words: unknown[] } | null };
const run = async (message: object, sender = tab) => (await handleN5(message, sender, stop)) as Reply;
const posts = (path: string) => env.network.mock.calls.filter(([url, init]) => String(url).endsWith(path) && init.method === "POST").map(([, init]) => JSON.parse(init.body));
const settle = () => new Promise((r) => setTimeout(r, 0));

let serverHeard: string[] = [];
beforeEach(() => {
  env.token = "avc_st_alice"; env.local = {}; serverHeard = [];
  stop.mockReset().mockResolvedValue(undefined);
  env.create.mockReset().mockResolvedValue({ id: 9 });
  env.network.mockReset().mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith("/extension/state")) return Response.json(snapshot(serverHeard));
    if (url.endsWith("/heard")) {
      serverHeard = [...new Set([...serverHeard, ...JSON.parse(String(init.body)).wordIds])];
      return Response.json({ lessonId: LESSON, heard: serverHeard });
    }
    return Response.json({ id: "event" });
  });
  vi.stubGlobal("fetch", env.network);
  vi.stubGlobal("chrome", {
    runtime: { id: "extension" },
    storage: { local: {
      get: async (key: string) => ({ [key]: clone(env.local[key]) }),
      set: async (values: Record<string, unknown>) => Object.assign(env.local, clone(values)),
      remove: async (key: string) => { delete env.local[key]; },
    } },
    tabs: { create: env.create },
  });
});

describe("N5 course for Listening Mode", () => {
  it("gives the linked account's lesson to content scripts and the popup, and caches it", async () => {
    const first = await run({ type: "avc-n5-lesson" });
    expect(first.lesson).toMatchObject({ id: LESSON, unit: 1, script: "romaji", episode: { number: 1 } });
    expect(first.lesson?.words).toEqual(words);
    expect((await run({ type: "avc-n5-lesson" }, popup)).lesson?.id).toBe(LESSON);
    expect(env.network).toHaveBeenCalledTimes(1);
    await run({ type: "avc-n5-lesson", refresh: true });
    expect(env.network).toHaveBeenCalledTimes(2);
  });

  it("has no lesson without an account, without course access, or for another extension", async () => {
    env.token = null;
    expect((await run({ type: "avc-n5-lesson" })).lesson).toBeNull();
    env.token = "avc_st_alice";
    env.network.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect((await run({ type: "avc-n5-lesson" })).lesson).toBeNull();
    expect(env.network).toHaveBeenCalledTimes(1);
    expect((await run({ type: "avc-n5-lesson" }, { ...tab, id: "other" })).ok).toBe(false);
  });

  it("keeps the last lesson through a network blip, but never another account's", async () => {
    await run({ type: "avc-n5-lesson" });
    env.network.mockRejectedValueOnce(new TypeError("offline"));
    expect((await run({ type: "avc-n5-lesson", refresh: true })).lesson?.id).toBe(LESSON);
    env.token = "avc_st_bob";
    env.network.mockRejectedValueOnce(new TypeError("offline"));
    expect((await run({ type: "avc-n5-lesson" })).lesson).toBeNull();
    await invalidateN5();
    expect(env.local.n5Listen).toBeUndefined();
  });

  it("saves heard lesson words to the account, once each, and only lesson words", async () => {
    await run({ type: "avc-n5-lesson" });
    expect((await run({ type: "avc-n5-heard", lessonId: LESSON, wordIds: ["tomodachi", "not-a-word"] })).lesson?.heard).toEqual(["tomodachi"]);
    await settle(); await settle();
    expect(posts("/heard")).toEqual([{ lessonId: LESSON, wordIds: ["tomodachi"] }]);
    await run({ type: "avc-n5-heard", lessonId: LESSON, wordIds: ["tomodachi"] });
    await settle();
    expect(posts("/heard")).toHaveLength(1);
    expect((await run({ type: "avc-n5-heard", lessonId: "other-lesson", wordIds: ["piano"] })).ok).toBe(false);
    expect((await run({ type: "avc-n5-lesson" })).lesson?.heard).toEqual(["tomodachi"]);
  });

  it("holds heard words offline and sends them later, never with another account's token", async () => {
    await run({ type: "avc-n5-lesson" });
    env.network.mockRejectedValueOnce(new TypeError("offline"));
    expect((await run({ type: "avc-n5-heard", lessonId: LESSON, wordIds: ["piano"] })).lesson?.heard).toEqual(["piano"]);
    await settle(); await settle();
    expect(serverHeard).toEqual([]);
    expect((await run({ type: "avc-n5-lesson" })).lesson?.heard).toEqual(["piano"]);
    env.token = "avc_st_bob";
    await retryPendingN5();
    expect(serverHeard).toEqual([]);
    env.token = "avc_st_alice";
    await retryPendingN5();
    expect(serverHeard).toEqual(["piano"]);
    const auth = env.network.mock.calls.filter(([url]) => String(url).endsWith("/heard")).map(([, init]) => init.headers.Authorization);
    expect(new Set(auth)).toEqual(new Set(["Bearer avc_st_alice"]));
  });

  it("finishes the episode: stops listening on the tab, records it, then opens practice on animevocab.com", async () => {
    await run({ type: "avc-n5-lesson" });
    const order: string[] = [];
    stop.mockImplementation(async () => { order.push("stop"); });
    env.create.mockImplementation(async () => { order.push("open"); return { id: 9 }; });
    expect((await run({ type: "avc-n5-finish" })).ok).toBe(true);
    expect(stop).toHaveBeenCalledWith(7);
    expect(posts("/events")).toEqual([{ episodeId: EPISODE, kind: "watch_complete", idempotencyKey: expect.any(String) }]);
    expect(order).toEqual(["stop", "open"]);
    expect(env.create).toHaveBeenCalledWith({ url: `https://animevocab.com/app/n5/lessons/${LESSON}?script=romaji#practice` });
    expect((await run({ type: "avc-n5-finish" }, popup)).ok).toBe(false);
  });

  it("keeps a finished episode durable when the network fails, and replays the same receipt", async () => {
    await run({ type: "avc-n5-lesson" });
    env.network.mockRejectedValueOnce(new TypeError("offline"));
    expect((await run({ type: "avc-n5-finish" })).ok).toBe(true);
    expect(env.create).toHaveBeenCalledOnce();
    const pending = (env.local.n5ListenOutbox as { watched: { idempotencyKey: string }[] }).watched;
    expect(pending).toHaveLength(1);
    await retryPendingN5();
    // The failed try and the retry carry the same receipt, so the server records one.
    expect(posts("/events")).toEqual(Array(2).fill({ episodeId: EPISODE, kind: "watch_complete", idempotencyKey: pending[0].idempotencyKey }));
    expect((env.local.n5ListenOutbox as { watched: unknown[] }).watched).toEqual([]);
  });

  it("refreshes when the course changes on animevocab.com, and from nowhere else on the web", async () => {
    await run({ type: "avc-n5-lesson" });
    serverHeard = ["piano"];
    expect((await run({ type: "avc-n5-refresh" }, app)).lesson?.heard).toEqual(["piano"]);
    expect((await run({ type: "avc-n5-refresh" }, { ...app, url: "https://evil.example/app/n5" })).ok).toBe(false);
    expect((await run({ type: "avc-n5-refresh" }, tab)).ok).toBe(false);
  });
});
