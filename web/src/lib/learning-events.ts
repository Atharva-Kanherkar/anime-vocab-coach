// The two learning-loop events the server is the only honest source for (#111).
//
// `card_shown` / `card_learn` / `review_done` are moments the extension lives
// through, so it fires those itself. `streak_day` and `card_unlocked` are not
// moments at all — they are *derived*: a streak day exists because a day's
// stats crossed the activity bar, and a card unlocks because accumulated XP
// crossed a level gate. A client firing those would be reporting a score it
// computed about itself, which is the thing the sync route deliberately does
// not trust (see gamification.ts). Both are therefore derived here, on the
// server, by diffing the snapshot being written against the one it replaces.
//
// Pure functions with an explicit `now`, so the rules are unit-testable without
// KV, Clerk, or a clock.

import { CARDS, computeXp, levelState } from "./cards";
import { computeStreak, isActiveDay } from "./gamification";
import { summarizeSyncSnapshot, type CloudSyncSnapshot } from "./sync";

/** The most recent day the learner did anything, as `YYYY-MM-DD`. */
export function latestActiveDay(snapshot: CloudSyncSnapshot | null): string | null {
  if (!snapshot) return null;
  let latest: string | null = null;
  for (const day of snapshot.daily) {
    if (!isActiveDay(day)) continue;
    if (!latest || day.day > latest) latest = day.day;
  }
  return latest;
}

/**
 * Did this sync carry the learner's first qualifying activity of a new day?
 *
 * Deliberately not "did `computeStreak().current` go up": that number also
 * moves when an old day is back-filled and resets to 1 after a break, so it
 * answers a different question. A new latest active day is exactly one
 * `streak_day` per learner per day, which is what the weekly habit metric
 * needs as its denominator.
 */
export function startedNewStreakDay(
  before: CloudSyncSnapshot | null,
  after: CloudSyncSnapshot
): boolean {
  const next = latestActiveDay(after);
  if (!next) return false;
  const prev = latestActiveDay(before);
  return prev === null || next > prev;
}

/**
 * Player level implied by a snapshot.
 *
 * Extension progress only: the web app adds Manga Studio XP on top, which
 * lives in browser-local state the sync route never sees. So this is a lower
 * bound on the learner's real level, and `card_unlocked` counted from it is an
 * undercount rather than a fabrication — the safer direction for a metric
 * whose whole purpose is to stop guessing.
 */
export function snapshotLevel(snapshot: CloudSyncSnapshot | null, now: Date): number {
  if (!snapshot) return 0;
  const summary = summarizeSyncSnapshot(snapshot, now);
  const streak = computeStreak(snapshot.daily, now);
  return levelState(
    computeXp({
      totalWords: summary.totalWords,
      judgedCards: summary.judgedCards,
      watchMinutes: summary.watchMinutes,
      streakLongest: streak.longest,
    })
  ).level;
}

/**
 * How many collectible cards this sync unlocked.
 *
 * Zero for a first-ever snapshot even though level 1 technically unlocks a
 * card: an import of existing progress is not an unlock the learner
 * experienced, and counting it would put a spike on the panel for every
 * migrating install.
 */
export function newlyUnlockedCards(
  before: CloudSyncSnapshot | null,
  after: CloudSyncSnapshot,
  now: Date
): number {
  if (!before) return 0;
  const from = snapshotLevel(before, now);
  const to = snapshotLevel(after, now);
  if (to <= from) return 0;
  return CARDS.filter((card) => card.level > from && card.level <= to).length;
}
