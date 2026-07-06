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

export function MangaReader({ owner = false }: { owner?: boolean }) {
  const lvl = useUserLevel();
  const [lang, setLang] = useState<StoryLang>("en");
  const [openId, setOpenId] = useState<string | null>(null);

  const state = chaptersState(lvl.level, owner);
  const open = openId ? state.find((s) => s.chapter.id === openId) : null;

  return (
    <section aria-label="Manga saga">
      <LangToggle lang={lang} setLang={setLang} />

      {open && open.unlocked ? (
        <ChapterView chapter={open.chapter} lang={lang} onBack={() => setOpenId(null)} />
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
  state: { chapter: MangaChapter; unlocked: boolean }[];
  lang: StoryLang;
  level: number;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <header className="mt-6">
        <p className="av-eyebrow">Manga saga · 漫画</p>
        <h1 className="mt-2 font-jpround text-[clamp(28px,4vw,40px)] font-black leading-tight">
          {lang === "ja" ? SAGA_TITLE.ja : SAGA_TITLE.en}
        </h1>
        {lang !== "ja" && <p className="mt-1 font-jp text-lg font-bold text-ink2">{SAGA_TITLE.ja}</p>}
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink2">{SAGA_INTRO[lang]}</p>
      </header>

      <ol className="mt-8 space-y-3">
        {state.map(({ chapter, unlocked }) => (
          <li key={chapter.id}>
            {unlocked ? (
              <button
                type="button"
                onClick={() => onOpen(chapter.id)}
                className="av-card flex w-full items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 sm:p-5"
              >
                <span className="font-jpround text-2xl font-black text-accent tabular-nums">{chapter.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-jpround text-[17px] font-black">
                    {lang === "ja" ? chapter.titleJa : chapter.titleEn}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink3">{chapter.setting}</span>
                </span>
                <span className="shrink-0 text-[12px] font-extrabold text-ink2">読む →</span>
              </button>
            ) : (
              <div className="av-card flex w-full items-center gap-4 p-4 opacity-70 sm:p-5">
                <span className="font-jpround text-2xl font-black text-ink3 tabular-nums">{chapter.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-jpround text-[17px] font-black text-ink3">
                    ？？？
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink3">
                    Reach level {chapter.gateLevel} to unlock · you are level {level}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-extrabold tracking-wide text-ink3">
                  🔒 LV {chapter.gateLevel}
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
  lang,
  onBack,
}: {
  chapter: MangaChapter;
  lang: StoryLang;
  onBack: () => void;
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
        <h1 className="mt-2 font-jpround text-[clamp(24px,3.5vw,34px)] font-black leading-tight">
          {lang === "ja" ? chapter.titleJa : chapter.titleEn}
        </h1>
        {lang !== "ja" && (
          <p className="mt-1 font-jp text-base font-bold text-ink2">
            {chapter.titleJa} · {chapter.titleRomaji}
          </p>
        )}
        <p className="mt-2 text-[14px] text-ink3">{chapter.setting}</p>
      </header>

      <div className="mx-auto mt-8 flex max-w-[560px] flex-col gap-5">
        {chapter.panels.map((panel, i) => (
          <MangaPanelView key={panel.id} panel={panel} lang={lang} priority={i === 0} />
        ))}
      </div>

      {debuts.length > 0 && (
        <section className="mt-10">
          <h2 className="av-eyebrow">Keepers introduced · 登場</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {debuts.map((c) => (
              <li key={c!.id}>
                <a href={`/app/cards/${c!.id}`} className="av-btn av-btn-ghost av-btn-sm !px-3">
                  {c!.name} <span className="ml-1 font-jp text-ink3">{c!.kanji}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
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
