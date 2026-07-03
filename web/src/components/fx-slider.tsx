"use client";

import { useEffect, useRef, useState } from "react";
import { GITHUB_URL } from "@/lib/site";
import type { HeroSlide } from "@/lib/slides";

/**
 * Full-bleed, scroll-driven hero. The stage is pinned (sticky) while the tall
 * outer section scrolls; scroll progress selects the active slide and the
 * backgrounds crossfade.
 */
export function FxSlider({ slides }: { slides: HeroSlide[] }) {
  const wrapRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const update = () => {
      const distance = wrap.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-wrap.getBoundingClientRect().top, 0), Math.max(distance, 1));
      const p = distance > 0 ? scrolled / distance : 0;
      const next = Math.min(slides.length - 1, Math.floor(p * slides.length + 0.0001));
      setIndex((cur) => (cur === next ? cur : next));
    };

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [slides.length]);

  const active = slides[index];

  return (
    <section
      ref={wrapRef}
      className="hero"
      style={{ height: `${slides.length * 100}vh` }}
      aria-label="Introduction"
    >
      <div className="hero__stage">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`hero__bg${i === index ? " is-active" : ""}`}
            style={s.image ? { backgroundImage: `url(${s.image})` } : { background: s.tone }}
            aria-hidden="true"
          />
        ))}
        <div className="hero__scrim" aria-hidden="true" />

        <ul className="hero__index hero__index--right" aria-hidden="true">
          {slides.map((s, i) => (
            <li key={s.id} className={i === index ? "is-active" : ""}>
              {s.tag}
            </li>
          ))}
        </ul>

        <div className="hero__center" key={active.id}>
          <h1 className="hero__title">{active.title}</h1>
          <p className="hero__body">{active.body}</p>
          <div className="hero__cta">
            <a className="btn btn-line hero__cta-btn" href={GITHUB_URL} rel="noopener noreferrer">
              Add to Chrome — free
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
