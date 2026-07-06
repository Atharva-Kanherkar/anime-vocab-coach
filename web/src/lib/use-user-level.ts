"use client";

import { useMemo } from "react";
import { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
import { computeStreak } from "@/lib/gamification";
import { summarizeSyncSnapshot } from "@/lib/sync";
import { computeXp, levelState, type LevelState } from "@/lib/cards";

/** Player level, derived from the sync snapshot the same way everywhere. */
export function useUserLevel(): LevelState {
  const snapshot = useCloudSnapshot();
  return useMemo(() => {
    const summary = summarizeSyncSnapshot(snapshot);
    const streak = computeStreak(snapshot.daily, new Date());
    const xp = computeXp({
      totalWords: summary.totalWords,
      judgedCards: summary.judgedCards,
      watchMinutes: summary.watchMinutes,
      streakLongest: streak.longest,
    });
    return levelState(xp);
  }, [snapshot]);
}
