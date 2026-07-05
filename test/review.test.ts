import { describe, it, expect } from "vitest";
import type { VocabMap, VocabRecord } from "../src/types";
import { getDueWords, dueCount } from "../src/lib/review";

function rec(partial: Partial<VocabRecord>): VocabRecord {
  return {
    state: "learning",
    reading: "",
    gloss: "",
    level: 5,
    freqRank: 1000,
    seenCount: 1,
    shownCount: 0,
    firstSeenAt: 0,
    lastSeenAt: 0,
    srs: null,
    ...partial,
  };
}

const NOW = 1_000_000;

describe("getDueWords", () => {
  it("returns only learning words whose review is due", () => {
    const vocab: VocabMap = {
      due1: rec({ state: "learning", srs: { stage: 2, dueAt: NOW - 1000, lapses: 0 } }),
      notDue: rec({ state: "learning", srs: { stage: 3, dueAt: NOW + 100000, lapses: 0 } }),
      known: rec({ state: "known", srs: null }),
      newWord: rec({ state: "new", srs: null }),
    };
    const due = getDueWords(vocab, NOW);
    expect(due.map((d) => d.base)).toEqual(["due1"]);
  });

  it("orders most-overdue first", () => {
    const vocab: VocabMap = {
      a: rec({ state: "learning", srs: { stage: 1, dueAt: NOW - 1000, lapses: 0 } }),
      b: rec({ state: "learning", srs: { stage: 1, dueAt: NOW - 9000, lapses: 0 } }),
      c: rec({ state: "learning", srs: { stage: 1, dueAt: NOW - 5000, lapses: 0 } }),
    };
    expect(getDueWords(vocab, NOW).map((d) => d.base)).toEqual(["b", "c", "a"]);
  });

  it("caps a session at the limit", () => {
    const vocab: VocabMap = {};
    for (let i = 0; i < 10; i++) vocab[`w${i}`] = rec({ state: "learning", srs: { stage: 1, dueAt: NOW - i, lapses: 0 } });
    expect(getDueWords(vocab, NOW, 3)).toHaveLength(3);
  });

  it("ignores a learning word with no srs entry", () => {
    const vocab: VocabMap = { x: rec({ state: "learning", srs: null }) };
    expect(getDueWords(vocab, NOW)).toEqual([]);
  });
});

describe("dueCount", () => {
  it("counts all due reviews uncapped", () => {
    const vocab: VocabMap = {};
    for (let i = 0; i < 60; i++) vocab[`w${i}`] = rec({ state: "learning", srs: { stage: 1, dueAt: NOW - 1, lapses: 0 } });
    expect(dueCount(vocab, NOW)).toBe(60);
    expect(getDueWords(vocab, NOW).length).toBe(50); // default cap
  });
});
