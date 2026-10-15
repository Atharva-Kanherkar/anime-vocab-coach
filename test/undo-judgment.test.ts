import { beforeEach, describe, expect, it, vi } from "vitest";
import * as storage from "../src/lib/storage";
import type { JudgmentMeta, VocabRecord } from "../src/types";

// ISO 25010 usability (user error protection): a judgment can be taken back,
// leaving the word and the day's counters exactly as they were.
const local: Record<string, unknown> = {};
const META: JudgmentMeta = { reading: "やくそく", gloss: "promise", level: 4, freqRank: 500 };

beforeEach(() => {
  for (const k of Object.keys(local)) delete local[k];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  vi.stubGlobal("chrome", {
    runtime: { id: "test", sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: {
        get: vi.fn(async (keys: string[]) =>
          Object.fromEntries(keys.filter((k) => k in local).map((k) => [k, structuredClone(local[k])]))
        ),
        set: vi.fn(async (v: Record<string, unknown>) => void Object.assign(local, structuredClone(v))),
      },
    },
  });
});

const vocab = () => (local.vocab || {}) as Record<string, VocabRecord>;
const today = () => (local.stats as { daily: Record<string, { judged: number; reviews: number }> }).daily[storage.todayKey()]!;

describe("undoJudgment", () => {
  it("removes a word the judgment created and backs out the judged count", async () => {
    const day = storage.todayKey();
    await storage.judgeWord("約束", "know", META);
    expect(vocab()["約束"]?.state).toBe("known");
    expect(today().judged).toBe(1);

    await storage.undoJudgment({ base: "約束", previous: null, judgment: "know", day });
    expect(vocab()["約束"]).toBeUndefined();
    expect(today().judged).toBe(0);
  });

  it("puts a word that was already in the deck back exactly as it was", async () => {
    await storage.judgeWord("約束", "learn", META);
    const before = structuredClone(vocab()["約束"]!);
    const day = storage.todayKey();

    await storage.judgeWord("約束", "ignore", META);
    expect(vocab()["約束"]?.state).toBe("ignored");

    await storage.undoJudgment({ base: "約束", previous: before, judgment: "ignore", day });
    expect(vocab()["約束"]).toEqual(before);
    expect(today().judged).toBe(1);
  });

  it("backs out a review from the reviews count too", async () => {
    await storage.judgeWord("約束", "learn", META);
    const before = structuredClone(vocab()["約束"]!);
    const day = storage.todayKey();
    await storage.judgeWord("約束", "review-pass", META);
    expect(today().reviews).toBe(1);

    await storage.undoJudgment({ base: "約束", previous: before, judgment: "review-pass", day });
    expect(today().reviews).toBe(0);
    expect(vocab()["約束"]?.srs?.stage).toBe(before.srs!.stage);
  });
});
