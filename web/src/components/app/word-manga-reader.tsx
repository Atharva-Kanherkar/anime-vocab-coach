"use client";

// Reader for a Manga Studio creation — used inside the app panel AND on the
// public /m/<id> share page. One generated page image, then per-panel
// dialogue in the saga reader's translation-box style with an EN/JA/romaji
// toggle. The learner's target words are highlighted in the Japanese lines,
// which is the point: you wrote the manga to practice exactly these words.

import { Fragment, useState } from "react";
import { STORY_LANGS, type StoryLang } from "@/lib/manga";
import { studioStyleLabel, type StudioCreationMeta, type StudioText } from "@/lib/word-manga";

/** Wrap occurrences of the target words in the accent style. */
function HighlightJa({ text, words }: { text: string; words: string[] }) {
  const needles = words.filter(Boolean);
  if (needles.length === 0) return <>{text}</>;
  // Split on any target word, longest first so 大丈夫 wins over 丈夫.
  const pattern = needles
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        needles.includes(part) ? (
          <mark key={i} className="bg-transparent font-black text-accent underline decoration-2 underline-offset-4">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

function DialogueLine({ t, lang, words }: { t: StudioText; lang: StoryLang; words: string[] }) {
  const value = lang === "ja" ? t.ja : lang === "romaji" ? t.romaji || t.ja : t.en || t.ja;
  return (
    <p lang={lang === "ja" ? "ja" : undefined} className={"text-[14.5px] leading-relaxed " + (lang === "ja" ? "font-jp" : "")}>
      {t.speaker && (
        <span className="mr-1.5 font-jpround text-[12px] font-black text-accent">{t.speaker}：</span>
      )}
      {lang === "ja" ? <HighlightJa text={value} words={words} /> : value}
    </p>
  );
}

export function StudioReaderView({
  meta,
  imageUrl,
  footer,
}: {
  meta: StudioCreationMeta;
  imageUrl: string;
  /** Extra UI under the dialogue (share controls, word check, CTA…). */
  footer?: React.ReactNode;
}) {
  const [lang, setLang] = useState<StoryLang>("en");
  const wordBases = meta.words.map((w) => w.base);

  return (
    <article>
      <header>
        <p className="av-eyebrow">Manga Studio · 創作 — {studioStyleLabel(meta.styleKey)}</p>
        <h1 className="mt-2 font-jpround text-[clamp(22px,3.5vw,34px)] font-black leading-tight">
          {lang === "ja" ? meta.title.ja || meta.title.en : meta.title.en}
        </h1>
        {(meta.title.ja || meta.title.romaji) && lang !== "ja" && (
          <p className="mt-1 font-jp text-[15px] font-bold text-ink2">
            {meta.title.ja}
            {meta.title.romaji ? ` · ${meta.title.romaji}` : ""}
          </p>
        )}
      </header>

      {/* The words this manga was written to teach. */}
      <ul className="mt-4 flex list-none flex-wrap gap-2 pl-0">
        {meta.words.map((w) => (
          <li
            key={w.base}
            className="rounded-full border-2 border-line px-3 py-1 text-[12px] font-bold text-ink2"
          >
            <span className="font-jp font-black text-accent">{w.base}</span>
            {w.reading && <span className="ml-1.5 font-jp">{w.reading}</span>}
            <span className="ml-1.5">· {w.gloss}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Reading language">
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

      <figure className="mx-auto mt-6 w-full max-w-[560px] overflow-hidden border-2 border-ink bg-panel">
        {/* eslint-disable-next-line @next/next/no-img-element -- runtime-generated, KV-served */}
        <img src={imageUrl} alt={meta.title.en} className="block h-auto w-full" />
      </figure>

      <section className="mx-auto mt-5 w-full max-w-[560px] space-y-3">
        {meta.panels.map((panel, i) => (
          <div key={i} className="border-2 border-ink bg-bg px-4 py-3 sm:px-5">
            <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-ink3">
              Panel {i + 1}
            </p>
            <div className="space-y-1.5">
              {panel.texts.map((t, j) => (
                <DialogueLine key={j} t={t} lang={lang} words={wordBases} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {footer && <div className="mx-auto mt-8 w-full max-w-[560px]">{footer}</div>}
    </article>
  );
}
