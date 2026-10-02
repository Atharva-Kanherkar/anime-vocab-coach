import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushSnapshot } from "../src/lib/cloud-sync";
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
