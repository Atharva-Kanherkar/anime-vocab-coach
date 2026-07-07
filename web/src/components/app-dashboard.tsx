"use client";

import { useMemo } from "react";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { GettingStarted } from "@/components/app/getting-started";
import { pickDueReviews, pickRecentWords, summarizeSyncSnapshot } from "@/lib/sync";
import { computeStreak } from "@/lib/gamification";
import { readingWithRomaji } from "@/lib/romaji";

// "Today" — the landing view. Speech-bubble word card + stamp rally + fresh
// catches. Falls back to onboarding when the account has no words yet.
export function AppDashboard({ name, onGo }: { name: string; onGo: (section: string) => void }) {
  const snapshot = useCloudSnapshot();
  const summary = useMemo(() => summarizeSyncSnapshot(snapshot), [snapshot]);
  const recentWords = useMemo(() => pickRecentWords(snapshot, 5), [snapshot]);
  const dueReviews = useMemo(() => pickDueReviews(snapshot, new Date(), 99), [snapshot]);
  const streak = useMemo(() => computeStreak(snapshot.daily, new Date()), [snapshot]);
  const hasData = summary.totalWords > 0;
  const hero = recentWords[0] ?? null;

  return (
    <div>
      <header>
        <p className="font-jpround text-[14px] font-black tracking-[0.3em] text-accent">おかえりなさい</p>
        <h1 className="mt-2 font-jpround text-[clamp(30px,4.5vw,46px)] font-black leading-[1.05]">
          Welcome back, {name}
        </h1>
        <p className="mt-3 text-[15.5px] text-ink2">
          {hasData ? (
            <>
              <b className="text-indigo">{dueReviews.length}</b>{" "}
              {dueReviews.length === 1 ? "word is" : "words are"} waiting for review · day{" "}
              <b className="text-indigo">{Math.max(streak.current, 0)}</b> of your rally ·{" "}
              {summary.totalWords.toLocaleString()} collected
            </>
          ) : (
            "AnimeVocab turns the anime you watch into vocabulary — words you save appear here, then come back as reviews, cards, manga, and an AI coach."
          )}
        </p>
      </header>

      {!hasData ? (
        <div className="mt-12">
          <GettingStarted />
        </div>
      ) : (
        <div className="mt-12 grid gap-x-14 gap-y-12 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            {hero && (
              <>
                <div className="av-bubble">
                  <p className="text-[11px] font-extrabold tracking-[0.2em] text-indigo">
                    {hero.source?.title ? `FROM ${hero.source.title.toUpperCase()}` : "FRESHLY CAUGHT"}
                  </p>
                  <p className="mt-3 font-jpround text-[clamp(44px,6vw,60px)] font-black leading-tight">
                    {hero.base}
                  </p>
                  {(hero.reading || hero.gloss) && (
                    <p className="mt-1.5 font-jpround text-[16px] font-bold text-ink2">
                      {readingWithRomaji(hero.reading)}
                      {hero.gloss ? ` — ${hero.gloss}` : ""}
                    </p>
                  )}
                  {hero.source?.line && (
                    <p className="mt-4 border-t border-dashed border-line pt-4 font-jp text-[14.5px] text-ink2">
                      {hero.source.line}
                      {hero.source.en ? ` — "${hero.source.en}"` : ""}
                    </p>
                  )}
                </div>
                <div className="mt-8 flex flex-wrap gap-2.5">
                  <button className="av-btn av-btn-primary" type="button" onClick={() => onGo("coach")}>
                    Ask the coach
                  </button>
                  <button className="av-btn av-btn-ghost" type="button" onClick={() => onGo("notebooks")}>
                    Notebooks
                  </button>
                  <button className="av-btn av-btn-quiet" type="button" onClick={() => onGo("cards")}>
                    My cards
                  </button>
                </div>
                <p className="mt-5 text-[13px] text-ink3">
                  {dueReviews.length > 0
                    ? `${dueReviews.length} reviews are queued in your extension popup — about 90 seconds while you watch.`
                    : "Reviews run in the extension popup while you watch. You're all caught up."}
                </p>
              </>
            )}
          </div>

          <div>
            <StampRally daily={snapshot.daily} />

            {recentWords.length > 1 && (
              <div className="mt-8">
                <h3 className="av-eyebrow">Fresh catches</h3>
                <ul className="mt-3">
                  {recentWords.slice(1).map((w) => (
                    <li
                      key={w.base}
                      className="flex items-baseline justify-between gap-4 border-b border-dashed border-line py-2.5 last:border-0"
                    >
                      <span className="font-jpround text-[18px] font-bold">{w.base}</span>
                      <span className="text-right text-[12.5px] text-ink3">
                        {[readingWithRomaji(w.reading), w.gloss, w.source?.title].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <FeatureTour onGo={onGo} />
    </div>
  );
}

const FEATURES: { section: string; kanji: string; title: string; body: string }[] = [
  { section: "coach", kanji: "師", title: "AI coach & chat", body: "Ask about any word from the exact scene it appeared in." },
  { section: "cards", kanji: "札", title: "Collect cards", body: "Level up as you learn and unlock 66 original character cards." },
  { section: "manga", kanji: "漫", title: "Read the saga", body: "A 12-chapter manga you unlock by learning — in JP, romaji, or EN." },
  { section: "notebooks", kanji: "帳", title: "Notebooks", body: "Group words and scenes by show, arc, or theme." },
  { section: "progress", kanji: "火", title: "Streaks & board", body: "Keep a daily rally going and climb the weekly leaderboard." },
  { section: "backup", kanji: "雲", title: "Cloud backup", body: "Your words sync across devices and export any time." },
];

function FeatureTour({ onGo }: { onGo: (section: string) => void }) {
  return (
    <section className="mt-14" aria-label="Explore AnimeVocab">
      <h3 className="av-eyebrow">Everything inside</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <button
            key={f.section}
            type="button"
            onClick={() => onGo(f.section)}
            className="av-card flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5"
          >
            <span className="font-jp text-2xl font-black text-accent leading-none">{f.kanji}</span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">{f.title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ink2">{f.body}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function StampRally({ daily }: { daily: { day: string; judged: number; reviews: number; watchMin: number }[] }) {
  const week = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const byDay = new Map(daily.map((d) => [d.day, d]));
    return DAY_LABELS.map((label, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const stats = byDay.get(key);
      const hit = !!stats && (stats.judged > 0 || stats.reviews > 0 || stats.watchMin > 0);
      const isToday = date.toDateString() === now.toDateString();
      return { label, hit, isToday, future: date > now && !isToday };
    });
  }, [daily]);

  const todayHit = week.find((d) => d.isToday)?.hit;
  const todayLabel = week.find((d) => d.isToday)?.label ?? "today";

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-indigo bg-panel">
      <div className="flex items-center justify-between bg-indigo px-4 py-2.5 text-[12px] font-extrabold tracking-[0.14em] text-bg">
        <span>STAMP RALLY</span>
        <span className="font-jpround tracking-[0.3em] opacity-85">スタンプラリー</span>
      </div>
      <div className="grid grid-cols-7 gap-2 px-4 pb-2 pt-4">
        {week.map((d) => (
          <div key={d.label} className={d.hit ? "av-stamp av-stamp-hit" : "av-stamp"}>
            {d.hit ? "済" : d.label}
          </div>
        ))}
      </div>
      <p className="px-4 pb-4 pt-1 text-[13px] text-ink2">
        {todayHit ? (
          <>
            <b className="text-accent">{todayLabel} is stamped.</b> Come back tomorrow to keep the
            rally alive.
          </>
        ) : (
          <>
            Practice today to stamp <b className="text-accent">{todayLabel}</b>. A full card is a new
            personal best.
          </>
        )}
      </p>
    </div>
  );
}
