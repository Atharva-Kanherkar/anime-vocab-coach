"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { heroMobileImage, preloadHeroImages } from "@/lib/hero-images";
import { playFxSound, primeFxAudio, type SfxKind } from "@/lib/fx-sounds";
import { GITHUB_URL, getPromoState, type PromoState } from "@/lib/site";
import type { HeroSlide } from "@/lib/slides";

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
export function FxSlider({
  slides,
  initialPromo,
}: {
  slides: HeroSlide[];
  initialPromo: PromoState;
}) {
  const wrapRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const rafRef = useRef(0);
  const [promo, setPromo] = useState(initialPromo);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE;
    if (!apiBase || apiBase.includes("example.workers.dev")) return;
    fetch(`${apiBase}/v1/public/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.promo) setPromo({ ...getPromoState(), ...data.promo, active: true });
      })
      .catch(() => {});
  }, []);

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

    // Require the scroll to move a margin past a band boundary before the
    // active slide commits. Without this dead zone, sub-pixel scroll jitter at
    // a boundary flips the index back and forth, restarting the content
    // animation and firing a sound on every flip.
    const HYST = 0.22;

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
      style={{ height: `${slides.length * 100}vh` }}
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
            <div className="price-grid hero__pricing">
              <div className="price-card">
                <h3>Free</h3>
                <p className="amount-row">
                  <span className="strike" aria-hidden="true">&nbsp;</span>
                  <span className="amount">$0</span>
                </p>
                <ul>
                  <li>Word cards + spaced repetition</li>
                  <li>YouTube + HTML5 subtitle sites</li>
                  <li>Dashboard &amp; JSON export</li>
                  <li>Listening Mode with your OpenAI key</li>
                </ul>
                <a className="btn btn-line" href={GITHUB_URL} rel="noopener noreferrer">
                  Install
                </a>
                <p className="promo-note" aria-hidden="true">
                  &nbsp;
                </p>
              </div>
              <div className="price-card price-card-pro">
                <span className="pro-tag">Pro</span>
                <h3>Listening Mode, no setup</h3>
                <p className="amount-row">
                  <span className="strike" aria-hidden={!promo.active}>
                    {promo.active ? promo.regularLabel : " "}
                  </span>
                  <span className="amount">
                    {promo.active ? promo.promoLabel : promo.regularLabel}
                  </span>
                </p>
                <ul>
                  <li>No OpenAI account or API key</li>
                  <li>Netflix, Crunchyroll, every site</li>
                  <li>45 hours of listening / month</li>
                  <li>Cancel anytime</li>
                </ul>
                <a className="btn btn-accent" href={promo.checkoutUrl} rel="noopener noreferrer">
                  {promo.active ? "Get Pro at launch price" : "Get Pro"}
                </a>
                <p className="promo-note">
                  {promo.active
                    ? `Launch pricing ends in ${promo.daysLeft} ${promo.daysLeft === 1 ? "day" : "days"}`
                    : " "}
                </p>
              </div>
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
