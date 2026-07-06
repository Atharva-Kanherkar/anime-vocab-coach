"use client";

import { MANGA_ART } from "@/lib/manga-art";
import { pickText, type MangaPanel, type StoryLang } from "@/lib/manga";

const ASPECT: Record<MangaPanel["aspect"], string> = {
  portrait: "aspect-[3/4]",
  landscape: "aspect-[4/3]",
  square: "aspect-square",
  spread: "aspect-[16/9]",
};

// Balloon styling per text kind. Bubbles stay white/ink for manga legibility
// regardless of app theme.
function bubbleClass(kind: MangaPanel["texts"][number]["kind"]): string {
  switch (kind) {
    case "speech":
      return "rounded-[18px] border-2 border-black bg-white text-black shadow-[2px_2px_0_rgba(0,0,0,0.9)]";
    case "thought":
      return "rounded-[20px] border-2 border-dashed border-black bg-white/95 text-black italic";
    case "caption":
      return "rounded-sm border-2 border-black bg-white text-black font-bold uppercase tracking-wide";
    case "sfx":
      return "text-black font-jpround font-black -rotate-6 drop-shadow-[1px_1px_0_rgba(255,255,255,0.9)]";
  }
}

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
  return (
    <figure className={`relative w-full overflow-hidden border-2 border-ink bg-panel ${ASPECT[panel.aspect]}`}>
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element -- static asset in a fixed frame
        <img
          src={art}
          alt={panel.beat}
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 av-dots p-6 text-center">
          <span className="font-jpround text-4xl font-black text-ink2">絵</span>
          <span className="max-w-[85%] text-[12px] font-medium text-ink3">{panel.beat}</span>
        </div>
      )}

      {panel.texts.map((t, i) => (
        <div
          key={i}
          className="absolute z-10 flex max-w-[62%] -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5"
          style={{ left: `${t.x}%`, top: `${t.y}%` }}
        >
          {t.speaker && t.kind !== "caption" && t.kind !== "sfx" && (
            <span className="w-fit rounded bg-black px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
              {t.speaker}
            </span>
          )}
          <span
            lang={lang === "en" ? "en" : lang === "ja" ? "ja" : undefined}
            className={
              `${bubbleClass(t.kind)} ` +
              (t.kind === "sfx"
                ? "text-[clamp(20px,5vw,40px)] leading-none"
                : "px-2.5 py-1.5 text-[clamp(10px,1.5vw,13px)] leading-snug") +
              (lang === "ja" ? " font-jp" : "")
            }
          >
            {pickText(t, lang)}
          </span>
        </div>
      ))}
    </figure>
  );
}
