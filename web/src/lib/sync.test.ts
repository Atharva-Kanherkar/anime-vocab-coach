import { describe, expect, it } from "vitest";
import {
  applyCloudSyncUpdate,
  cloudSnapshotToAnimeVocabExport,
  createCloudSyncEnvelope,
  mergeCloudSnapshots,
  normalizeCloudSyncSnapshot,
  normalizeAnimeVocabExport,
  pickDueReviews,
  pickRecentWords,
  summarizeSyncSnapshot,
  type ExtensionDailyStats,
  type ExtensionVocabRecord,
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

describe("pickRecentWords", () => {
  it("returns words sorted by most recent lastSeenAt", () => {
    const snapshot = normalizeAnimeVocabExport({
      vocab: {
        古い: { state: "known", lastSeenAt: 1000 },
        新しい: { state: "learning", lastSeenAt: 3000 },
        中間: { state: "learning", lastSeenAt: 2000 },
        未見: { state: "new" },
      },
    });

    expect(pickRecentWords(snapshot, 2).map((word) => word.base)).toEqual(["新しい", "中間"]);
  });
});

describe("pickDueReviews", () => {
  it("returns due reviews sorted soonest-first", () => {
    const now = new Date("2026-07-04T12:00:00.000Z");
    const snapshot = normalizeAnimeVocabExport({
      vocab: {
        後: {
          state: "learning",
          srs: { stage: 1, dueAt: Date.parse("2026-07-04T11:00:00.000Z"), lapses: 0 },
        },
        先: {
          state: "learning",
          srs: { stage: 1, dueAt: Date.parse("2026-07-04T10:00:00.000Z"), lapses: 0 },
        },
        未来: {
          state: "learning",
          srs: { stage: 1, dueAt: Date.parse("2026-07-05T00:00:00.000Z"), lapses: 0 },
        },
      },
    });

    expect(pickDueReviews(snapshot, now, 5).map((word) => word.base)).toEqual(["先", "後"]);
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

describe("mergeCloudSnapshots (P0 #6 — union merge, never wipe)", () => {
  type VocabRec = Partial<ExtensionVocabRecord>;

  function word(overrides: VocabRec = {}): VocabRec {
    return {
      state: "learning",
      reading: "x",
      gloss: "x",
      level: 5,
      freqRank: 100,
      seenCount: 1,
      shownCount: 1,
      firstSeenAt: 1000,
      lastSeenAt: 1000,
      srs: null,
      ...overrides,
    };
  }

  function snap(
    vocab: Record<string, VocabRec>,
    opts: { settings?: Record<string, unknown>; daily?: Record<string, Partial<ExtensionDailyStats>>; cardTimestamps?: number[] } = {}
  ) {
    return normalizeAnimeVocabExport(
      {
        settings: opts.settings || {},
        vocab,
        stats: { daily: opts.daily || {}, cardTimestamps: opts.cardTimestamps || [] },
      },
      new Date("2026-07-04T00:00:00.000Z")
    );
  }

  it("never deletes server words on push — a near-empty device can't wipe the cloud", () => {
    const server = snap({ 食べる: word({ lastSeenAt: 2000 }), 見る: word({ lastSeenAt: 3000 }) });
    const incoming = snap({}); // second device, freshly installed, no words yet
    const merged = mergeCloudSnapshots(server, incoming);
    expect(merged.words.map((w) => w.base).sort()).toEqual(["見る", "食べる"]);
  });

  it("adds words the cloud has never seen", () => {
    const merged = mergeCloudSnapshots(snap({ 食べる: word() }), snap({ 新顔: word() }));
    expect(merged.words.map((w) => w.base).sort()).toEqual(["新顔", "食べる"]);
  });

  it("on a per-word conflict, newer lastSeenAt wins; counts max; firstSeenAt earliest", () => {
    const server = snap({
      食べる: word({ state: "learning", seenCount: 5, shownCount: 4, firstSeenAt: 1000, lastSeenAt: 5000, srs: { stage: 2, dueAt: 9000, lapses: 1 } }),
    });
    const incoming = snap({
      食べる: word({ state: "known", seenCount: 2, shownCount: 1, firstSeenAt: 500, lastSeenAt: 8000, srs: { stage: 3, dueAt: 9999, lapses: 0 } }),
    });
    const w = mergeCloudSnapshots(server, incoming).words.find((x) => x.base === "食べる")!;
    expect(w.state).toBe("known"); // incoming is newer (8000 > 5000)
    expect(w.review?.stage).toBe(3); // whole record from the newer side
    expect(w.seenCount).toBe(5); // max(5, 2) — a stale device can't lower it
    expect(w.shownCount).toBe(4); // max(4, 1)
    expect(Date.parse(w.firstSeenAt!)).toBe(500); // earliest first-seen
  });

  it("keeps the server record when it is the newer side", () => {
    const server = snap({ 食べる: word({ state: "known", lastSeenAt: 9000 }) });
    const incoming = snap({ 食べる: word({ state: "learning", lastSeenAt: 4000 }) });
    const w = mergeCloudSnapshots(server, incoming).words.find((x) => x.base === "食べる")!;
    expect(w.state).toBe("known");
  });

  it("unions daily stats, taking the max of each counter (no double-count)", () => {
    const server = snap({}, { daily: { "2026-07-03": { met: 5, judged: 2, reviews: 1, watchMin: 30 } } });
    const incoming = snap({}, {
      daily: {
        "2026-07-03": { met: 3, judged: 4, reviews: 0, watchMin: 20 },
        "2026-07-04": { met: 1, judged: 1, reviews: 1, watchMin: 10 },
      },
    });
    const merged = mergeCloudSnapshots(server, incoming);
    expect(merged.daily.find((d) => d.day === "2026-07-03")).toEqual({ day: "2026-07-03", met: 5, judged: 4, reviews: 1, watchMin: 30 });
    expect(merged.daily.map((d) => d.day)).toEqual(["2026-07-03", "2026-07-04"]);
  });

  it("unions and dedupes card timestamps", () => {
    const merged = mergeCloudSnapshots(snap({}, { cardTimestamps: [100, 200] }), snap({}, { cardTimestamps: [200, 300] }));
    expect(merged.cardTimestamps).toEqual([100, 200, 300]);
  });

  it("unions settings with the pushing device winning per key", () => {
    const merged = mergeCloudSnapshots(
      snap({}, { settings: { targetLevel: 5, theme: "dark" } }),
      snap({}, { settings: { targetLevel: 3 } })
    );
    expect(merged.settings).toEqual({ targetLevel: 3, theme: "dark" });
  });

  it("applyCloudSyncUpdate merges into the stored snapshot and bumps the revision", () => {
    const profile = { id: "u", email: null, name: null };
    const current = createCloudSyncEnvelope(profile, snap({ 食べる: word() }), 4, new Date("2026-07-04T00:00:00.000Z"));
    const next = applyCloudSyncUpdate(current, profile, snap({ 見る: word() }), 4, new Date("2026-07-04T02:00:00.000Z"));
    if ("type" in next) throw new Error("expected a merge, got a conflict");
    expect(next.revision).toBe(5);
    expect(next.snapshot.words.map((w) => w.base).sort()).toEqual(["見る", "食べる"]);
  });
});

describe("word capture context (source)", () => {
  it("carries source from an extension export into the cloud snapshot", () => {
    const snap = normalizeAnimeVocabExport({
      exportedAt: "2026-07-05T00:00:00.000Z",
      settings: {},
      vocab: {
        約束: {
          state: "learning",
          reading: "やくそく",
          gloss: "promise",
          level: 4,
          freqRank: 500,
          seenCount: 2,
          shownCount: 1,
          firstSeenAt: 1704067200000,
          lastSeenAt: 1704067200000,
          srs: { stage: 1, dueAt: 1704153600000, lapses: 0 },
          source: { title: "Attack on Titan", line: "約束を守る", en: "Keep the promise" },
        },
      },
      stats: { daily: {}, cardTimestamps: [] },
    });
    expect(snap.words[0].source).toEqual({ title: "Attack on Titan", line: "約束を守る", en: "Keep the promise" });
  });

  it("round-trips source cloud→extension and back, and drops empty sources", () => {
    const snap = normalizeAnimeVocabExport({
      exportedAt: "2026-07-05T00:00:00.000Z",
      settings: {},
      vocab: {
        猫: { state: "known", reading: "ねこ", gloss: "cat", level: 5, freqRank: 900, seenCount: 1, shownCount: 0, firstSeenAt: 1, lastSeenAt: 1, srs: null, source: { title: "Frieren", line: "猫だ", en: "" } },
        犬: { state: "known", reading: "いぬ", gloss: "dog", level: 5, freqRank: 900, seenCount: 1, shownCount: 0, firstSeenAt: 1, lastSeenAt: 1, srs: null, source: { title: "", line: "", en: "" } },
      },
      stats: { daily: {}, cardTimestamps: [] },
    });
    const cat = snap.words.find((w) => w.base === "猫")!;
    const dog = snap.words.find((w) => w.base === "犬")!;
    expect(cat.source).toEqual({ title: "Frieren", line: "猫だ", en: null }); // empty en → null
    expect(dog.source).toBeNull(); // all-empty source → null

    // cloud → extension export preserves it
    const back = cloudSnapshotToAnimeVocabExport(snap);
    expect(back.vocab?.["猫"]?.source).toEqual({ title: "Frieren", line: "猫だ", en: null });

    // and re-normalizing survives the round trip
    const snap2 = normalizeCloudSyncSnapshot(snap);
    expect(snap2.words.find((w) => w.base === "猫")!.source?.title).toBe("Frieren");
  });
});
