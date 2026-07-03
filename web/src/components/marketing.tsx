import type { ReactNode } from "react";
import Link from "next/link";

export type Slide = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  scene: "dusk" | "city" | "rain" | "sakura";
};

export function FxSlider({ slides }: { slides: Slide[] }) {
  return (
    <section
      className="fx-slider"
      data-autoplay="9000"
      aria-label="Product highlights"
      tabIndex={0}
    >
      <div className="fx-slider__stage">
        {slides.map((slide, i) => (
          <article
            key={slide.id}
            className={`fx-slide fx-slide--${slide.scene}${i === 0 ? " is-active" : ""}`}
            aria-hidden={i !== 0}
          >
            <div className="fx-slide__bg" aria-hidden="true" />
            <div className="fx-slide__scrim" aria-hidden="true" />
            <div className="wrap fx-slide__content">
              <p className="fx-slide__kicker">{slide.kicker}</p>
              <h1 className="fx-slide__title">
                {slide.title.split(" ").map((word, wi) => (
                  <span key={wi} className="w">
                    {word}{" "}
                  </span>
                ))}
              </h1>
              <p className="fx-slide__body">{slide.body}</p>
              {i === 0 && (
                <div className="fx-slide__cta">
                  <a
                    className="btn btn-accent"
                    href="https://github.com/Atharva-Kanherkar/anime-vocab-coach"
                    rel="noopener noreferrer"
                  >
                    Add to Chrome
                  </a>
                  <Link className="btn btn-line" href="#how">
                    How it works
                  </Link>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="fx-slider__ui">
        <div className="fx-slider__progress" aria-hidden="true">
          <span />
        </div>
        <div className="fx-slider__controls">
          <button type="button" className="fx-slider__nav fx-slider__nav--prev" aria-label="Previous slide">
            ←
          </button>
          <span className="fx-slider__count">01 / 03</span>
          <button type="button" className="fx-slider__nav fx-slider__nav--next" aria-label="Next slide">
            →
          </button>
        </div>
        <div className="fx-slider__dots" />
      </div>
    </section>
  );
}

export function CompareHero({
  title,
  lede,
  verdictTag,
  verdict,
}: {
  title: string;
  lede: ReactNode;
  verdictTag: string;
  verdict: ReactNode;
}) {
  return (
    <section className="cmp-hero">
      <div className="wrap">
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        <div className="cmp-verdict">
          <span className="vtag">{verdictTag}</span>
          <p>{verdict}</p>
        </div>
      </div>
    </section>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  return (
    <nav className="crumbs wrap" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && " / "}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
