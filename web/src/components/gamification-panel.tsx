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
    <section className="cloud-panel" aria-label="Streaks and leaderboard">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Progress</p>
          <h2>Streaks & weekly challenges</h2>
          {streak && streak.current > 0 && (
            <p className="panel-lede">
              🔥 {streak.current}-day streak
              {streak.longest > streak.current ? ` · personal best ${streak.longest}` : ""}
            </p>
          )}
        </div>
      </div>

      {!hasData && (
        <p className="sync-message">
          Sync your progress to unlock streaks and weekly challenges. They track real practice — reviews and watch
          time, not vanity clicks.
        </p>
      )}

      {challenges.length > 0 && (
        <div className="challenge-list">
          {challenges.map((c) => (
            <div key={c.id} className={`challenge-card${c.done ? " challenge-card--done" : ""}`}>
              <div className="challenge-card__head">
                <strong>{c.title}</strong>
                <span className="eyebrow">{c.done ? "Done" : `${c.current}/${c.target}`}</span>
              </div>
              <p>{c.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="leaderboard-block">
        <h3>This week&apos;s board</h3>
        {board === null ? (
          <p className="sync-message">Loading…</p>
        ) : board.length === 0 ? (
          <p className="sync-message">No one on the board yet. Review some words to be first.</p>
        ) : (
          <ol className="leaderboard-list">
            {board.map((e, i) => (
              <li key={i}>
                <span className="leaderboard-list__name">{e.name}</span>
                <span className="leaderboard-list__stats">
                  {e.wordsReviewed} reviewed · {e.minutes}m · 🔥{e.streak}
                </span>
              </li>
            ))}
          </ol>
        )}
        {me && (
          <p className="sync-message">
            You&apos;re #{me.rank} this week ({me.wordsReviewed} reviewed).
          </p>
        )}
      </div>

      <div className="privacy-block">
        <h3>Leaderboard privacy</h3>
        <div className="privacy-row">
          <input
            className="app-input"
            aria-label="Display name"
            placeholder="Display name (blank = anonymous)"
            value={prefs.displayName}
            onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
            disabled={prefs.optOut}
          />
          <label className="privacy-check">
            <input type="checkbox" checked={prefs.optOut} onChange={(e) => setPrefs({ ...prefs, optOut: e.target.checked })} />
            Hide me from the board
          </label>
          <button className="btn btn-line btn-sm" type="button" onClick={savePrefs}>
            Save
          </button>
        </div>
        {saved && <p className="sync-message">Saved.</p>}
        {saveError && (
          <p className="sync-message" role="alert">
            Couldn&apos;t save. Try again.
          </p>
        )}
        <p className="sync-note">Only review count, watch minutes, and streak are shared — never what you watched.</p>
      </div>
    </section>
  );
}
