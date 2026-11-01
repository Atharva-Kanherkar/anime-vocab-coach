import { claimOnce } from "./sync-store";
import { getPrefs, upsertEntry } from "./leaderboard-store";
import { computeStreak, currentWeekId, weeklyMetrics } from "./gamification";
import {
  latestActiveDay,
  newlyUnlockedCards,
  startedNewStreakDay,
} from "./learning-events";
import { authKindOf, recordUserEvent, requestFacts } from "./telemetry";
import type { CloudSyncSnapshot, CloudUserProfile } from "./sync";
/** A streak marker only has to outlive the day it names. */
const STREAK_MARKER_TTL_SECONDS = 60 * 60 * 48;
/** An unlock is permanent; a marker past AE's retention horizon is pointless. */
const UNLOCK_MARKER_TTL_SECONDS = 60 * 60 * 24 * 120;

/**
 * Emit `streak_day` and `card_unlocked` for what this sync changed.
 *
 * Every extension push lands here, so two things keep this from being one row
 * per sync. The diff in learning-events.ts is the first: a streak day needs
 * the latest ACTIVE day to advance, an unlock needs a level gate to be
 * crossed. A KV marker is the second, because the diff alone is decided from a
 * snapshot two concurrent syncs can both have read — see claimOnce, which
 * explains what that does and does not guarantee.
 */
export async function recordProgressEvents(
  req: Request,
  profile: CloudUserProfile,
  before: CloudSyncSnapshot | null,
  after: CloudSyncSnapshot,
): Promise<void> {
  const now = new Date();
  const facts = requestFacts(req);
  const base = {
    kind: "feature" as const,
    userId: profile.id,
    plan: profile.plan,
    country: facts.country,
    city: facts.city,
    device: facts.device,
    authKind: authKindOf(req),
    status: "ok",
  };

  if (startedNewStreakDay(before, after)) {
    const day = latestActiveDay(after);
    if (
      day &&
      (await claimOnce(
        `once:streak_day:${profile.id}:${day}`,
        STREAK_MARKER_TTL_SECONDS,
      ))
    ) {
      await recordUserEvent({ ...base, name: "streak_day" });
    }
  }

  // One row per card so the panel counts cards, not level-ups: a single sync
  // that crosses two gates unlocked two cards, and collapsing that would
  // under-report exactly the learners who came back after a long break. Each
  // card is claimed by id, so a snapshot that regresses and re-advances does
  // not report the same unlock twice.
  for (const cardId of newlyUnlockedCards(before, after, now)) {
    if (
      await claimOnce(
        `once:card_unlocked:${profile.id}:${cardId}`,
        UNLOCK_MARKER_TTL_SECONDS,
      )
    ) {
      await recordUserEvent({ ...base, name: "card_unlocked" });
    }
  }
}

// Anonymous-by-default display name derived from the user id (no PII leaked).
function anonName(userId: string): string {
  return `Learner-${userId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .padStart(4, "0")}`;
}

export async function updateLeaderboard(
  profile: CloudUserProfile,
  snapshot: CloudSyncSnapshot,
): Promise<void> {
  const now = new Date();
  const week = currentWeekId(now);
  const metrics = weeklyMetrics(snapshot.daily, week);
  const streak = computeStreak(snapshot.daily, now).current;
  const prefs = await getPrefs(profile.id);
  const name = prefs.displayName || anonName(profile.id);
  await upsertEntry(
    week,
    {
      userId: profile.id,
      name,
      wordsReviewed: metrics.wordsReviewed,
      minutes: metrics.minutes,
      streak,
      updatedAt: now.toISOString(),
    },
    prefs.optOut,
  );
}
