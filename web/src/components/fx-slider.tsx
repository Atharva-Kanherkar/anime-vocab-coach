"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { heroMobileImage, preloadHeroImages } from "@/lib/hero-images";
import { playFxSound, primeFxAudio, type SfxKind } from "@/lib/fx-sounds";
import { GITHUB_URL, TIERS, checkoutFor, type PlanId } from "@/lib/site";
import type { HeroSlide } from "@/lib/slides";
import { AuthControls } from "@/components/site-chrome";

function slideBgStyle(image?: string, tone?: string): CSSProperties {
  if (!image) return { background: tone };
  const mobile = heroMobileImage(image);
  return {
    backgroundColor: "#0a0d16",
    ["--hero-bg-desktop" as string]: `url(${image})`,
    ["--hero-bg-mobile" as string]: mobile ? `url(${mobile})` : `url(${image})`,
  };
}

/**
 * Full-bleed, scroll-driven hero and entire homepage. The stage pins while the
 * tall outer section scrolls; scroll progress selects the active slide.
 */
export function FxSlider({ slides }: { slides: HeroSlide[] }) {
  const wrapRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const neighbors = [index, index + 1, index - 1]
      .map((i) => slides[i])
      .filter(Boolean) as HeroSlide[];
    preloadHeroImages(
      neighbors.flatMap((s) => {
        if (!s.image) return [];
        return mobile ? [heroMobileImage(s.image)!] : [s.image];
      })
    );
  }, [index, slides]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    // Small dead zone past a band boundary before the active slide commits.
    // Enough to stop sub-pixel scroll jitter from flipping the index back and
    // forth, but small so touch scrolling still feels responsive (a larger
    // value makes phones feel like the scroll is "stuck" before a slide turns).
    const HYST = 0.08;

    const update = () => {
      const distance = wrap.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-wrap.getBoundingClientRect().top, 0), Math.max(distance, 1));
      const p = distance > 0 ? scrolled / distance : 0;
      const raw = Math.min(slides.length - 1e-4, Math.max(0, p * slides.length));
      const band = Math.floor(raw);
      const cur = indexRef.current;

      // Commit forward only once we're HYST into the new band; commit backward
      // only once we've dropped HYST below the current band's start. Anything
      // inside the dead zone keeps the current slide.
      let next = cur;
      if (band > cur && raw - band >= HYST) next = band;
      else if (band < cur && cur - raw >= HYST) next = band;

      if (cur !== next) {
        const sound: SfxKind = next > cur ? "click" : "transition";
        indexRef.current = next;
        setIndex(next);
        primeFxAudio();
        playFxSound(sound);
      }
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

  const goToSlideId = (id: string) => {
    const wrap = wrapRef.current;
    const i = slides.findIndex((s) => s.id === id);
    if (!wrap || i < 0) return;
    primeFxAudio();
    const distance = wrap.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: wrap.offsetTop + (distance * (i + 0.5)) / slides.length,
      behavior: "smooth",
    });
  };

  return (
    <section
      ref={wrapRef}
      className="hero"
      style={{ ["--slides" as string]: slides.length }}
      aria-label="AnimeVocab"
    >
      <div className="hero__stage">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`hero__bg${i === index ? " is-active" : ""}`}
            style={slideBgStyle(s.image, s.tone)}
            aria-hidden="true"
          />
        ))}
        <div className="hero__scrim" aria-hidden="true" />
        <div
          className={`hero__scrim hero__scrim--deep${active.bright ? " is-on" : ""}`}
          aria-hidden="true"
        />

        {/* Brand mark lives in the hero only: shown on the first slide, fades
            out as you scroll into later slides. */}
        <Link
          href="/"
          className={`hero__brand${index === 0 ? " is-visible" : ""}`}
          aria-label="AnimeVocab home"
          aria-hidden={index !== 0}
          tabIndex={index === 0 ? 0 : -1}
        >
          アニメ<b>Vocab</b>
        </Link>
        <div className="hero__auth">
          <AuthControls size="sm" />
        </div>

        <ul className="hero__index hero__index--left" aria-hidden="true">
          {slides.map((s, i) => (
            <li key={s.id} className={i === index ? "is-active" : ""}>
              {s.navLabel}
            </li>
          ))}
        </ul>

        <ul className="hero__index hero__index--right" aria-hidden="true">
          {slides.map((s, i) => (
            <li key={s.id} className={i === index ? "is-active" : ""}>
              {s.tag}
            </li>
          ))}
        </ul>

        {active.kind === "pricing" ? (
          <div className="hero__center hero__center--wide hero__center--pricing" key={active.id}>
            <h2 className="hero__title">{active.title}</h2>
            <p className="hero__body">{active.body}</p>
            <div className="price-grid price-grid--three hero__pricing">
              {(["free", "pro", "max"] as PlanId[]).map((id) => {
                const t = TIERS[id];
                const isPro = id === "pro";
                const url = id === "free" ? null : checkoutFor(id);
                return (
                  <div key={id} className={"price-card" + (isPro ? " price-card-pro" : "")}>
                    {isPro && <span className="pro-tag">Popular</span>}
                    <h3>{t.name}</h3>
                    <p className="amount-row">
                      <span className="amount">{t.priceLabel}</span>
                      {t.yearlyLabel && <span className="price-sub">{t.yearlyLabel}</span>}
                    </p>
                    <ul>
                      {t.perks.slice(0, 3).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    {id === "free" ? (
                      <a className="btn btn-line" href={GITHUB_URL} rel="noopener noreferrer">
                        Add to Chrome
                      </a>
                    ) : url ? (
                      <a className="btn btn-accent" href={url} rel="noopener noreferrer">
                        Get {t.name}
                      </a>
                    ) : (
                      <span className="btn btn-accent" aria-disabled="true" style={{ opacity: 0.6, cursor: "default" }}>
                        {t.name} coming soon
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : active.kind === "faq" ? (
          <div className="hero__center hero__center--wide hero__center--faq" key={active.id}>
            <h2 className="hero__title">{active.title}</h2>
            <div className="hero__faq">
              <details>
                <summary>Can I learn Japanese just by watching anime?</summary>
                <p>
                  Only if you actively notice and remember words. AnimeVocab handles that: one
                  word at a time, in context, with scheduled reviews.
                </p>
              </details>
              <details>
                <summary>I can&apos;t read hiragana yet. Can I still use this?</summary>
                <p>
                  Yes. That&apos;s the default setup. Cards show <em>taikutsu</em> before 退屈.
                  Switch to kana-first or kanji-first when you&apos;re ready.
                </p>
              </details>
              <details>
                <summary>How is this different from subtitle dictionary tools?</summary>
                <p>
                  Most tools assume you can read Japanese subtitles and hover words yourself.
                  AnimeVocab pushes one curated word to you in romaji and tracks SRS for you.
                </p>
              </details>
              <details>
                <summary>Where is my data stored?</summary>
                <p>
                  In your browser only. No accounts, no analytics. Source code is on GitHub under
                  AGPL.
                </p>
              </details>
            </div>
            <p className="hero__fineprint">
              © AnimeVocab ·{" "}
              <a href={GITHUB_URL} rel="noopener noreferrer">GitHub</a> ·{" "}
              <a href="/learn-japanese-with-anime">Compare</a> ·{" "}
              <a href="/privacy">Privacy</a>
            </p>
          </div>
        ) : (
          <div className="hero__center" key={active.id}>
            <h1 className="hero__title">{active.title}</h1>
            <p className="hero__body">{active.body}</p>
            <div className="hero__cta">
              <a
                className="btn btn-line hero__cta-btn"
                href={active.ctaHref ?? GITHUB_URL}
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (active.ctaHref?.startsWith("#slide-")) {
                    e.preventDefault();
                    goToSlideId(active.ctaHref.slice("#slide-".length));
                  }
                }}
              >
                {active.ctaLabel ?? "Add to Chrome · free"}
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
