"use client";

import { MANGA_ART } from "@/lib/manga-art";
import { pickText, type MangaPanel, type StoryLang } from "@/lib/manga";

// English dialogue is lettered INTO the panel art by the image model. In English
// mode we show the art alone. In JA/romaji mode we show the same art plus a
// translation box beneath it, so learners read the art (English) and the
// Japanese together. The whole image always renders — never cropped.
export function MangaPanelView({
  panel,
  lang,
  priority = false,
}: {
  panel: MangaPanel;
  lang: StoryLang;
  priority?: boolean;
}) {
  const art = MANGA_ART[panel.id];
  const showTranslation = lang !== "en";
  const lines = panel.texts.filter((t) => t.kind !== "sfx" && (t.ja || t.romaji));

  return (
    <figure className="overflow-hidden border-2 border-ink bg-panel">
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element -- static asset, whole image shown
        <img
          src={art}
          alt={panel.beat}
          loading={priority ? "eager" : "lazy"}
          className="block h-auto w-full"
        />
      ) : (
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 av-dots p-6 text-center">
          <span className="font-jpround text-4xl font-black text-ink2">絵</span>
          <span className="max-w-[85%] text-[12px] font-medium text-ink3">{panel.beat}</span>
        </div>
      )}

      {showTranslation && lines.length > 0 && (
        <figcaption className="border-t-2 border-ink bg-bg px-4 py-3 sm:px-5">
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-ink3">
            {lang === "ja" ? "日本語" : "Romaji"}
          </p>
          <div className="space-y-1.5">
            {lines.map((t, i) => (
              <p
                key={i}
                lang={lang === "ja" ? "ja" : undefined}
                className={
                  "text-[14px] leading-relaxed " +
                  (t.kind === "caption" ? "italic text-ink3" : t.kind === "thought" ? "text-ink2" : "text-ink") +
                  (lang === "ja" ? " font-jp" : "")
                }
              >
                {t.speaker && t.kind !== "caption" && (
                  <span className="mr-1.5 font-jpround text-[12px] font-black text-accent">
                    {t.speaker}
                    {t.kind === "thought" ? "（心）" : "："}
                  </span>
                )}
                {pickText(t, lang)}
              </p>
            ))}
          </div>
        </figcaption>
      )}
    </figure>
  );
}
