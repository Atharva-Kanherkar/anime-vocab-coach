import type { Metadata } from "next";
import { FxSlider } from "@/components/fx-slider";
import { HomeNav } from "@/components/site-chrome";
import {
  defaultOpenGraph,
  defaultTwitter,
  homeJsonLd,
  SITE_DESCRIPTION,
  SITE_OG_DESCRIPTION,
} from "@/lib/seo";
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeNav />
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
