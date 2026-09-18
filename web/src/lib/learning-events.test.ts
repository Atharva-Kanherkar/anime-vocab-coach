import { describe, expect, it } from "vitest";
import { latestActiveDay, newlyUnlockedCards, snapshotLevel, startedNewStreakDay } from "./learning-events";
import type { CloudDailyStats, CloudSyncSnapshot, CloudWordRecord } from "./sync";

/**
 * The two learning-loop events the server derives rather than receives (#111).
 *
 * Both fire from the sync route, which every extension push hits, so the
 * interesting property is not "does it fire" but "does it fire once". A
 * `streak_day` per sync would report a learner who syncs forty times a day as
 * forty habit days, which is worse than the zero rows we started with.
 */

const day = (d: string, over: Partial<CloudDailyStats> = {}): CloudDailyStats => ({
  day: d,
  met: 0,
  judged: 0,
  reviews: 0,
  watchMin: 0,
  ...over,
});

const snapshot = (
  daily: CloudDailyStats[],
  words: CloudWordRecord[] = []
): CloudSyncSnapshot => ({
  schemaVersion: 1,
  source: "animevocab-extension",
  importedAt: "2026-09-18T00:00:00.000Z",
  sourceExportedAt: null,
  settings: {},
  words,
  daily,
  cardTimestamps: [],
});

const words = (n: number): CloudWordRecord[] =>
  Array.from({ length: n }, (_, i) => ({
    base: `w${i}`,
    state: "learning" as const,
    reading: "",
    gloss: "",
    level: 4,
    freqRank: i,
    seenCount: 1,
    shownCount: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    review: null,
    source: null,
  }));

const NOW = new Date("2026-09-18T12:00:00.000Z");

describe("latestActiveDay", () => {
  it("ignores days the learner opened the app and did nothing", () => {
    const s = snapshot([day("2026-09-17", { judged: 3 }), day("2026-09-18", { met: 5 })]);
    expect(latestActiveDay(s)).toBe("2026-09-17");
  });

  it("is null when nothing qualifies", () => {
    expect(latestActiveDay(snapshot([day("2026-09-18")]))).toBeNull();
    expect(latestActiveDay(null)).toBeNull();
  });
});

describe("startedNewStreakDay", () => {
  it("fires on the learner's first qualifying activity of a new day", () => {
    const before = snapshot([day("2026-09-17", { reviews: 2 })]);
    const after = snapshot([day("2026-09-17", { reviews: 2 }), day("2026-09-18", { judged: 1 })]);
    expect(startedNewStreakDay(before, after)).toBe(true);
  });

  it("stays quiet for every later sync of the same day", () => {
    const before = snapshot([day("2026-09-18", { judged: 1 })]);
    const after = snapshot([day("2026-09-18", { judged: 9, reviews: 4 })]);
    expect(startedNewStreakDay(before, after)).toBe(false);
  });

  it("fires for a learner's very first active day", () => {
    expect(startedNewStreakDay(null, snapshot([day("2026-09-18", { watchMin: 3 })]))).toBe(true);
  });

  it("stays quiet when an OLD day is back-filled", () => {
    const before = snapshot([day("2026-09-18", { judged: 1 })]);
    const after = snapshot([day("2026-09-10", { judged: 4 }), day("2026-09-18", { judged: 1 })]);
    expect(startedNewStreakDay(before, after)).toBe(false);
  });

  it("stays quiet when a sync carries no activity at all", () => {
    expect(startedNewStreakDay(null, snapshot([day("2026-09-18")]))).toBe(false);
  });
});

describe("newlyUnlockedCards", () => {
  it("counts nothing for a first-ever import, however much progress it carries", () => {
    const after = snapshot([day("2026-09-18", { judged: 200, watchMin: 400 })], words(300));
    expect(snapshotLevel(after, NOW)).toBeGreaterThan(1);
    expect(newlyUnlockedCards(null, after, NOW)).toBe(0);
  });

  it("counts a card when a sync crosses its level gate", () => {
    const before = snapshot([day("2026-09-17", { judged: 1 })], words(1));
    const after = snapshot([day("2026-09-17", { judged: 40, watchMin: 120 })], words(60));
    expect(snapshotLevel(after, NOW)).toBeGreaterThan(snapshotLevel(before, NOW));
    expect(newlyUnlockedCards(before, after, NOW)).toBeGreaterThan(0);
  });

  it("counts nothing when the level did not move", () => {
    const before = snapshot([day("2026-09-17", { judged: 4 })], words(3));
    const after = snapshot([day("2026-09-17", { judged: 5 })], words(3));
    expect(newlyUnlockedCards(before, after, NOW)).toBe(0);
  });

  it("never reports a negative unlock if progress somehow shrinks", () => {
    const before = snapshot([day("2026-09-17", { judged: 40, watchMin: 120 })], words(60));
    const after = snapshot([day("2026-09-17", { judged: 1 })], words(1));
    expect(newlyUnlockedCards(before, after, NOW)).toBe(0);
  });
});
