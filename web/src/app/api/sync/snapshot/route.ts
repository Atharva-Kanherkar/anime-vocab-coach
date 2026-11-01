import { NextResponse } from "next/server";
import { claimOnce } from "@/lib/sync-store";
import { resolveProfile } from "@/lib/auth";
import { getLearnStore, getLearnEnvelope, snapshotImportOps } from "@/lib/learn-server";
import { learnBody, learnFailure } from "@/lib/learn-http";
import { getPrefs, upsertEntry } from "@/lib/leaderboard-store";
import { computeStreak, currentWeekId, weeklyMetrics } from "@/lib/gamification";
import { latestActiveDay, newlyUnlockedCards, startedNewStreakDay } from "@/lib/learning-events";
import { authKindOf, recordUserEvent, requestFacts } from "@/lib/telemetry";
import { normalizeAnimeVocabExport, normalizeCloudSyncSnapshot, type CloudSyncSnapshot, type CloudUserProfile } from "@/lib/sync";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({error:"unauthorized"},{status:401});
  try { return NextResponse.json({envelope:await getLearnEnvelope(profile),profile},{headers:{"Cache-Control":"private, no-store"}}); }
  catch(err) { return learnFailure(err); }
}
/** Legacy uploads are insert-only imports. They can never replace cloud SRS or settings. */
export async function PUT(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({error:"unauthorized"},{status:401});
  try {
    const body = await learnBody(req,1_000_000);
    if (!body.export && !body.snapshot) return NextResponse.json({error:"invalid_snapshot"},{status:400});
    const snapshot = body.export ? normalizeAnimeVocabExport(body.export) : normalizeCloudSyncSnapshot(body.snapshot);
    if (snapshot.words.length>20000 || snapshot.daily.length>5000) return NextResponse.json({error:"snapshot_too_large"},{status:413});
    const store = await getLearnStore(profile.id);
    const before = await getLearnEnvelope(profile);
    const ops = snapshotImportOps(snapshot,crypto.randomUUID());
    for (let i=0;i<ops.length;i+=50) await store.apply(ops.slice(i,i+50));
    const envelope = await getLearnEnvelope(profile);
    await updateLeaderboard(profile,envelope.snapshot).catch(err=>console.error("[learn] leaderboard",err));
    await recordProgressEvents(req,profile,before.snapshot,envelope.snapshot).catch(err=>console.error("[learn] progress",err));
    return NextResponse.json({envelope});
  } catch(err) { return learnFailure(err); }
}

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
async function recordProgressEvents(
  req: Request,
  profile: CloudUserProfile,
  before: CloudSyncSnapshot | null,
  after: CloudSyncSnapshot
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
    if (day && (await claimOnce(`once:streak_day:${profile.id}:${day}`, STREAK_MARKER_TTL_SECONDS))) {
      await recordUserEvent({ ...base, name: "streak_day" });
    }
  }

  // One row per card so the panel counts cards, not level-ups: a single sync
  // that crosses two gates unlocked two cards, and collapsing that would
  // under-report exactly the learners who came back after a long break. Each
  // card is claimed by id, so a snapshot that regresses and re-advances does
  // not report the same unlock twice.
  for (const cardId of newlyUnlockedCards(before, after, now)) {
    if (await claimOnce(`once:card_unlocked:${profile.id}:${cardId}`, UNLOCK_MARKER_TTL_SECONDS)) {
      await recordUserEvent({ ...base, name: "card_unlocked" });
    }
  }
}

// Anonymous-by-default display name derived from the user id (no PII leaked).
function anonName(userId: string): string {
  return `Learner-${userId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).padStart(4, "0")}`;
}

async function updateLeaderboard(profile: CloudUserProfile, snapshot: CloudSyncSnapshot): Promise<void> {
  const now = new Date();
  const week = currentWeekId(now);
  const metrics = weeklyMetrics(snapshot.daily, week);
  const streak = computeStreak(snapshot.daily, now).current;
  const prefs = await getPrefs(profile.id);
  const name = prefs.displayName || anonName(profile.id);
  await upsertEntry(
    week,
    { userId: profile.id, name, wordsReviewed: metrics.wordsReviewed, minutes: metrics.minutes, streak, updatedAt: now.toISOString() },
    prefs.optOut
  );
}
