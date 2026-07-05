import { describe, it, expect } from "vitest";
import type { CloudDailyStats } from "./sync";
import {
  isActiveDay,
  mondayOf,
  computeStreak,
  weeklyMetrics,
  challengeProgress,
  CHALLENGES,
  MAX_WEEKLY_REVIEWS,
  MAX_WEEKLY_MINUTES,
  MAX_STREAK_DAYS,
} from "./gamification";

function day(d: string, over: Partial<CloudDailyStats> = {}): CloudDailyStats {
  return { day: d, met: 0, judged: 0, reviews: 0, watchMin: 0, ...over };
}

describe("isActiveDay", () => {
  it("counts reviews, judged, or watch time as activity", () => {
    expect(isActiveDay(day("2026-07-08", { reviews: 1 }))).toBe(true);
    expect(isActiveDay(day("2026-07-08", { judged: 1 }))).toBe(true);
    expect(isActiveDay(day("2026-07-08", { watchMin: 3 }))).toBe(true);
    expect(isActiveDay(day("2026-07-08", { met: 5 }))).toBe(false); // met alone isn't "practice"
    expect(isActiveDay(day("2026-07-08"))).toBe(false);
  });
});

describe("mondayOf", () => {
  it("maps every day of a week to the same Monday, and Monday to itself", () => {
    const week = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12"];
    const mondays = week.map(mondayOf);
    expect(new Set(mondays).size).toBe(1);
    expect(mondays[0]).toBe("2026-07-06");
    // the day before the week belongs to the previous Monday
    expect(mondayOf("2026-07-05")).not.toBe("2026-07-06");
  });
});

describe("computeStreak", () => {
  const now = new Date("2026-07-08T12:00:00Z"); // today = 2026-07-08

  it("counts a run ending today", () => {
    const daily = [day("2026-07-08", { reviews: 1 }), day("2026-07-07", { reviews: 1 }), day("2026-07-06", { watchMin: 5 })];
    expect(computeStreak(daily, now).current).toBe(3);
  });

  it("still counts a run ending yesterday (today not yet missed)", () => {
    const daily = [day("2026-07-07", { reviews: 1 }), day("2026-07-06", { reviews: 1 })];
    expect(computeStreak(daily, now).current).toBe(2);
  });

  it("is 0 when the last activity was more than a day ago", () => {
    const daily = [day("2026-07-05", { reviews: 1 })];
    expect(computeStreak(daily, now).current).toBe(0);
  });

  it("reports the longest historical run independent of the current streak", () => {
    const daily = [
      day("2026-06-01", { reviews: 1 }),
      day("2026-06-02", { reviews: 1 }),
      day("2026-06-03", { reviews: 1 }),
      day("2026-06-04", { reviews: 1 }), // run of 4, long ago
      day("2026-07-08", { reviews: 1 }), // current run of 1
    ];
    const s = computeStreak(daily, now);
    expect(s.longest).toBe(4);
    expect(s.current).toBe(1);
  });

  it("ignores inactive rows", () => {
    const daily = [day("2026-07-08", { met: 9 }), day("2026-07-07", { reviews: 1 })];
    // today has only 'met' (not active) → anchor falls to yesterday
    expect(computeStreak(daily, now).current).toBe(1);
  });

  it("counts a local date that reads one UTC day ahead (JST users)", () => {
    // A JST learner's newest day key can be UTC-tomorrow; it must still count.
    const daily = [day("2026-07-09", { reviews: 1 }), day("2026-07-08", { reviews: 1 })];
    expect(computeStreak(daily, now).current).toBe(2);
  });

  it("ignores implausible far-future dates (can't anchor a forged streak)", () => {
    const daily = [day("2027-01-01", { reviews: 1 }), day("2026-12-31", { reviews: 1 })];
    expect(computeStreak(daily, now).current).toBe(0);
  });

  it("clamps an absurd back-dated run to the cap", () => {
    const daily = Array.from({ length: 900 }, (_, i) => day(new Date((Math.floor(now.getTime() / 86400000) - i) * 86400000).toISOString().slice(0, 10), { reviews: 1 }));
    const s = computeStreak(daily, now);
    expect(s.current).toBe(MAX_STREAK_DAYS);
    expect(s.longest).toBe(MAX_STREAK_DAYS);
  });
});

describe("weeklyMetrics", () => {
  const wk = mondayOf("2026-07-08");

  it("sums only the target week and clamps implausible values", () => {
    const daily = [
      day("2026-07-06", { reviews: 10, watchMin: 30, met: 5 }),
      day("2026-07-08", { reviews: 999999, watchMin: 20, met: 3 }), // absurd reviews
      day("2026-06-30", { reviews: 100, watchMin: 100 }), // previous week — excluded
    ];
    const m = weeklyMetrics(daily, wk);
    expect(m.minutes).toBe(50); // 30 + 20, prior week excluded
    expect(m.wordsMet).toBe(8);
    expect(m.wordsReviewed).toBe(MAX_WEEKLY_REVIEWS); // clamped
  });

  it("clamps minutes to a week's worth", () => {
    const daily = [day("2026-07-07", { watchMin: 999999 })];
    expect(weeklyMetrics(daily, wk).minutes).toBe(MAX_WEEKLY_MINUTES);
  });
});

describe("challengeProgress", () => {
  const reviewChallenge = CHALLENGES.find((c) => c.id === "weekly-reviews-50")!;

  it("marks done when the metric meets the target", () => {
    const p = challengeProgress(reviewChallenge, { wordsReviewed: 50, minutes: 0, wordsMet: 0 });
    expect(p.done).toBe(true);
    expect(p.current).toBe(50);
    expect(p.target).toBe(50);
  });

  it("is not done below target", () => {
    const p = challengeProgress(reviewChallenge, { wordsReviewed: 12, minutes: 0, wordsMet: 0 });
    expect(p.done).toBe(false);
    expect(p.current).toBe(12);
  });
});
