// Numbers for the Progress section (F7), all derived from the synced snapshot.
// Pure so the charts are unit tested and the component only draws.

import { computeStreak } from "./gamification";
import { pickDueReviews, type CloudDailyStats, type CloudSyncSnapshot, type CloudWordRecord } from "./sync";

/** The learner's local calendar day, the same key the extension buckets
 *  daily stats by (not the UTC date, which is a day off for half the world). */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface ProgressTiles {
  collected: number;
  known: number;
  learning: number;
  dueNow: number;
  streak: number;
  minutesWatched: number;
}

export function progressTiles(snapshot: CloudSyncSnapshot, now: Date): ProgressTiles {
  const words = snapshot.words;
  return {
    // Every word the account holds, matching the "collected" count on Today.
    collected: words.length,
    known: words.filter((w) => w.state === "known").length,
    learning: words.filter((w) => w.state === "learning").length,
    dueNow: pickDueReviews(snapshot, now, Infinity).length,
    streak: computeStreak(snapshot.daily, now).current,
    minutesWatched: Math.round(snapshot.daily.reduce((sum, d) => sum + (d.watchMin || 0), 0)),
  };
}

export interface ActivityDay {
  day: string;
  reviews: number;
  judged: number;
}

/** The last `days` local days, oldest first, with zeroes for days off so the
 *  bars keep a steady rhythm instead of collapsing the gaps. */
export function activitySeries(daily: CloudDailyStats[], now: Date, days = 30): ActivityDay[] {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const out: ActivityDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    // Step by calendar date, not by 24h, so a DST change can't skip or
    // repeat a day.
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const day = localDayKey(date);
    const row = byDay.get(day);
    out.push({ day, reviews: row?.reviews ?? 0, judged: row?.judged ?? 0 });
  }
  return out;
}

export interface StageBucket {
  stage: number;
  count: number;
}

/** Learning words by SRS stage 1-5. Stage 5 is one pass from known. */
export function stageBuckets(words: CloudWordRecord[]): StageBucket[] {
  const counts = [0, 0, 0, 0, 0];
  for (const w of words) {
    if (w.state !== "learning" || !w.review) continue;
    const stage = Math.min(5, Math.max(1, Math.round(w.review.stage) || 1));
    counts[stage - 1] += 1;
  }
  return counts.map((count, i) => ({ stage: i + 1, count }));
}

export interface StateSplit {
  known: number;
  learning: number;
  new: number;
}

/** Ignored words are left out: they are the learner saying "not for me", not
 *  a step on the way to known. */
export function stateSplit(words: CloudWordRecord[]): StateSplit {
  const split: StateSplit = { known: 0, learning: 0, new: 0 };
  for (const w of words) if (w.state !== "ignored") split[w.state] += 1;
  return split;
}

export interface ShowCount {
  title: string;
  count: number;
}

export function topShows(words: CloudWordRecord[], limit = 6): ShowCount[] {
  const counts = new Map<string, number>();
  for (const w of words) {
    const title = w.source?.title?.trim();
    if (!title || w.state === "ignored") continue;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export interface ProgressStats {
  tiles: ProgressTiles;
  activity: ActivityDay[];
  stages: StageBucket[];
  split: StateSplit;
  shows: ShowCount[];
}

export function computeProgressStats(snapshot: CloudSyncSnapshot, now: Date): ProgressStats {
  return {
    tiles: progressTiles(snapshot, now),
    activity: activitySeries(snapshot.daily, now),
    stages: stageBuckets(snapshot.words),
    split: stateSplit(snapshot.words),
    shows: topShows(snapshot.words),
  };
}
