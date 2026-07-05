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
      // Streak + challenges come from the caller's own synced snapshot.
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
    <section className="cloud-panel" aria-label="Streaks, challenges, and leaderboard">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Momentum</p>
          <h2>Streaks, challenges & the weekly board</h2>
        </div>
        {streak && (
          <span className="status-pill" title="Consecutive days reviewing or watching">
            🔥 {streak.current}-day streak{streak.longest > streak.current ? ` · best ${streak.longest}` : ""}
          </span>
        )}
      </div>

      {!hasData && (
        <p className="sync-message">
          Sync your progress to light up your streak, take on weekly challenges, and join the leaderboard.
          It all rewards real practice — reviews and minutes watched, never vanity metrics.
        </p>
      )}

      {challenges.length > 0 && (
        <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
          {challenges.map((c) => (
            <div key={c.id} style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{c.title}</strong>
                <span className="eyebrow">{c.done ? "✅ done" : `${c.current}/${c.target}`}</span>
              </div>
              <div style={{ opacity: 0.75, fontSize: 14 }}>{c.description}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ margin: "12px 0" }}>
        <p className="eyebrow">This week&apos;s leaderboard · words reviewed</p>
        {board === null ? (
          <p className="sync-message">Loading…</p>
        ) : board.length === 0 ? (
          <p className="sync-message">No one&apos;s on the board yet this week. Review some words to be first.</p>
        ) : (
          <ol style={{ margin: "8px 0", paddingLeft: 20 }}>
            {board.map((e, i) => (
              <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{e.name}</span>
                <span className="eyebrow">{e.wordsReviewed} reviewed · {e.minutes}m · 🔥{e.streak}</span>
              </li>
            ))}
          </ol>
        )}
        {me && <p className="sync-message">Your rank this week: #{me.rank} ({me.wordsReviewed} reviewed).</p>}
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <p className="eyebrow">Privacy</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            aria-label="Display name"
            placeholder="Display name (blank = anonymous)"
            value={prefs.displayName}
            onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
            disabled={prefs.optOut}
            style={{ flex: 1, minWidth: 180 }}
          />
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={prefs.optOut} onChange={(e) => setPrefs({ ...prefs, optOut: e.target.checked })} />
            Leave the leaderboard (local-only)
          </label>
          <button className="btn btn-line btn-sm" type="button" onClick={savePrefs}>Save</button>
        </div>
        {saved && <p className="sync-message">Saved. Opting out removes you now; a new name shows on your next sync.</p>}
        {saveError && <p className="sync-message" role="alert">Couldn&apos;t save your privacy settings. Try again.</p>}
        <p className="sync-message" style={{ opacity: 0.7 }}>
          Only words reviewed, minutes watched, and streak length count. Watched titles are never shared.
        </p>
      </div>
    </section>
  );
}
