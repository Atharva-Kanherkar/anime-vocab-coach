"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroSlide } from "@/lib/slides";

const AUTOPLAY_MS = 7000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function splitWords(title: string) {
  return title.split(/\s+/).filter(Boolean);
}

export function FxSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [wordKey, setWordKey] = useState(0);
  const [reduced, setReduced] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef(0);
  const progressStartRef = useRef(0);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const go = useCallback(
    (next: number) => {
      if (slides.length < 2) return;
      let target = next;
      if (target < 0) target = slides.length - 1;
      if (target >= slides.length) target = 0;
      if (target === index) return;

      setLeaving(index);
      setIndex(target);
      setWordKey((k) => k + 1);
      setProgress(0);

      window.setTimeout(() => setLeaving(null), reduced ? 0 : 950);
    },
    [index, reduced, slides.length]
  );

  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  const stopAutoplay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const startAutoplay = useCallback(() => {
    stopAutoplay();
    if (reduced || slides.length < 2) return;

    progressStartRef.current = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - progressStartRef.current) / AUTOPLAY_MS);
      setProgress(t * 100);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    timerRef.current = setInterval(next, AUTOPLAY_MS);
  }, [next, reduced, slides.length, stopAutoplay]);

  useEffect(() => {
    startAutoplay();
    return stopAutoplay;
  }, [index, startAutoplay, stopAutoplay]);

  const onStageClick = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as Element).closest("a, button, .fx-slider__ui, .fx-slider__thumbs")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.35) prev();
    else if (x > rect.width * 0.65) next();
  };

  const slide = slides[index];

  return (
    <section
      className="fx-slider"
      aria-label="Hero slideshow"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      }}
      onMouseEnter={stopAutoplay}
      onMouseLeave={startAutoplay}
      onFocus={stopAutoplay}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) startAutoplay();
      }}
    >
      <div className="fx-slider__stage" onClick={onStageClick}>
        {slides.map((s, i) => {
          const active = i === index;
          const isLeaving = i === leaving;
          return (
            <article
              key={s.id}
              className={[
                "fx-slide",
                active && "is-active",
                isLeaving && "is-leaving",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden={!active}
            >
              <div className="fx-slide__bg">
                <Image
                  src={s.image}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="fx-slide__img"
                />
              </div>
              <div className="fx-slide__scrim" aria-hidden="true" />
              <div className="wrap fx-slide__content">
                <p className="fx-slide__kicker">{s.kicker}</p>
                <h1 className="fx-slide__title" key={active ? wordKey : s.id}>
                  {splitWords(s.title).map((word, wi) => (
                    <span
                      key={`${s.id}-${wi}`}
                      className="w"
                      style={
                        reduced
                          ? undefined
                          : { animationDelay: `${0.07 * wi}s` }
                      }
                    >
                      {word}{" "}
                    </span>
                  ))}
                </h1>
                <p className="fx-slide__body">{s.body}</p>
                {(s.ctaLabel || s.secondaryLabel) && (
                  <div className="fx-slide__cta">
                    {s.ctaLabel && s.ctaHref && (
                      s.ctaHref.startsWith("#") || s.ctaHref.startsWith("/") ? (
                        <Link className="btn btn-accent" href={s.ctaHref}>
                          {s.ctaLabel}
                        </Link>
                      ) : (
                        <a
                          className="btn btn-accent"
                          href={s.ctaHref}
                          rel="noopener noreferrer"
                        >
                          {s.ctaLabel}
                        </a>
                      )
                    )}
                    {s.secondaryLabel && s.secondaryHref && (
                      <Link className="btn btn-line" href={s.secondaryHref}>
                        {s.secondaryLabel}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="fx-slider__ui">
        <div className="fx-slider__progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="fx-slider__controls wrap">
          <button
            type="button"
            className="fx-slider__nav fx-slider__nav--prev"
            aria-label="Previous slide"
            onClick={prev}
          >
            ←
          </button>
          <span className="fx-slider__count">
            {pad(index + 1)} / {pad(slides.length)}
          </span>
          <button
            type="button"
            className="fx-slider__nav fx-slider__nav--next"
            aria-label="Next slide"
            onClick={next}
          >
            →
          </button>
        </div>

        <div className="fx-slider__thumbs wrap" role="tablist" aria-label="Choose slide">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              className={`fx-slider__thumb${i === index ? " is-active" : ""}`}
              onClick={() => go(i)}
            >
              <Image src={s.thumb} alt="" fill sizes="120px" className="fx-slider__thumb-img" />
              <span className="fx-slider__thumb-label">{s.kicker}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
