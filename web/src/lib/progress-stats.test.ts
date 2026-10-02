import { describe, expect, it } from "vitest";
import { normalizeAnimeVocabExport, type ExtensionVocabRecord } from "./sync";
import {
  activitySeries,
  computeProgressStats,
  localDayKey,
  progressTiles,
  stageBuckets,
  stateSplit,
  topShows,
} from "./progress-stats";

// Built from local parts so the day keys hold in any TZ the suite runs in.
const NOW = new Date(2026, 8, 25, 12, 0, 0);
const HOUR = 3600e3;

function w(overrides: Partial<ExtensionVocabRecord> = {}): Partial<ExtensionVocabRecord> {
  return { state: "learning", reading: "", gloss: "", lastSeenAt: NOW.getTime() - HOUR, srs: null, ...overrides };
}

function srs(stage: number, dueOffset: number) {
  return { stage, dueAt: NOW.getTime() + dueOffset, lapses: 0 };
}

const source = (title: string) => ({ title, line: null, en: null });

const snapshot = normalizeAnimeVocabExport(
  {
    vocab: {
      a: w({ srs: srs(1, -HOUR), source: source("Frieren") }),
      b: w({ srs: srs(2, -2 * HOUR), source: source("Frieren") }),
      c: w({ srs: srs(2, HOUR), source: source("Spy x Family") }),
      d: w({ srs: srs(5, 24 * HOUR), source: source("Frieren") }),
      e: w({ state: "known", source: source("Spy x Family") }),
      f: w({ state: "new", source: source("Dandadan") }),
      g: w({ state: "ignored", source: source("Dandadan") }),
      // A review on a non-learning word is not due (the extension ignores it too).
      h: w({ state: "known", srs: srs(3, -HOUR) }),
    },
    stats: {
      daily: {
        [localDayKey(NOW)]: { reviews: 4, judged: 6, watchMin: 20.4 },
        [localDayKey(new Date(2026, 8, 24))]: { reviews: 1, judged: 1, watchMin: 10 },
        [localDayKey(new Date(2026, 7, 1))]: { reviews: 9, judged: 9, watchMin: 30 },
      },
    },
  },
  NOW
);

describe("progressTiles", () => {
  it("counts words by state, due learning words, streak and minutes", () => {
    expect(progressTiles(snapshot, NOW)).toEqual({
      collected: 8,
      known: 2,
      learning: 4,
      dueNow: 2,
      streak: 2,
      minutesWatched: 60,
    });
  });
});

describe("activitySeries", () => {
  it("returns 30 local days, oldest first, zero-filled", () => {
    const series = activitySeries(snapshot.daily, NOW);
    expect(series).toHaveLength(30);
    expect(series[0].day).toBe("2026-08-27");
    expect(series.at(-1)).toEqual({ day: "2026-09-25", reviews: 4, judged: 6 });
    expect(series.at(-2)).toEqual({ day: "2026-09-24", reviews: 1, judged: 1 });
    expect(series.slice(0, 28).every((d) => d.reviews === 0 && d.judged === 0)).toBe(true);
    // A day outside the window never leaks in.
    expect(series.some((d) => d.day === "2026-08-01")).toBe(false);
  });
});

describe("stageBuckets", () => {
  it("buckets learning words by stage 1-5", () => {
    expect(stageBuckets(snapshot.words)).toEqual([
      { stage: 1, count: 1 },
      { stage: 2, count: 2 },
      { stage: 3, count: 0 },
      { stage: 4, count: 0 },
      { stage: 5, count: 1 },
    ]);
  });
});

describe("stateSplit", () => {
  it("splits known / learning / new and leaves ignored out", () => {
    expect(stateSplit(snapshot.words)).toEqual({ known: 2, learning: 4, new: 1 });
  });
});

describe("topShows", () => {
  it("ranks shows by word count, ties by title, capped", () => {
    expect(topShows(snapshot.words)).toEqual([
      { title: "Frieren", count: 3 },
      { title: "Spy x Family", count: 2 },
      { title: "Dandadan", count: 1 },
    ]);
    expect(topShows(snapshot.words, 1)).toEqual([{ title: "Frieren", count: 3 }]);
  });

  it("keeps at most 6 shows", () => {
    const many = normalizeAnimeVocabExport({
      vocab: Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [`w${i}`, w({ source: source(`Show ${i}`) })])
      ),
    });
    expect(topShows(many.words)).toHaveLength(6);
  });
});

describe("computeProgressStats", () => {
  it("bundles every view", () => {
    const stats = computeProgressStats(snapshot, NOW);
    expect(stats.tiles.collected).toBe(8);
    expect(stats.activity).toHaveLength(30);
    expect(stats.stages).toHaveLength(5);
    expect(stats.shows[0].title).toBe("Frieren");
  });
});
