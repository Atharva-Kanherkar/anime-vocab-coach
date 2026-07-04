import { describe, expect, it } from "vitest";
import {
  applyCloudSyncUpdate,
  cloudSnapshotToAnimeVocabExport,
  createCloudSyncEnvelope,
  normalizeCloudSyncSnapshot,
  normalizeAnimeVocabExport,
  summarizeSyncSnapshot,
} from "./sync";

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
          cardTimestamps: [1783000600000],
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
    expect(snapshot.cardTimestamps).toEqual([1783000600000]);
  });

  it("rejects unknown word states instead of downgrading progress", () => {
    expect(() =>
      normalizeAnimeVocabExport({
        vocab: {
          見る: {
            state: "mastered" as never,
          },
        },
      })
    ).toThrow("Invalid word state");
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

describe("cloudSnapshotToAnimeVocabExport", () => {
  it("round-trips a local vocabulary item through the cloud snapshot shape", () => {
    const localExport = {
      settings: { targetLevel: 4 },
      exportedAt: "2026-07-03T12:00:00.000Z",
      vocab: {
        見る: {
          state: "learning" as const,
          reading: "みる",
          gloss: "to see",
          level: 5,
          freqRank: 120,
          seenCount: 6,
          shownCount: 2,
          firstSeenAt: 1783000000000,
          lastSeenAt: 1783000600000,
          srs: { stage: 2, dueAt: 1783086400000, lapses: 1 },
        },
      },
      stats: {
        daily: {
          "2026-07-03": { met: 1, judged: 2, reviews: 1, watchMin: 24 },
        },
        cardTimestamps: [1783000600000],
      },
    };

    const snapshot = normalizeAnimeVocabExport(localExport, new Date("2026-07-04T00:00:00.000Z"));
    const roundTrip = cloudSnapshotToAnimeVocabExport(snapshot);

    expect(roundTrip.settings).toEqual(localExport.settings);
    expect(roundTrip.exportedAt).toBe(localExport.exportedAt);
    expect(roundTrip.vocab?.見る).toEqual(localExport.vocab.見る);
    expect(roundTrip.stats?.daily).toEqual(localExport.stats.daily);
    expect(roundTrip.stats?.cardTimestamps).toEqual(localExport.stats.cardTimestamps);
  });
});

describe("normalizeCloudSyncSnapshot", () => {
  it("sanitizes a cloud snapshot before persistence", () => {
    const snapshot = normalizeCloudSyncSnapshot({
      schemaVersion: 1,
      source: "animevocab-extension",
      importedAt: "2026-07-04T00:00:00.000Z",
      sourceExportedAt: "2026-07-03T12:00:00.000Z",
      settings: { targetLevel: 5 },
      cardTimestamps: [1783000600000, "bad"],
      words: [
        {
          base: "見る",
          state: "learning",
          review: { stage: 2, dueAt: "2026-07-05T00:00:00.000Z", lapses: 1 },
        },
      ],
      daily: [{ day: "2026-07-03", judged: 2, watchMin: 24 }],
    });

    expect(snapshot.cardTimestamps).toEqual([1783000600000]);
    expect(snapshot.words[0]).toMatchObject({
      base: "見る",
      state: "learning",
      review: { stage: 2, dueAt: "2026-07-05T00:00:00.000Z", lapses: 1 },
    });
    expect(snapshot.daily).toEqual([{ day: "2026-07-03", met: 0, judged: 2, reviews: 0, watchMin: 24 }]);
  });

  it("rejects malformed cloud snapshot state", () => {
    expect(() =>
      normalizeCloudSyncSnapshot({
        schemaVersion: 1,
        source: "animevocab-extension",
        words: [{ base: "見る", state: "mastered" }],
        daily: [],
      })
    ).toThrow("Invalid word state");
  });
});

describe("applyCloudSyncUpdate", () => {
  const profile = { id: "user_123", email: "learner@example.com", name: "Learner" };

  it("creates the first cloud envelope for an account", () => {
    const snapshot = normalizeAnimeVocabExport({}, new Date("2026-07-04T00:00:00.000Z"));
    const next = applyCloudSyncUpdate(null, profile, snapshot, null, new Date("2026-07-04T01:00:00.000Z"));

    expect(next).toMatchObject({
      schemaVersion: 1,
      profile,
      revision: 1,
      lastSyncedAt: "2026-07-04T01:00:00.000Z",
    });
  });

  it("detects stale writes when the current revision is visible", () => {
    const snapshot = normalizeAnimeVocabExport({}, new Date("2026-07-04T00:00:00.000Z"));
    const current = createCloudSyncEnvelope(profile, snapshot, 3, new Date("2026-07-04T01:00:00.000Z"));
    const result = applyCloudSyncUpdate(current, profile, snapshot, 2, new Date("2026-07-04T02:00:00.000Z"));

    expect(result).toMatchObject({
      type: "revision-conflict",
      expectedRevision: 2,
      currentRevision: 3,
    });
  });
});
