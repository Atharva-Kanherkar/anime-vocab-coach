"use client";

import { useMemo } from "react";
import { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
import { computeStreak } from "@/lib/gamification";
import { summarizeSyncSnapshot } from "@/lib/sync";
import { computeXp, levelState, type LevelState } from "@/lib/cards";
import { studioXp, useStudioProgress } from "@/lib/studio-xp";

/** Player level, derived from the sync snapshot the same way everywhere,
 * plus web-earned XP (Manga Studio creations, chapters read, word checks) so
 * chapters and cards unlock without the extension. */
export function useUserLevel(): LevelState {
  const snapshot = useCloudSnapshot();
  const progress = useStudioProgress();
  return useMemo(() => {
    const summary = summarizeSyncSnapshot(snapshot);
    const streak = computeStreak(snapshot.daily, new Date());
    const xp = computeXp({
      totalWords: summary.totalWords,
      judgedCards: summary.judgedCards,
      watchMinutes: summary.watchMinutes,
      streakLongest: streak.longest,
    });
    return levelState(xp + studioXp(progress));
  }, [snapshot, progress]);
}
