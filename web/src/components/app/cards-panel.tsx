"use client";

import { useEffect, useMemo, useState } from "react";
import { useCloudSnapshot } from "@/components/cloud-sync-panel";
import { computeStreak } from "@/lib/gamification";
import { summarizeSyncSnapshot } from "@/lib/sync";
import {
  CARDS,
  RARITY_LABEL,
  RARITY_STARS,
  STYLE_FAMILIES,
  computeXp,
  levelState,
  nextUnlock,
  type CardDef,
} from "@/lib/cards";
import { CARD_ART } from "@/lib/cards-art";

export function CardsPanel({ owner = false }: { owner?: boolean }) {
  const snapshot = useCloudSnapshot();
  const { lvl, next } = useMemo(() => {
    const summary = summarizeSyncSnapshot(snapshot);
    const streak = computeStreak(snapshot.daily, new Date());
    const xp = computeXp({
      totalWords: summary.totalWords,
      judgedCards: summary.judgedCards,
      watchMinutes: summary.watchMinutes,
      streakLongest: streak.longest,
    });
    const lvl = levelState(xp);
    return { lvl, next: nextUnlock(lvl.level) };
  }, [snapshot]);

  // Owners preview the whole set regardless of XP.
  const unlockedThrough = owner ? Infinity : lvl.level;
  const owned = owner ? CARDS.length : CARDS.filter((c) => c.level <= lvl.level).length;
  const pct = Math.min(100, Math.round((lvl.intoLevel / lvl.forNext) * 100));
  const [open, setOpen] = useState<CardDef | null>(null);

  return (
    <section aria-label="Card collection">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="av-eyebrow">Card collection · カード</p>
          <h1 className="mt-2 font-jpround text-[clamp(28px,4vw,40px)] font-black leading-tight">
            {lvl.rankKanji} <span className="text-ink2">·</span> {lvl.rankName}
          </h1>
          <p className="mt-2 text-[15px] text-ink2">
            {owner
              ? `Owner preview · all ${CARDS.length} cards unlocked`
              : `Level ${lvl.level} · ${owned} of ${CARDS.length} cards collected${next ? ` · next card at level ${next.level}` : " · full set!"}`}
          </p>
        </div>
        <div className="w-full max-w-[260px]">
          <div className="flex justify-between text-xs font-bold text-ink3">
            <span>LV {lvl.level}</span>
            <span>{lvl.level >= 50 ? "MAX" : `LV ${lvl.level + 1}`}</span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-ink">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-ink3">
            {lvl.intoLevel.toLocaleString()} / {lvl.forNext.toLocaleString()} XP — earn XP by saving
            words, reviewing, and keeping your rally going.
          </p>
        </div>
      </div>

      <ul className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {CARDS.map((card) => (
          <li key={card.id}>
            {card.level <= unlockedThrough ? (
              <button
                type="button"
                onClick={() => setOpen(card)}
                aria-label={`Open ${card.name}`}
                className="block w-full cursor-pointer text-left transition hover:-translate-y-1"
              >
                <Card card={card} />
              </button>
            ) : (
              <LockedCard card={card} />
            )}
          </li>
        ))}
      </ul>

      {open && <CardModal card={open} onClose={() => setOpen(null)} />}

      <p className="mt-8 text-[13px] text-ink3">
        Placeholder art for now — original characters, real illustrated cards are on the way. Your
        collection is computed from your practice, so it follows your backup everywhere.
      </p>
    </section>
  );
}

const RARITY_FRAME: Record<CardDef["rarity"], string> = {
  N: "",
  R: "border-indigo",
  SR: "border-accent",
  SSR: "border-accent",
  UR: "border-ink",
};

function Card({ card }: { card: CardDef }) {
  const inverted = card.rarity === "UR";
  const art = card.art ?? CARD_ART[card.id];
  return (
    <article className={`av-tcg ${RARITY_FRAME[card.rarity]} ${inverted ? "bg-ink text-bg" : ""}`}>
      <header
        className={
          "flex items-center justify-between px-3 py-1.5 text-[11px] font-extrabold tracking-wide " +
          (inverted ? "bg-bg text-ink" : "bg-ink text-bg")
        }
      >
        <span>{card.name.toUpperCase()}</span>
        <span>LV {card.level}</span>
      </header>

      {art ? (
        <div className="relative flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- static asset, fixed frame */}
          <img src={art} alt={`${card.name} card art`} className="absolute inset-0 h-full w-full object-cover" />
        </div>
      ) : (
        <div className={`relative flex flex-1 items-center justify-center ${card.rarity === "SSR" ? "av-stripes" : "av-dots"}`}>
          <span className="font-jpround text-[clamp(44px,7vw,64px)] font-black leading-none">
            {card.kanji}
          </span>
          <span className="absolute bottom-1.5 right-2.5 font-jp text-[10px] text-ink3">
            {card.reading}
          </span>
        </div>
      )}

      <footer className={"border-t-2 px-3 py-2 " + (inverted ? "border-bg" : "border-ink")}>
        <p className="text-[11.5px] font-bold leading-snug">{card.epithet}</p>
        <p className="mt-1 flex items-center justify-between text-[10px] font-extrabold tracking-wider">
          <span className={card.rarity === "N" ? "text-ink3" : "text-accent"}>
            {"★".repeat(RARITY_STARS[card.rarity])}
          </span>
          <span className={inverted ? "" : "text-ink3"}>{RARITY_LABEL[card.rarity].toUpperCase()}</span>
        </p>
      </footer>
    </article>
  );
}

function CardModal({ card, onClose }: { card: CardDef; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${card.name} card`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-5"
    >
      <div onClick={(e) => e.stopPropagation()} className="my-auto w-full max-w-[340px]">
        <div className="animate-[fade_180ms_ease]">
          <Card card={card} />
        </div>

        <div className="av-card mt-3 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-jpround text-2xl font-black leading-none">{card.kanji}</span>
            <span className="font-jp text-sm text-ink2">{card.reading}</span>
          </div>
          <p className="mt-2 text-[15px] font-bold">{card.epithet}</p>
          <p className="mt-1 text-[13px] text-ink2">
            {STYLE_FAMILIES[card.style].label} style · {RARITY_LABEL[card.rarity]} · unlocks at level {card.level}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="av-btn av-btn-ghost mt-3 w-full"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function LockedCard({ card }: { card: CardDef }) {
  return (
    <article className="av-tcg av-tcg-locked av-dots">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink3">
        <span className="av-hanko opacity-50" aria-hidden>
          アニ
        </span>
        <span className="text-[11px] font-extrabold tracking-[0.18em]">UNLOCK AT LV {card.level}</span>
        <span className="text-[10px] font-bold text-ink3">{RARITY_LABEL[card.rarity].toUpperCase()}</span>
      </div>
    </article>
  );
}
