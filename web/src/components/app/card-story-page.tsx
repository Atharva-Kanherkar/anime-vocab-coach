"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
import { CARD_ART } from "@/lib/cards-art";
import {
  LUMINARA_THREAD_INTRO,
  STORY_LANGS,
  mentionedCards,
  type CardStory,
  type StoryLang,
} from "@/lib/card-stories";
import { computeStreak } from "@/lib/gamification";
import { summarizeSyncSnapshot } from "@/lib/sync";
import {
  RARITY_LABEL,
  RARITY_STARS,
  STYLE_FAMILIES,
  computeXp,
  levelState,
  type CardDef,
} from "@/lib/cards";

export function CardStoryPage({
  card,
  story,
  owner = false,
}: {
  card: CardDef;
  story: CardStory;
  owner?: boolean;
}) {
  const [lang, setLang] = useState<StoryLang>("en");
  const snapshot = useCloudSnapshot();
  const userLevel = useMemo(() => {
    const summary = summarizeSyncSnapshot(snapshot);
    const streak = computeStreak(snapshot.daily, new Date());
    const xp = computeXp({
      totalWords: summary.totalWords,
      judgedCards: summary.judgedCards,
      watchMinutes: summary.watchMinutes,
      streakLongest: streak.longest,
    });
    return levelState(xp).level;
  }, [snapshot]);
  const locked = !owner && card.level > userLevel;

  const art = card.art ?? CARD_ART[card.id];
  const linked = mentionedCards(story);

  if (locked) {
    return (
      <article className="pb-16">
        <Link
          href="/app#cards"
          className="inline-flex items-center gap-2 text-[13px] font-extrabold text-ink2 hover:text-ink"
        >
          ← Back to cards
        </Link>
        <div className="av-card mt-8 p-8 text-center">
          <p className="av-eyebrow">Locked · 未解放</p>
          <h1 className="mt-3 font-jpround text-2xl font-black">{card.name}</h1>
          <p className="mt-2 text-[15px] text-ink2">
            Reach level {card.level} to read this Listener&apos;s origin on the Luminara Thread.
          </p>
          <Link href="/app#cards" className="av-btn av-btn-primary mt-6 inline-flex">
            View your collection
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="pb-16">
      <Link
        href="/app#cards"
        className="inline-flex items-center gap-2 text-[13px] font-extrabold text-ink2 hover:text-ink"
      >
        ← Back to cards
      </Link>

      <header className="mt-6 grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
        <div className="mx-auto w-full max-w-[220px] md:mx-0">
          <CardPreview card={card} art={art} />
        </div>
        <div>
          <p className="av-eyebrow">Origin · 来歴</p>
          <h1 className="mt-2 font-jpround text-[clamp(28px,4vw,42px)] font-black leading-tight">
            {card.name}
          </h1>
          <p className="mt-1 font-jpround text-lg font-bold text-ink2">{card.epithet}</p>
          <p className="mt-3 text-sm text-ink2">
            <span className="font-jpround text-xl font-black text-ink">{card.kanji}</span>
            <span className="ml-2 font-jp text-ink3">{card.reading}</span>
            <span className="mx-2 text-ink3">·</span>
            {STYLE_FAMILIES[card.style].label} · {RARITY_LABEL[card.rarity]}
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-ink2">
            <span className="font-extrabold text-indigo">{story.originPlace}</span>
            {lang === "ja" ? `（${story.originPlaceJa}）` : lang === "en" ? ` (${story.originPlaceJa})` : ""}
          </p>
        </div>
      </header>

      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Story language">
        {STORY_LANGS.map(({ id, label }) => {
          const active = lang === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setLang(id)}
              className={
                "rounded-full border-2 px-4 py-1.5 text-[12px] font-extrabold transition " +
                (active ? "border-ink bg-ink text-bg" : "border-line text-ink2 hover:text-ink")
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <section className="av-card mt-6 p-6 sm:p-8">
        <p className="av-eyebrow">The Luminara Thread · ルミナラの糸</p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink2 whitespace-pre-line">
          {LUMINARA_THREAD_INTRO[lang]}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="av-eyebrow">Origin story</h2>
        <div className="av-bubble mt-4 !p-6 sm:!p-8">
          <p className="text-[15px] leading-[1.75] text-ink2 whitespace-pre-line font-[inherit]">
            {story.body[lang]}
          </p>
        </div>
        <p className="mt-4 text-[13px] text-ink3 italic">
          {lang === "ja" ? story.whyItMattersJa : story.whyItMatters}
        </p>
      </section>

      {linked.length > 0 && (
        <section className="mt-10">
          <h2 className="av-eyebrow">Others in this thread</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {linked.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/cards/${c.id}`}
                  className="av-btn av-btn-ghost av-btn-sm !px-3"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function CardPreview({ card, art }: { card: CardDef; art?: string }) {
  const inverted = card.rarity === "UR";
  return (
    <article className={`av-tcg ${inverted ? "bg-ink text-bg" : ""}`}>
      <header
        className={
          "flex items-center justify-between px-3 py-1.5 text-[10px] font-extrabold tracking-wide " +
          (inverted ? "bg-bg text-ink" : "bg-ink text-bg")
        }
      >
        <span>{card.name.toUpperCase()}</span>
        <span>{"★".repeat(RARITY_STARS[card.rarity])}</span>
      </header>
      {art ? (
        <div className="relative aspect-[5/7]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art} alt={card.name} className="absolute inset-0 h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[5/7] items-center justify-center av-dots">
          <span className="font-jpround text-5xl font-black">{card.kanji}</span>
        </div>
      )}
    </article>
  );
}
