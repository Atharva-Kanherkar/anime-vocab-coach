"use client";

// Immersive reader for a Manga Studio creation — used inside the editor's saved
// view AND on the public /m/<id> share page. A chapter cover (title, subtitle,
// genre · tone, logline, cast) followed by the panels in sequence: each panel's
// art with its dialogue rendered as manga elements — speech bubbles, thought
// bubbles, narration caption boxes, and SFX.

import { studioStyleLabel, type MangaLine, type StudioCreationMeta } from "@/lib/studio";

function Line({ line }: { line: MangaLine }) {
  if (line.kind === "narration") {
    return (
      <p className="border-l-4 border-ink bg-panel px-3 py-2 text-[13.5px] font-medium italic leading-relaxed text-ink2">
        {line.text}
      </p>
    );
  }
  if (line.kind === "sfx") {
    return (
      <p className="select-none text-center font-jpround text-[22px] font-black uppercase italic tracking-wide text-accent">
        {line.text}
      </p>
    );
  }
  // speech / thought
  const thought = line.kind === "thought";
  return (
    <div
      className={
        "relative w-fit max-w-[92%] rounded-2xl border-2 bg-bg px-3.5 py-2 " +
        (thought ? "border-dashed border-line" : "border-ink")
      }
    >
      {line.speaker && (
        <span className="mb-0.5 block text-[11px] font-black uppercase tracking-wide text-accent">
          {line.speaker}
        </span>
      )}
      <p className={"text-[14px] leading-snug " + (thought ? "italic text-ink2" : "font-medium")}>
        {line.text}
      </p>
    </div>
  );
}

export function StudioReaderView({
  meta,
  imageUrl,
  panelImageUrls,
  footer,
}: {
  meta: StudioCreationMeta;
  /** Legacy single grid-page image. Used when meta.layout !== "panels". */
  imageUrl?: string;
  /** Per-panel image sources (URL or data URL), one per panel. Used when
   * meta.layout === "panels". Must be serializable (passed from server pages). */
  panelImageUrls?: (string | null | undefined)[];
  /** Extra UI under the chapter (share controls, CTA…). */
  footer?: React.ReactNode;
}) {
  const perPanel = meta.layout === "panels";
  const tags = [meta.genre, meta.tone].filter(Boolean);

  return (
    <article>
      <header className="mx-auto w-full max-w-[600px] text-center">
        <p className="av-eyebrow">Manga Studio · 創作 — {studioStyleLabel(meta.styleKey)}</p>
        <h1 className="mt-2 font-jpround text-[clamp(26px,5vw,44px)] font-black leading-[1.05]">
          {meta.title.en}
        </h1>
        {meta.title.sub && (
          <p className="mt-1.5 font-jpround text-[15px] font-bold text-ink2">{meta.title.sub}</p>
        )}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border-2 border-line px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wide text-ink2"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {meta.logline && (
          <p className="mx-auto mt-4 max-w-[52ch] text-[14.5px] italic leading-relaxed text-ink2">
            {meta.logline}
          </p>
        )}
        {meta.cast.length > 0 && (
          <p className="mt-3 text-[12px] text-ink3">
            {meta.cast.map((c, i) => (
              <span key={i}>
                {i > 0 && " · "}
                <b className="text-ink2">{c.name || "?"}</b>
              </span>
            ))}
          </p>
        )}
      </header>

      {!perPanel && imageUrl && (
        <figure className="mx-auto mt-6 w-full max-w-[680px] overflow-hidden border-2 border-ink bg-panel">
          {/* eslint-disable-next-line @next/next/no-img-element -- runtime-generated, KV-served */}
          <img src={imageUrl} alt={meta.title.en} className="block h-auto w-full" />
        </figure>
      )}

      <section className="mx-auto mt-8 w-full max-w-[680px] space-y-8">
        {meta.panels.map((panel, i) => {
          const src = perPanel ? panelImageUrls?.[i] : null;
          return (
            <div key={i} className="relative">
              <span className="absolute -left-3 -top-3 z-10 grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-bg text-[12px] font-black">
                {i + 1}
              </span>
              {perPanel &&
                (src ? (
                  // Show the full art uncropped — we respect the panel the artist made.
                  // eslint-disable-next-line @next/next/no-img-element -- runtime-generated / data URL
                  <img
                    src={src}
                    alt={`Panel ${i + 1}`}
                    loading="lazy"
                    className="block h-auto w-full border-2 border-ink bg-panel"
                  />
                ) : (
                  <div className="grid aspect-square w-full place-items-center border-2 border-dashed border-line bg-panel text-[12px] font-bold text-ink3">
                    Panel {i + 1} — art not drawn yet
                  </div>
                ))}
              {panel.lines.length > 0 && (
                <div className="mt-3 space-y-2">
                  {panel.lines.map((line, j) => (
                    <Line key={j} line={line} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {footer && <div className="mx-auto mt-10 w-full max-w-[680px]">{footer}</div>}
    </article>
  );
}
