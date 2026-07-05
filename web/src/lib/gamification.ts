// Streaks, weekly metrics, and challenges (issue #17). All derived from the
// learner's already-synced daily stats, so the server never trusts a
// client-supplied score — leaderboard numbers are computed here from the same
// validated snapshot, which is the anti-cheat story. Pure + unit tested.

import type { CloudDailyStats } from "./sync";

const DAY_MS = 86_400_000;

/** A day counts toward a streak if the learner reviewed, judged, or watched. */
export function isActiveDay(d: CloudDailyStats): boolean {
  return (d.reviews || 0) > 0 || (d.judged || 0) > 0 || (d.watchMin || 0) > 0;
}

function dayNumber(dayIso: string): number | null {
  const ts = Date.parse(`${dayIso}T00:00:00Z`);
  return Number.isFinite(ts) ? Math.floor(ts / DAY_MS) : null;
}

/** Monday (UTC) of the week containing `dayIso`, as YYYY-MM-DD. Week buckets. */
export function mondayOf(dayIso: string): string {
  const n = dayNumber(dayIso);
  if (n === null) return dayIso;
  const dow = new Date(n * DAY_MS).getUTCDay(); // 0=Sun..6=Sat
  const monday = n - ((dow + 6) % 7);
  return new Date(monday * DAY_MS).toISOString().slice(0, 10);
}

export function currentWeekId(now: Date): string {
  return mondayOf(now.toISOString().slice(0, 10));
}

export interface Streak {
  current: number;
  longest: number;
}

/**
 * Current streak = consecutive active days ending today or yesterday (a day
 * isn't "missed" until it fully passes). Longest = best run ever.
 */
export function computeStreak(daily: CloudDailyStats[], now: Date): Streak {
  const active = new Set<number>();
  for (const d of daily) {
    if (!isActiveDay(d)) continue;
    const n = dayNumber(d.day);
    if (n !== null) active.add(n);
  }
  if (active.size === 0) return { current: 0, longest: 0 };

  const today = Math.floor(now.getTime() / DAY_MS);

  // Current: anchor at today if active, else yesterday, else broken.
  let current = 0;
  let anchor = active.has(today) ? today : active.has(today - 1) ? today - 1 : null;
  if (anchor !== null) {
    while (active.has(anchor)) {
      current++;
      anchor--;
    }
  }

  // Longest: scan sorted day numbers for the longest consecutive run.
  const sorted = [...active].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  return { current, longest };
}

export interface WeeklyMetrics {
  wordsReviewed: number;
  minutes: number;
  wordsMet: number;
}

// Plausible ceilings — a week has 10,080 minutes; nobody legitimately reviews
// tens of thousands of words a week. Clamp before anything hits a leaderboard.
export const MAX_WEEKLY_REVIEWS = 5000;
export const MAX_WEEKLY_MINUTES = 7 * 24 * 60;
export const MAX_WEEKLY_MET = 5000;

/** Sum a learner's activity for the week bucket `weekMonday` (YYYY-MM-DD). */
export function weeklyMetrics(daily: CloudDailyStats[], weekMonday: string): WeeklyMetrics {
  let wordsReviewed = 0;
  let minutes = 0;
  let wordsMet = 0;
  for (const d of daily) {
    if (mondayOf(d.day) !== weekMonday) continue;
    wordsReviewed += Math.max(0, d.reviews || 0);
    minutes += Math.max(0, d.watchMin || 0);
    wordsMet += Math.max(0, d.met || 0);
  }
  return {
    wordsReviewed: Math.min(wordsReviewed, MAX_WEEKLY_REVIEWS),
    minutes: Math.min(minutes, MAX_WEEKLY_MINUTES),
    wordsMet: Math.min(wordsMet, MAX_WEEKLY_MET),
  };
}

export type ChallengeMetric = "wordsReviewed" | "minutes" | "wordsMet";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  period: "week";
}

// First shipped challenge type. Anime-specific arc challenges (issue idea) build
// on the same shape once per-title stats sync.
export const CHALLENGES: Challenge[] = [
  {
    id: "weekly-reviews-50",
    title: "Weekly reviewer",
    description: "Review 50 words this week",
    metric: "wordsReviewed",
    target: 50,
    period: "week",
  },
  {
    id: "weekly-minutes-120",
    title: "Two hours of immersion",
    description: "Watch 120 minutes of Japanese this week",
    metric: "minutes",
    target: 120,
    period: "week",
  },
];

export interface ChallengeProgress {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  done: boolean;
}

export function challengeProgress(challenge: Challenge, metrics: WeeklyMetrics): ChallengeProgress {
  const current = metrics[challenge.metric];
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    current,
    target: challenge.target,
    done: current >= challenge.target,
  };
}
