import { beforeEach, describe, expect, it, vi } from "vitest";
const env = vi.hoisted(() => ({ token: "avc_st_alice", direction: "en-ja", local: {} as Record<string, unknown>, session: {} as Record<string, unknown>, send: vi.fn(), create: vi.fn(), network: vi.fn() }));
vi.mock("../src/lib/storage", () => ({ getSyncToken: async () => env.token, getSettings: async () => ({ learningDirection: env.direction }) }));
import { handleN5 } from "../src/lib/n5-service";
const context = { courseId: "n5-foundations", trackId: "your-lie-in-april-2014", unitId: "unit-1", episodeId: "your-lie-in-april-2014-s1-e1", lessonId: "your-lie-in-april-s1-e1", contentVersion: "preview-1", script: "romaji" };
const snapshot = { apiVersion: 1, ownerId: "alice", context, lesson: { id: context.lessonId, contentVersion: "preview-1", script: "romaji", canDo: "Introduce yourself", vocabulary: [], grammar: [] }, watched: false, activeAttempts: [], completedAttempts: 0, mastery: false };
const own = { id: "extension", url: "chrome-extension://extension/course/course.html" };
const provider = { id: "extension", url: "https://www.youtube.com/watch?v=1", tab: { id: 7 }, frameId: 0 };
const clone = <T>(v: T): T => structuredClone(v);
const store = (area: "local" | "session") => ({ get: async (key: string) => ({ [key]: clone(env[area][key]) }), set: async (values: Record<string, unknown>) => Object.assign(env[area], clone(values)), remove: async (key: string) => { delete env[area][key]; } });
const stop = vi.fn(async () => {});
async function run(command: object, sender = own) { return await handleN5(command, sender, stop) as { ok: boolean; code?: string; pending?: number; state?: typeof snapshot; offline?: boolean; players?: number[] }; }
beforeEach(() => {
  env.token = "avc_st_alice"; env.direction = "en-ja"; env.local = {}; env.session = {}; stop.mockReset().mockResolvedValue(); env.create.mockReset().mockResolvedValue({ id: 9 });
  env.send.mockReset().mockImplementation(async (_id, message) => message.type === "avc-n5-mount" ? { ok: true, sessionId: "youtube:1" } : { ok: true });
  env.network.mockReset().mockImplementation(async (_url, init) => init.method === "POST" ? Response.json({ id: "event" }) : Response.json(snapshot));
  vi.stubGlobal("fetch", env.network);
  vi.stubGlobal("chrome", { runtime: { id: "extension", getURL: (path: string) => "chrome-extension://extension/" + path.replace(/^\//, "") }, storage: { local: store("local"), session: store("session") }, tabs: { get: async () => ({ id: 7, url: provider.url }), sendMessage: env.send, create: env.create }, scripting: { executeScript: async () => [{ frameId: 0, result: 10000 }] } });
});
describe("N5 background orchestration", () => {
  it("rejects provider auth/config access, forged fields and untrusted senders", async () => {
    for (const [command, sender] of [[{ type: "avc-n5-state" }, provider], [{ type: "avc-n5-enrol", script: "kana", userId: "bob" }, own], [{ type: "avc-n5-state" }, { ...own, id: "other" }], [{ type: "avc-n5-state" }, { ...own, url: "file:///course/course.html" }], [{ type: "avc-n5-state" }, { ...own, url: "chrome-extension://other/course/course.html" }]]) expect((await run(command, sender)).ok).toBe(false);
    expect(env.network).not.toHaveBeenCalled();
  });
  it("confirms course-only Japanese without changing general preferences or deck", async () => {
    env.direction = "ja-en";
    expect((await run({ type: "avc-n5-attach", tabId: 7 })).code).toBe("confirm_japanese");
    expect((await run({ type: "avc-n5-attach", tabId: 7, confirmJapanese: true })).players).toEqual([7]);
    expect(env.direction).toBe("ja-en"); expect(env.local.settings).toBeUndefined(); expect(env.local.vocab).toBeUndefined();
  });
  it("opens a fixed, secret-free practice route only after player and capture acknowledgements", async () => {
    expect((await run({ type: "avc-n5-attach", tabId: 7 })).ok).toBe(true);
    const result = await run({ type: "avc-n5-start-assessment" }, provider);
    expect(result.ok).toBe(true); expect(stop).toHaveBeenCalledWith(7);
    expect(env.create).toHaveBeenCalledWith({ url: "https://animevocab.com/app/n5/lessons/your-lie-in-april-s1-e1?script=romaji" });
    expect(env.send.mock.calls.findIndex(([, m]) => m.type === "avc-n5-pause")).toBeGreaterThanOrEqual(0);
    expect(env.local["n5Pilot:alice"]).toMatchObject({ queue: [], state: { watched: true } });
    expect(JSON.stringify(env.send.mock.calls)).not.toMatch(/avc_st_|ownerId|correctOption/);
  });
  it("does not open a tab or enqueue completion when capture or pause cannot be confirmed", async () => {
    await run({ type: "avc-n5-attach", tabId: 7 });
    stop.mockRejectedValueOnce(new Error("Capture did not stop"));
    expect((await run({ type: "avc-n5-start-assessment" }, provider)).ok).toBe(false);
    env.send.mockResolvedValueOnce({ ok: false });
    expect((await run({ type: "avc-n5-start-assessment" }, provider)).ok).toBe(false);
    expect(env.create).not.toHaveBeenCalled(); expect(env.local["n5Pilot:alice"]).toMatchObject({ queue: [] });
  });
  it("persists offline completion before handoff and replays the identical event after worker restart", async () => {
    await run({ type: "avc-n5-attach", tabId: 7 });
    env.network.mockRejectedValue(new TypeError("offline"));
    const result = await run({ type: "avc-n5-start-assessment" }, provider);
    expect(result).toMatchObject({ ok: true, offline: true, pending: 1 });
    const cached = clone(env.local["n5Pilot:alice"]) as { queue: { idempotencyKey: string }[] };
    expect(cached.queue).toHaveLength(1); expect(env.create).toHaveBeenCalledTimes(1);
    vi.resetModules();
    const { handleN5: restarted } = await import("../src/lib/n5-service");
    env.network.mockImplementation(async (_url, init) => init.method === "POST" ? Response.json({ id: "event" }) : Response.json(snapshot));
    expect(await restarted({ type: "avc-n5-state", refresh: true }, own, stop)).toMatchObject({ ok: true, pending: 0 });
    const call = env.network.mock.calls.find(([, init]) => init.method === "POST");
    expect(JSON.parse(call![1].body).idempotencyKey).toBe(cached.queue[0].idempotencyKey);
  });
  it("keeps another owner's outbox isolated across account changes", async () => {
    await run({ type: "avc-n5-attach", tabId: 7 }); env.network.mockRejectedValue(new TypeError("offline"));
    await run({ type: "avc-n5-start-assessment" }, provider);
    env.token = "avc_st_bob"; env.network.mockImplementation(async () => Response.json({ ...snapshot, ownerId: "bob" }));
    const result = await run({ type: "avc-n5-state", refresh: true });
    expect(result.state?.ownerId).toBe("bob"); expect(result.pending).toBe(0); expect(result.players).toEqual([]);
    expect(env.local["n5Pilot:alice"]).toMatchObject({ queue: [expect.anything()] });
    expect(env.network.mock.calls.filter(([, init]) => init.headers.Authorization === "Bearer avc_st_bob" && init.method === "POST")).toEqual([]);
  });
  it("does not turn a disabled pilot into cached offline success", async () => {
    await run({ type: "avc-n5-attach", tabId: 7 });
    env.network.mockResolvedValue(Response.json({ error: {} }, { status: 404 }));
    expect(await run({ type: "avc-n5-state", refresh: true })).toMatchObject({ ok: false, code: "unavailable" });
    expect(env.session.n5PilotBindings).toEqual({});
    env.network.mockRejectedValue(new TypeError("offline"));
    expect((await run({ type: "avc-n5-attach", tabId: 7 })).ok).toBe(false);
    expect(env.local["n5Pilot:alice"]).toBeDefined();
  });
  it.each([401,404])("invalidates offline authorization when enrolment is denied with %s after a successful snapshot", async status => {
    await run({type:"avc-n5-attach",tabId:7});
    env.network.mockImplementation(async (_url,init) => init.method === "POST" ? Response.json({}, {status}) : Response.json(snapshot));
    expect((await run({type:"avc-n5-enrol",script:"kana"})).ok).toBe(false);
    expect(env.session.n5PilotBindings).toEqual({});
    expect(env.local["n5Pilot:alice"]).toBeDefined();
    env.network.mockRejectedValue(new TypeError("offline"));
    expect((await run({type:"avc-n5-attach",tabId:7})).ok).toBe(false);
  });
  it("rejects an account switch while a server response is in flight", async () => {
    env.network.mockImplementationOnce(async () => { env.token = "avc_st_bob"; return Response.json(snapshot); });
    expect(await run({ type: "avc-n5-state", refresh: true })).toMatchObject({ ok: false, code: "account_changed" });
    expect(env.local).toEqual({});
  });
});
