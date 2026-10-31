import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushSnapshot, syncPendingSignouts } from "../src/lib/cloud-sync";
import { clearSignedOutCache, setSyncToken, setSettings } from "../src/lib/storage";
import { normalizeAnimeVocabExport } from "../web/src/lib/sync";
import type { VocabMap } from "../src/types";

/**
 * The sync round against a scripted server: what it reads, what it applies,
 * and what it sends back. In-memory chrome.storage, real storage.ts.
 */
const local: Record<string, unknown> = {};
const HOUR = 3600e3;
const T0 = Date.parse("2026-09-25T10:00:00Z");

type Call = { method: string; body?: Record<string, unknown> };
let calls: Call[] = [];

function learningWord(stage: number) {
  return {
    state: "learning" as const, reading: "たべる", gloss: "to eat", level: 2, freqRank: 300,
    seenCount: 1, shownCount: 1, firstSeenAt: T0 - 48 * HOUR, lastSeenAt: T0 - 24 * HOUR,
    srs: { stage, dueAt: T0 - HOUR, lapses: 0 },
  };
}

function stubServer(script: { get: () => unknown; put: (body: Record<string, unknown>) => { status: number; body: unknown } }) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method || "GET";
    if (!String(url).includes("/api/sync/snapshot")) return new Response(null, { status: 204 });
    if (method === "GET") {
      calls.push({ method });
      return new Response(JSON.stringify(script.get()), { status: 200 });
    }
    const body = JSON.parse(String(init?.body));
    calls.push({ method, body });
    const out = script.put(body);
    return new Response(JSON.stringify(out.body), { status: out.status });
  }));
}

beforeEach(() => {
  for (const key of Object.keys(local)) delete local[key];
  calls = [];
  local.syncToken = "tok";
  vi.stubGlobal("chrome", {
    runtime: { id: "test", sendMessage: vi.fn(async () => undefined) },
    tabs: { query: vi.fn(async () => []), sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: {
        // Both call shapes: storage.ts uses the promise form and exportAll the
        // callback form.
        get: vi.fn((keys: string[] | string, cb?: (r: Record<string, unknown>) => void) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = Object.fromEntries(list.map((k) => [k, structuredClone(local[k])]).filter(([, v]) => v !== undefined));
          if (cb) { cb(out); return undefined; }
          return Promise.resolve(out);
        }),
        set: vi.fn((value: Record<string, unknown>, cb?: () => void) => {
          Object.assign(local, structuredClone(value));
          if (cb) { cb(); return undefined; }
          return Promise.resolve();
        }),
      },
    },
  });
});

