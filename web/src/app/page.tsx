import type { Metadata } from "next";
import { FxSlider } from "@/components/fx-slider";
import { HeroImagePreloader } from "@/components/hero-preload";
import {
  defaultOpenGraph,
  defaultTwitter,
  homeJsonLd,
  SITE_DESCRIPTION,
  SITE_OG_DESCRIPTION,
} from "@/lib/seo";
import { heroMobileImage } from "@/lib/hero-images";
import { heroSlides } from "@/lib/slides";
import { SITE_URL, getPromoState } from "@/lib/site";

export const metadata: Metadata = {
  title: "Learn Japanese from Anime | AnimeVocab Chrome Extension",
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    ...defaultOpenGraph,
    title: "Learn Japanese from Anime | AnimeVocab",
    description: SITE_OG_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese from Anime | AnimeVocab",
    description: SITE_OG_DESCRIPTION,
  },
};

export default function HomePage() {
  const promo = getPromoState();
  const jsonLd = homeJsonLd();

  return (
    <>
      {heroSlides.slice(0, 2).flatMap((s) => {
        if (!s.image) return [];
        const mobile = heroMobileImage(s.image)!;
        return [
          <link key={`${s.id}-d`} rel="preload" as="image" href={s.image} />,
          <link
            key={`${s.id}-m`}
            rel="preload"
            as="image"
            href={mobile}
            media="(max-width: 768px)"
          />,
        ];
      })}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroImagePreloader slides={heroSlides} />
      <main id="main">
        <FxSlider slides={heroSlides} initialPromo={promo} />
      </main>
      <a
        className="creator-credit"
        href="https://x.com/attharrva15"
        rel="noopener noreferrer"
        target="_blank"
      >
        Built with <span aria-hidden="true">♥</span> by @attharrva15 · follow the creator
      </a>
    </>
  );
}
