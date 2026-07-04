import { describe, expect, it } from "vitest";
import { normalizeAnimeVocabExport, summarizeSyncSnapshot } from "./sync";

describe("normalizeAnimeVocabExport", () => {
  it("handles missing settings, vocab, and stats", () => {
    const snapshot = normalizeAnimeVocabExport({}, new Date("2026-07-04T00:00:00.000Z"));

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      source: "animevocab-extension",
      importedAt: "2026-07-04T00:00:00.000Z",
      sourceExportedAt: null,
      settings: {},
      words: [],
      daily: [],
    });
  });

  it("maps extension vocab and daily stats into a versioned snapshot", () => {
    const snapshot = normalizeAnimeVocabExport(
      {
        settings: { targetLevel: 5 },
        exportedAt: "2026-07-03T12:00:00.000Z",
        vocab: {
          食べる: {
            state: "learning",
            reading: "たべる",
            gloss: "to eat",
            level: 5,
            freqRank: 800,
            seenCount: 3,
            shownCount: 1,
            firstSeenAt: 1783000000000,
            lastSeenAt: 1783000600000,
            srs: { stage: 1, dueAt: 1783001000000, lapses: 0 },
          },
        },
        stats: {
          daily: {
            "2026-07-03": { met: 2, judged: 1, reviews: 0, watchMin: 22 },
          },
        },
      },
      new Date("2026-07-04T00:00:00.000Z")
    );

    expect(snapshot.settings).toEqual({ targetLevel: 5 });
    expect(snapshot.sourceExportedAt).toBe("2026-07-03T12:00:00.000Z");
    expect(snapshot.words[0]).toMatchObject({
      base: "食べる",
      state: "learning",
      reading: "たべる",
      gloss: "to eat",
      level: 5,
      freqRank: 800,
      seenCount: 3,
      shownCount: 1,
      review: { stage: 1, lapses: 0 },
    });
    expect(snapshot.daily).toEqual([{ day: "2026-07-03", met: 2, judged: 1, reviews: 0, watchMin: 22 }]);
  });
});

describe("summarizeSyncSnapshot", () => {
  it("counts words by state and due reviews", () => {
    const snapshot = normalizeAnimeVocabExport(
      {
        vocab: {
          a: { state: "new", srs: null },
          b: { state: "learning", srs: { stage: 1, dueAt: Date.parse("2026-07-03T00:00:00.000Z"), lapses: 0 } },
          c: { state: "known", srs: null },
          d: { state: "ignored", srs: null },
        },
        stats: {
          daily: {
            "2026-07-03": { judged: 4, watchMin: 30 },
            "2026-07-04": { judged: 2, watchMin: 10 },
          },
        },
      },
      new Date("2026-07-04T00:00:00.000Z")
    );

    expect(summarizeSyncSnapshot(snapshot, new Date("2026-07-04T00:00:00.000Z"))).toMatchObject({
      totalWords: 4,
      newWords: 1,
      learningWords: 1,
      knownWords: 1,
      ignoredWords: 1,
      reviewsDue: 1,
      watchMinutes: 40,
      judgedCards: 6,
    });
  });
});
