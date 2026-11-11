import type { Metadata } from "next";
import { FxSlider } from "@/components/fx-slider";
import { HeroImagePreloader } from "@/components/hero-preload";
import { SiteFooter } from "@/components/site-chrome";
import {
  defaultOpenGraph,
  defaultTwitter,
  faqJsonLd,
  HOME_FAQ,
  homeJsonLd,
  SITE_DESCRIPTION,
  SITE_OG_DESCRIPTION,
} from "@/lib/seo";
import { heroMobileImage } from "@/lib/hero-images";
import { heroSlides } from "@/lib/slides";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Anime Vocabulary Coach — Learn Japanese from Anime | AnimeVocab",
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
    languages: { en: SITE_URL, ja: `${SITE_URL}/ja`, "x-default": SITE_URL },
  },
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
  const jsonLd = homeJsonLd();
  const faqLd = faqJsonLd([...HOME_FAQ]);

  return (
    <>
      {(() => {
        const first = heroSlides[0];
        if (!first?.image) return null;
        const mobile = heroMobileImage(first.image)!;
        return (
          <>
            <link
              key={`${first.id}-d`}
              rel="preload"
              as="image"
              href={first.image}
              media="(min-width: 769px)"
            />
            <link
              key={`${first.id}-m`}
              rel="preload"
              as="image"
              href={mobile}
              media="(max-width: 768px)"
            />
          </>
        );
      })()}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <HeroImagePreloader slides={heroSlides} />
      <main id="main">
        <FxSlider slides={heroSlides} />
      </main>
      <a
        className="creator-credit"
        href="https://x.com/attharrva15"
        rel="noopener noreferrer"
        target="_blank"
      >
        Built with <span aria-hidden="true">♥</span> by @attharrva15 · follow the creator
      </a>
      <SiteFooter
        links={[
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/blog/how-to-learn-japanese-watching-anime-2026", label: "How to learn" },
          { href: "/blog", label: "Blog" },
          { href: "/learn-japanese-with-anime", label: "Guides" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/learn-japanese-hulu", label: "Hulu" },
          { href: "/best-anime-to-learn-japanese", label: "Best anime" },
          { href: "/privacy", label: "Privacy" },
        ]}
      />
    </>
  );
}
