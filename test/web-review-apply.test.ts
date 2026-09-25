import { beforeEach, describe, expect, it, vi } from "vitest";
import * as storage from "../src/lib/storage";
import { SRS_INTERVALS, type VocabMap, type VocabRecord } from "../src/types";

/** In-memory chrome.storage.local, counting writes. */
const local: Record<string, unknown> = {};
let writes = 0;

const HOUR = 3600e3;
const T0 = Date.parse("2026-09-25T10:00:00Z");

function learning(stage: number, extra: Partial<VocabRecord> = {}): VocabRecord {
  return {
    state: "learning",
    reading: "たべる",
    gloss: "to eat",
    level: 2,
    freqRank: 300,
    seenCount: 3,
    shownCount: 1,
    firstSeenAt: T0 - 48 * HOUR,
    lastSeenAt: T0 - 24 * HOUR,
    srs: { stage, dueAt: T0 - HOUR, lapses: 0 },
    ...extra,
  };
}

beforeEach(() => {
  for (const key of Object.keys(local)) delete local[key];
  writes = 0;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  vi.stubGlobal("chrome", {
    runtime: { id: "test", sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: {
        get: vi.fn(async (keys: string[]) =>
          Object.fromEntries(keys.map((k) => [k, structuredClone(local[k])]).filter(([, v]) => v !== undefined))
        ),
        set: vi.fn(async (value: Record<string, unknown>) => {
          writes++;
          Object.assign(local, structuredClone(value));
        }),
      },
    },
  });
});

const at = (ms: number) => new Date(ms).toISOString();

describe("applyWebReviews", () => {
  it("applies cloud-app reviews in sequence order, in one write", async () => {
    local.vocab = { 食べる: learning(2), 飲む: learning(1) } satisfies VocabMap;
    const result = await storage.applyWebReviews([
      { seq: 2, base: "飲む", result: "fail", at: at(T0 + 60e3) },
      { seq: 1, base: "食べる", result: "pass", at: at(T0) },
    ]);
    expect(result).toEqual({ applied: 2, seq: 2 });
    expect(writes).toBe(1);
    const vocab = local.vocab as VocabMap;
    expect(vocab["食べる"].srs).toEqual({ stage: 3, dueAt: T0 + SRS_INTERVALS[3], lapses: 0 });
    expect(vocab["飲む"].srs).toEqual({ stage: 1, dueAt: T0 + 60e3 + SRS_INTERVALS[1], lapses: 1 });
    expect(local.webReviewSeq).toBe(2);
  });

  it("bumps lastSeenAt so the cloud merge keeps the reviewed copy", async () => {
    local.vocab = { 食べる: learning(2) };
    await storage.applyWebReviews([{ seq: 1, base: "食べる", result: "pass", at: at(T0) }]);
    expect((local.vocab as VocabMap)["食べる"].lastSeenAt).toBe(T0);
  });

  it("counts the review on the day it was taken", async () => {
    local.vocab = { 食べる: learning(2) };
    await storage.applyWebReviews([{ seq: 1, base: "食べる", result: "pass", at: at(T0) }]);
    const day = new Date(T0).toLocaleDateString("sv");
    const stats = local.stats as { daily: Record<string, { reviews: number; judged: number }> };
    expect(stats.daily[day].reviews).toBe(1);
    expect(stats.daily[day].judged).toBe(1);
  });

  it("skips ops it already applied", async () => {
    local.vocab = { 食べる: learning(2) };
    local.webReviewSeq = 5;
    const result = await storage.applyWebReviews([
      { seq: 4, base: "食べる", result: "pass", at: at(T0) },
      { seq: 5, base: "食べる", result: "pass", at: at(T0) },
    ]);
    expect(result).toEqual({ applied: 0, seq: 5 });
    expect(writes).toBe(0);
    expect((local.vocab as VocabMap)["食べる"].srs?.stage).toBe(2);
  });

  it("finishes a word at stage 5 as known", async () => {
    local.vocab = { 食べる: learning(5) };
    await storage.applyWebReviews([{ seq: 1, base: "食べる", result: "pass", at: at(T0) }]);
    const rec = (local.vocab as VocabMap)["食べる"];
    expect(rec.state).toBe("known");
    expect(rec.srs).toBeNull();
  });

  it("leaves a word that is not learning here alone, but still moves past its op", async () => {
    local.vocab = { 食べる: { ...learning(2), state: "known", srs: null } };
    const result = await storage.applyWebReviews([
      { seq: 1, base: "食べる", result: "fail", at: at(T0) },
      { seq: 2, base: "消えた", result: "pass", at: at(T0) },
    ]);
    expect(result).toEqual({ applied: 0, seq: 2 });
    expect((local.vocab as VocabMap)["食べる"].state).toBe("known");
    expect(local.webReviewSeq).toBe(2);
    expect(await storage.getWebReviewSeq()).toBe(2);
  });
});

describe("reviews taken in the extension", () => {
  it("also bump lastSeenAt", async () => {
    local.vocab = { 食べる: learning(2) };
    const before = Date.now();
    await storage.judgeWord("食べる", "review-pass", { reading: "たべる", gloss: "to eat", level: 2, freqRank: 300 });
    expect((local.vocab as VocabMap)["食べる"].lastSeenAt).toBeGreaterThanOrEqual(before);
  });
});
