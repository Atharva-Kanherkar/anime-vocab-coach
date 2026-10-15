import { afterEach, describe, expect, it, vi } from "vitest";
import type { JudgmentMeta } from "../src/types";

// ISO 25010 reliability audit: two extension contexts writing the vocab map at
// the same moment lost one of the writes. Each context (a tab's content
// script, the popup, the dashboard, the worker) is its own module instance
// with its own queue, so three instances are loaded here over ONE shared,
// deliberately slow chrome.storage: a worker and two tabs.

const META: JudgmentMeta = { reading: "よみ", gloss: "g", level: 3, freqRank: 900 };

function sharedStorage() {
  const local: Record<string, unknown> = {};
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
  return {
    local,
    area: {
      get: async (keys: string[]) => {
        await tick();
        return Object.fromEntries(keys.filter((k) => k in local).map((k) => [k, structuredClone(local[k])]));
      },
      set: async (value: Record<string, unknown>) => {
        await tick();
        Object.assign(local, structuredClone(value));
      },
    },
  };
}

type StorageModule = typeof import("../src/lib/storage");

async function loadContext(isWorker: boolean): Promise<StorageModule> {
  vi.resetModules();
  vi.doMock("../src/lib/run-context", async (orig) => ({
    ...(await orig<typeof import("../src/lib/run-context")>()),
    inServiceWorker: () => isWorker,
  }));
  return import("../src/lib/storage");
}

async function race(routeToWorker: boolean): Promise<number> {
  const { local, area } = sharedStorage();
  let worker: StorageModule | null = null;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  vi.stubGlobal("chrome", {
    runtime: {
      id: "test",
      sendMessage: vi.fn(async (msg: { type?: string }) => {
        if (msg?.type !== "avc-storage-write") return undefined;
        // Old behaviour: no single writer, each context writes for itself.
        if (!routeToWorker) throw new Error("no receiver");
        return new Promise((resolve) => worker!.handleStorageWrite(msg, resolve));
      }),
    },
    storage: { local: area },
  });
  worker = await loadContext(true);
  const tabA = await loadContext(false);
  const tabB = await loadContext(false);

  // 15 words learned in each tab, interleaved, all at once.
  await Promise.all(
    Array.from({ length: 15 }, (_, i) => [
      tabA.judgeWord(`a${i}`, "learn", META),
      tabB.judgeWord(`b${i}`, "learn", META),
    ]).flat()
  );
  return Object.keys((local.vocab as Record<string, unknown>) || {}).length;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("../src/lib/run-context");
  vi.resetModules();
});

describe("one writer for vocab/stats/settings", () => {
  it("before: two contexts writing for themselves lose words", async () => {
    expect(await race(false)).toBeLessThan(30);
  });

  it("after: every write goes through the worker's queue and none is lost", async () => {
    expect(await race(true)).toBe(30);
  });
});
