"use client";

import { useState } from "react";
import { useUserLevel } from "@/lib/use-user-level";
import { getCardById } from "@/lib/cards";
import {
  chaptersState,
  SAGA_TITLE,
  SAGA_INTRO,
  STORY_LANGS,
  type MangaChapter,
  type StoryLang,
} from "@/lib/manga";
import { MangaPanelView } from "@/components/app/manga-panel";

type ChapterState = { chapter: MangaChapter; unlocked: boolean };

export function MangaReader({ owner = false }: { owner?: boolean }) {
  const lvl = useUserLevel();
  const [lang, setLang] = useState<StoryLang>("en");
  const [openId, setOpenId] = useState<string | null>(null);

  const state = chaptersState(lvl.level, owner);
  const openIdx = openId ? state.findIndex((s) => s.chapter.id === openId) : -1;
  const open = openIdx >= 0 ? state[openIdx] : null;
  const next = openIdx >= 0 ? state[openIdx + 1] : undefined;

  const goTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section aria-label="Manga saga">
      <LangToggle lang={lang} setLang={setLang} />

      {open && open.unlocked ? (
        <ChapterView
          chapter={open.chapter}
          next={next}
          level={lvl.level}
          lang={lang}
          onBack={() => setOpenId(null)}
          onOpen={(id) => {
            setOpenId(id);
            goTop();
          }}
        />
      ) : (
        <ChapterList state={state} lang={lang} level={lvl.level} onOpen={setOpenId} />
      )}
    </section>
  );
}

function LangToggle({ lang, setLang }: { lang: StoryLang; setLang: (l: StoryLang) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Reading language">
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
  );
}

function ChapterList({
  state,
  lang,
  level,
  onOpen,
}: {
  state: ChapterState[];
  lang: StoryLang;
  level: number;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <header className="mt-6">
        <p className="av-eyebrow">Manga saga · 漫画</p>
        <h1 className="mt-2 font-jpround text-[clamp(26px,4vw,40px)] font-black leading-tight">
          {lang === "ja" ? SAGA_TITLE.ja : SAGA_TITLE.en}
        </h1>
        {lang !== "ja" && <p className="mt-1 font-jp text-lg font-bold text-ink2">{SAGA_TITLE.ja}</p>}
        <p className="mt-4 max-w-[62ch] text-[14.5px] leading-relaxed text-ink2">{SAGA_INTRO[lang]}</p>
      </header>

      <ol className="mt-8 list-none space-y-3 pl-0">
        {state.map(({ chapter, unlocked }) => (
          <li key={chapter.id}>
            {unlocked ? (
              <button
                type="button"
                onClick={() => onOpen(chapter.id)}
                className="av-card flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 sm:gap-4 sm:p-5"
              >
                <span className="w-7 shrink-0 font-jpround text-xl font-black text-accent tabular-nums sm:text-2xl">
                  {chapter.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-jpround text-[15px] font-black sm:text-[17px]">
                    {lang === "ja" ? chapter.titleJa : chapter.titleEn}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-ink3">{chapter.setting}</span>
                </span>
                <span className="shrink-0 text-[12px] font-extrabold text-ink2">読む →</span>
              </button>
            ) : (
              <div className="av-card flex w-full items-center gap-3 p-4 opacity-80 sm:gap-4 sm:p-5">
                <span className="w-7 shrink-0 font-jpround text-xl font-black text-ink3 tabular-nums sm:text-2xl">
                  {chapter.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-jpround text-[15px] font-black text-ink3 sm:text-[17px]">
                    Locked
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-ink3">
                    Reach level {chapter.gateLevel} to unlock · you&apos;re level {level}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-ink3">
                  LV {chapter.gateLevel}
                </span>
              </div>
            )}
          </li>
        ))}
      </ol>

      <PatronTeaser />
    </>
  );
}

function ChapterView({
  chapter,
  next,
  level,
  lang,
  onBack,
  onOpen,
}: {
  chapter: MangaChapter;
  next: ChapterState | undefined;
  level: number;
  lang: StoryLang;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const debuts = chapter.debutCardIds.map(getCardById).filter(Boolean);
  return (
    <article className="mt-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[13px] font-extrabold text-ink2 hover:text-ink"
      >
        ← All chapters
      </button>

      <header className="mt-4">
        <p className="av-eyebrow">Chapter {chapter.n} · 第{chapter.n}話</p>
        <h1 className="mt-2 font-jpround text-[clamp(22px,3.5vw,34px)] font-black leading-tight">
          {lang === "ja" ? chapter.titleJa : chapter.titleEn}
        </h1>
        {lang !== "ja" && (
          <p className="mt-1 font-jp text-[15px] font-bold text-ink2">
            {chapter.titleJa} · {chapter.titleRomaji}
          </p>
        )}
        <p className="mt-2 text-[13.5px] text-ink3">{chapter.setting}</p>
      </header>

      <div className="mx-auto mt-8 flex w-full max-w-[560px] flex-col gap-5">
        {chapter.panels.map((panel, i) => (
          <MangaPanelView key={panel.id} panel={panel} lang={lang} priority={i === 0} />
        ))}
      </div>

      {debuts.length > 0 && (
        <section className="mt-10">
          <h2 className="av-eyebrow">Keepers introduced · 登場</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {debuts.map((c) => (
              <li key={c!.id}>
                <a
                  href={`/app/cards/${c!.id}`}
                  className="av-card flex items-center gap-2.5 px-3 py-2.5 transition hover:-translate-y-0.5"
                >
                  <span className="shrink-0 font-jp text-xl font-black leading-none text-accent">{c!.kanji}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{c!.name}</span>
                    <span className="block truncate text-[11px] text-ink3">{c!.epithet}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bottom navigation: continue the saga, or show what unlocks it next. */}
      <nav className="mt-10 border-t border-line pt-6">
        {next ? (
          next.unlocked ? (
            <button
              type="button"
              onClick={() => onOpen(next.chapter.id)}
              className="av-btn av-btn-primary w-full sm:w-auto"
            >
              Next · Chapter {next.chapter.n}: {lang === "ja" ? next.chapter.titleJa : next.chapter.titleEn} →
            </button>
          ) : (
            <div className="av-card p-4 sm:p-5">
              <p className="text-[15px] font-bold">Chapter {next.chapter.n} is locked</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink2">
                Reach <b className="text-accent">level {next.chapter.gateLevel}</b> to continue the saga — you&apos;re
                level {level}. Keep saving and reviewing words to level up; advancing the story and
                collecting cards are the same climb.
              </p>
            </div>
          )
        ) : (
          <p className="text-[13.5px] text-ink2">
            You&apos;ve reached the latest chapter. More of the saga arrives as you level up.
          </p>
        )}
        <button
          type="button"
          onClick={onBack}
          className="mt-4 block text-[13px] font-extrabold text-ink2 hover:text-ink"
        >
          ← All chapters
        </button>
      </nav>
    </article>
  );
}

function PatronTeaser() {
  return (
    <div className="av-card mt-10 p-5 sm:p-6">
      <p className="av-eyebrow">Saga Patron · 支援</p>
      <p className="mt-2 text-[15px] font-bold">The whole saga is free — always.</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">
        Every chapter unlocks by learning, never by paying. If you want to support the project, a
        one-time Saga Patron unlock adds side-stories, foil card variants, PDF export of the chapters
        you&apos;ve reached, and removes ads — none of it skips a single word of study.
      </p>
    </div>
  );
}
