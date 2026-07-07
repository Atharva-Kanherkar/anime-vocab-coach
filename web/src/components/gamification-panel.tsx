"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHALLENGES,
  challengeProgress,
  computeStreak,
  currentWeekId,
  weeklyMetrics,
  type ChallengeProgress,
  type Streak,
} from "@/lib/gamification";
import type { CloudDailyStats } from "@/lib/sync";

interface BoardEntry {
  name: string;
  wordsReviewed: number;
  minutes: number;
  streak: number;
}
interface Me extends BoardEntry {
  rank: number;
}

export function GamificationPanel() {
  const [streak, setStreak] = useState<Streak | null>(null);
  const [challenges, setChallenges] = useState<ChallengeProgress[]>([]);
  const [hasData, setHasData] = useState(false);
  const [board, setBoard] = useState<BoardEntry[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [prefs, setPrefs] = useState({ displayName: "", optOut: false });
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const snapRes = await fetch("/api/sync/snapshot");
      if (snapRes.ok) {
        const data = (await snapRes.json()) as { envelope?: { snapshot?: { daily?: CloudDailyStats[] } } };
        const daily = data.envelope?.snapshot?.daily ?? [];
        setHasData(daily.length > 0);
        const now = new Date();
        setStreak(computeStreak(daily, now));
        const metrics = weeklyMetrics(daily, currentWeekId(now));
        setChallenges(CHALLENGES.map((c) => challengeProgress(c, metrics)));
      }
      const [boardRes, prefsRes] = await Promise.all([
        fetch("/api/leaderboard"),
        fetch("/api/leaderboard/prefs"),
      ]);
      if (boardRes.ok) {
        const b = (await boardRes.json()) as { entries: BoardEntry[]; me: Me | null };
        setBoard(b.entries);
        setMe(b.me);
      }
      if (prefsRes.ok) {
        const p = (await prefsRes.json()) as { prefs: { displayName: string; optOut: boolean } };
        setPrefs(p.prefs);
      }
    } catch {
      /* leave panels in their empty state */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const [saveError, setSaveError] = useState(false);
  const savePrefs = useCallback(async () => {
    setSaved(false);
    setSaveError(false);
    try {
      const res = await fetch("/api/leaderboard/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        setSaved(true);
        load();
      } else {
        setSaveError(true);
      }
    } catch {
      setSaveError(true);
    }
  }, [prefs, load]);

  return (
    <section className="av-card p-6 sm:p-8" aria-label="Streaks and leaderboard">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Progress</p>
        <h2 className="mt-1.5 font-serif text-2xl font-medium">Streaks &amp; weekly challenges</h2>
        {streak && streak.current > 0 && (
          <p className="mt-1.5 text-sm text-ink2">
            {streak.current}-day streak
            {streak.longest > streak.current ? ` · personal best ${streak.longest}` : ""}
          </p>
        )}
      </div>

      {!hasData && (
        <p className="text-sm text-ink2">
          Sync your progress to unlock streaks and weekly challenges. They track real practice — reviews and watch
          time, not vanity clicks.
        </p>
      )}

      {challenges.length > 0 && (
        <div className="grid gap-2.5">
          {challenges.map((c) => (
            <div
              key={c.id}
              className={
                "rounded-xl border p-3.5 " + (c.done ? "border-ok/40 bg-ok/5" : "border-line bg-surface-2/30")
              }
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <strong className="text-[15px] font-semibold">{c.title}</strong>
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink3">
                  {c.done ? "Done" : `${c.current}/${c.target}`}
                </span>
              </div>
              <p className="text-sm text-ink2">{c.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="mb-3 font-serif text-lg font-medium">This week&apos;s board</h3>
        {board === null ? (
          <p className="text-sm text-ink2">Loading…</p>
        ) : board.length === 0 ? (
          <p className="text-sm text-ink2">No one on the board yet. Review some words to be first.</p>
        ) : (
          <ol className="flex list-none flex-col pl-0">
            {board.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                <span className="flex items-center gap-2.5 font-medium">
                  <span className="w-5 text-ink3 tabular-nums">{i + 1}</span>
                  {e.name}
                </span>
                <span className="whitespace-nowrap text-xs text-ink3">
                  {e.wordsReviewed} reviewed · {e.minutes}m · {e.streak}d streak
                </span>
              </li>
            ))}
          </ol>
        )}
        {me && (
          <p className="mt-3 text-sm text-ink2">
            You&apos;re #{me.rank} this week ({me.wordsReviewed} reviewed).
          </p>
        )}
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="mb-3 font-serif text-lg font-medium">Leaderboard privacy</h3>
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="av-input flex-1"
            aria-label="Display name"
            placeholder="Display name (blank = anonymous)"
            value={prefs.displayName}
            onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
            disabled={prefs.optOut}
          />
          <label className="flex items-center gap-2 text-sm text-ink2">
            <input
              type="checkbox"
              checked={prefs.optOut}
              onChange={(e) => setPrefs({ ...prefs, optOut: e.target.checked })}
              className="accent-[var(--av-accent)]"
            />
            Hide me from the board
          </label>
          <button className="av-btn av-btn-ghost av-btn-sm" type="button" onClick={savePrefs}>
            Save
          </button>
        </div>
        {saved && <p className="mt-2 text-sm text-ink2">Saved.</p>}
        {saveError && (
          <p className="mt-2 text-sm text-danger" role="alert">
            Couldn&apos;t save. Try again.
          </p>
        )}
        <p className="mt-2 text-[13px] text-ink3">
          Only review count, watch minutes, and streak are shared — never what you watched.
        </p>
      </div>
    </section>
  );
}
