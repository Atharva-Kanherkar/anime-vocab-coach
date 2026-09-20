import { heroMobileImage } from "@/lib/hero-images";
import type { HeroSlide } from "@/lib/slides";

/**
 * The product visual under every feature title: a browser-style frame around
 * the real anime art, with the word AnimeVocab would surface floated on top.
 * Same frame on every slide so scrolling reads as "one product, many
 * features" rather than a new layout each time.
 */
export function FeatureMockup({ slide }: { slide: HeroSlide }) {
  if (!slide.image) return null;
  const mobile = heroMobileImage(slide.image);

  return (
    <figure className="feature-mockup" aria-label={`${slide.tag} — product mockup`}>
      <div className="feature-mockup__bar" aria-hidden="true">
        <span className="feature-mockup__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="feature-mockup__url">{slide.tag}</span>
      </div>
      <div className="feature-mockup__screen">
        <img
          className="feature-mockup__img"
          src={slide.image}
          srcSet={mobile ? `${mobile} 720w, ${slide.image} 1600w` : undefined}
          sizes="(max-width: 768px) 100vw, 900px"
          alt={`${slide.title} — screenshot of AnimeVocab in use`}
          loading="lazy"
          decoding="async"
        />
        {slide.overlayWord ? (
          <div className="feature-mockup__word">
            <span className="feature-mockup__ja" lang="ja">
              {slide.overlayWord.ja}
            </span>
            <span className="feature-mockup__romaji">{slide.overlayWord.romaji}</span>
            <span className="feature-mockup__gloss">{slide.overlayWord.gloss}</span>
          </div>
        ) : slide.overlayBadge ? (
          <div className="feature-mockup__badge">{slide.overlayBadge}</div>
        ) : null}
      </div>
    </figure>
  );
}
