"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { heroMobileImage, preloadHeroImages } from "@/lib/hero-images";
import { playFxSound, primeFxAudio, type SfxKind } from "@/lib/fx-sounds";
import { GITHUB_URL, installUrl, type CheckoutInterval } from "@/lib/site";
import type { HeroSlide } from "@/lib/slides";
import { hasLocalizedPricing } from "@/lib/localized-pricing";
import { useVisitorCountry } from "@/lib/use-visitor-country";
import { AuthControls } from "@/components/site-chrome";
import { BillingToggle, PlanCards } from "@/components/plan-cards";
import { ProductShot } from "@/components/product-shot";

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
 *
 * Every slide is server-rendered into the pinned stage — all 13 bodies exist
 * in the shipped HTML (SEO: Googlebot reads the full narrative, issue #115) —
 * and the active index only toggles `.is-active` (CSS hides the rest, `inert`
 * drops them from the tab order). Slide CTAs whose href is `#slide-<id>`
 * smooth-scroll the wrapper to that slide.
 */
export function FxSlider({ slides }: { slides: HeroSlide[] }) {
  const wrapRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [billingInterval, setBillingInterval] = useState<CheckoutInterval>("monthly");
  const country = useVisitorCountry();
  // Dodo has monthly rules only for these countries, so yearly (which would be
  // the USD price, worse than 12 localized months) is hidden, not advertised.
  const localized = hasLocalizedPricing(country);
  const effectiveInterval: CheckoutInterval = localized ? "monthly" : billingInterval;
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

  // Slide-anchored CTAs scroll the pinned stage instead of the browser
  // jumping to an absolutely-positioned body mid-stack.
  const onCtaClick = (e: React.MouseEvent<HTMLAnchorElement>, slide: HeroSlide) => {
    if (slide.ctaHref?.startsWith("#slide-")) {
      e.preventDefault();
      goToSlideId(slide.ctaHref.slice("#slide-".length));
    }
  };

  const heading = (i: number): ReactNode => {
    const s = slides[i];
    if (s.kind === "pricing" || s.kind === "faq") {
      return <h2 className="hero__title">{s.title}</h2>;
    }
    const Tag = i === 0 ? "h1" : "h2";
    return <Tag className="hero__title">{s.title}</Tag>;
  };

  return (
    <section
      ref={wrapRef}
      className="hero"
      style={{ ["--slides" as string]: slides.length }}
      aria-label="AnimeVocab"
    >
      <div className={`hero__stage${index === 0 ? " hero__stage--cover" : ""}`}>
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
          className={`hero__scrim hero__scrim--deep${slides[index].bright ? " is-on" : ""}`}
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

        {/* All 13 slide bodies ship in the HTML; CSS + inert show one. */}
        {slides.map((s, i) => {
          const active = i === index;
          const wide = s.kind === "pricing" || s.kind === "faq";
          const classes = [
            "hero__center",
            wide ? "hero__center--wide" : "",
            s.kind === "pricing" ? "hero__center--pricing" : "",
            s.kind === "faq" ? "hero__center--faq" : "",
            active ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={s.id}
              id={`slide-${s.id}`}
              className={classes}
              aria-hidden={!active}
              inert={!active}
            >
              {s.kind === "pricing" ? (
                <>
                  {heading(i)}
                  <p className="hero__body">{s.body}</p>
                  {localized ? (
                    <p className="hero__body" style={{ fontSize: "0.85em", opacity: 0.85 }}>
                      Prices shown for your region. You&apos;ll see the same price at checkout.
                    </p>
                  ) : (
                    <BillingToggle interval={billingInterval} onChange={setBillingInterval} />
                  )}
                  <PlanCards
                    interval={effectiveInterval}
                    country={country}
                    localized={localized}
                    perkLimit={3}
                    className="hero__pricing"
                  />
                  <p className="hero__fineprint">
                    <Link href="/pricing">Full pricing, regional prices, and billing FAQ</Link>
                  </p>
                </>
              ) : s.kind === "faq" ? (
                <>
                  {heading(i)}
                  <div className="hero__faq">
                    <details>
                      <summary>Can I learn Japanese just by watching anime?</summary>
                      <p>
                        Only if you actively notice and remember words. AnimeVocab handles that:
                        one word at a time, in context, with scheduled reviews.
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
                        On your device by default — the extension works with no account. Create a
                        free account only if you want cloud backup, sync across devices, or the AI
                        coach. No ads, no tracking, and the source is on GitHub under AGPL.
                      </p>
                    </details>
                  </div>
                  <p className="hero__fineprint">
                    © AnimeVocab ·{" "}
                    <a href={GITHUB_URL} rel="noopener noreferrer">GitHub</a> ·{" "}
                    <a href="/learn-japanese-with-anime">Compare</a> ·{" "}
                    <a href="/privacy">Privacy</a>
                  </p>
                </>
              ) : i === 0 ? (
                // The product visual above the fold (issue #117): headline
                // and CTA on the left, a full-screen HTML mockup of the
                // extension working on the right.
                <div className="hero__split">
                  <div className="hero__copy">
                    {heading(i)}
                    <p className="hero__body">{s.body}</p>
                    <div className="hero__cta">
                      <a
                        className="btn btn-line hero__cta-btn"
                        href={s.ctaHref ?? installUrl()}
                        rel="noopener noreferrer"
                        onClick={(e) => onCtaClick(e, s)}
                      >
                        {s.ctaLabel ?? "Add to Chrome · free"}
                      </a>
                    </div>
                  </div>
                  <ProductShot />
                </div>
              ) : (
                <>
                  {heading(i)}
                  <p className="hero__body">{s.body}</p>
                  <div className="hero__cta">
                    <a
                      className="btn btn-line hero__cta-btn"
                      href={s.ctaHref ?? installUrl()}
                      rel="noopener noreferrer"
                      onClick={(e) => onCtaClick(e, s)}
                    >
                      {s.ctaLabel ?? "Add to Chrome · free"}
                    </a>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