describe("cloud sync round", () => {
  it("backs up unsynced words and preserves the device key at sign-out, retrying with the outgoing token", async () => {
    local.vocab = { 犬: learningWord(3) };
    local.settings = { openaiKey: "device-only-key", cooldownSec: 7 };
    await clearSignedOutCache();
    expect(local.syncToken).toBe("");
    expect(local.vocab).toEqual({});
    expect(local.settings).toEqual({ openaiKey: "device-only-key" });
    const pending = structuredClone(local.pendingSignoutExports);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await syncPendingSignouts();
    expect(local.pendingSignoutExports).toEqual(pending);
    local.syncToken = "other-account";
    stubServer({ get: () => ({ envelope: { revision: 4 } }), put: () => ({ status: 200, body: {} }) });
    await syncPendingSignouts();
    const put = calls.find(c => c.method === "PUT")!;
    expect((put.body!.export as { vocab: VocabMap }).vocab).toEqual({ 犬: learningWord(3) });
    const fetches = vi.mocked(fetch).mock.calls;
    expect(fetches.every(([, init]) => (init?.headers as Record<string, string>).Authorization === "Bearer tok")).toBe(true);
    expect(JSON.stringify(put.body)).not.toContain("device-only-key");
    expect(local.pendingSignoutExports).toEqual([]);
    expect(local.syncToken).toBe("other-account");
  });

  it("replays cloud reviews into an outgoing export without modifying the signed-out active cache", async () => {
    local.vocab = { 食べる: learningWord(2) };
    local.webReviewSeq = 3;
    await clearSignedOutCache();
    stubServer({ get: () => ({ envelope: { revision: 4, webReviews: [
      { seq: 3, base: "食べる", result: "fail", at: new Date(T0).toISOString() },
      { seq: 4, base: "食べる", result: "pass", at: new Date(T0).toISOString() },
    ] } }), put: () => ({ status: 200, body: {} }) });
    await syncPendingSignouts();
    const body = calls.find(c => c.method === "PUT")!.body!;
    expect((body.export as { vocab: VocabMap }).vocab['食べる'].srs?.stage).toBe(3);
    expect(body.appliedWebReviewSeq).toBe(4);
    expect(local.vocab).toEqual({});
    expect(local.webReviewSeq).toBe(0);
  });

  it("accepts a token even when restore fails, reports the error, and retries without losing new words or the device key", async () => {
    local.syncToken = "";
    local.accountCacheClearedAt = 123;
    local.settings = { openaiKey: "device-only-key" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await setSyncToken("relinked");
    expect(fetch).not.toHaveBeenCalled();
    await pushSnapshot();
    expect(local.syncToken).toBe("relinked");
    expect(local.accountCacheClearedAt).toBe(123);
    expect(local.syncStatus).toMatchObject({ state: "error", error: expect.stringContaining("restore") });
    local.vocab = { 犬: learningWord(2) };
    const snapshot = normalizeAnimeVocabExport({ vocab: { 食べる: learningWord(3) }, settings: { pauseMode: "off" } });
    stubServer({ get: () => ({ envelope: { revision: 8, snapshot } }), put: () => ({ status: 200, body: {} }) });
    await pushSnapshot();
    expect(local.accountCacheClearedAt).toBeNull();
    expect(Object.keys(local.vocab as object).sort()).toEqual(["犬", "食べる"].sort());
    expect(local.settings).toMatchObject({ openaiKey: "device-only-key", pauseMode: "off" });
    expect(local.syncStatus).toMatchObject({ state: "ok" });
  });

  it("does not block queued settings writes while a restore request is pending", async () => {
    local.accountCacheClearedAt = 123;
    let finish!: (res: Response) => void;
    let started!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; });
    vi.stubGlobal("fetch", vi.fn(() => { started(); return new Promise<Response>(resolve => { finish = resolve; }); }));
    const sync = pushSnapshot();
    await began;
    await setSettings({ cooldownSec: 9 });
    expect(local.settings).toMatchObject({ cooldownSec: 9 });
    finish(new Response('{}', { status: 503 }));
    await sync;
  });

  it("discards a response from before sign-out without applying reviews or uploading an empty deck", async () => {
    stubServer({
      get: () => {
        local.syncToken = "";
        local.vocab = {};
        local.webReviewSeq = 0;
        return { envelope: { revision: 3, webReviews: [{ seq: 12, base: "食べる", result: "pass", at: new Date(T0).toISOString() }] } };
      },
      put: () => ({ status: 200, body: {} }),
    });
    await pushSnapshot();
    expect(calls.map(c => c.method)).toEqual(["GET"]);
    expect(local.webReviewSeq).toBe(0);
    expect(local.vocab).toEqual({});
  });
  it("applies the cloud app's reviews before exporting, and says how far it got", async () => {
    local.vocab = { 食べる: learningWord(2) } satisfies VocabMap;
    stubServer({
      get: () => ({ envelope: { revision: 7, webReviews: [{ seq: 3, base: "食べる", result: "pass", at: new Date(T0).toISOString() }] } }),
      put: () => ({ status: 200, body: { envelope: { revision: 8 } } }),
    });
    await pushSnapshot();
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.body!.expectedRevision).toBe(7);
    expect(put.body!.appliedWebReviewSeq).toBe(3);
    const exported = (put.body!.export as { vocab: VocabMap }).vocab["食べる"];
    expect(exported.srs?.stage).toBe(3);
    expect((local.syncStatus as { state: string }).state).toBe("ok");
  });

  it("reruns the whole round on a 409 instead of re-sending a stale export", async () => {
    local.vocab = { 食べる: learningWord(2) } satisfies VocabMap;
    let gets = 0;
    let puts = 0;
    stubServer({
      // A review lands on the web between the first read and the first write.
      get: () => {
        gets++;
        return gets === 1
          ? { envelope: { revision: 1, webReviews: [] } }
          : { envelope: { revision: 2, webReviews: [{ seq: 1, base: "食べる", result: "fail", at: new Date(T0).toISOString() }] } };
      },
      put: () => {
        puts++;
        return puts === 1
          ? { status: 409, body: { error: "revision-conflict", conflict: { currentRevision: 2 } } }
          : { status: 200, body: { envelope: { revision: 3 } } };
      },
    });
    await pushSnapshot();
    expect(calls.map((c) => c.method)).toEqual(["GET", "PUT", "GET", "PUT"]);
    const second = calls[3].body!;
    expect(second.expectedRevision).toBe(2);
    expect(second.appliedWebReviewSeq).toBe(1);
    const exported = (second.export as { vocab: VocabMap }).vocab["食べる"];
    expect(exported.srs).toMatchObject({ stage: 1, lapses: 1 });
  });

  it("never sends the BYO key", async () => {
    local.settings = { openaiKey: "sk-secret" };
    stubServer({ get: () => ({ envelope: null }), put: () => ({ status: 200, body: {} }) });
    await pushSnapshot();
    const put = calls.find((c) => c.method === "PUT")!;
    expect(JSON.stringify(put.body)).not.toContain("sk-secret");
    expect(put.body!.expectedRevision).toBeNull();
    expect(put.body!.appliedWebReviewSeq).toBe(0);
  });
});
