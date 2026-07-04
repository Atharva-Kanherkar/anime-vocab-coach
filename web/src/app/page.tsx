import type { Metadata } from "next";
import { FxSlider } from "@/components/fx-slider";
import { HomeNav } from "@/components/site-chrome";
import { heroSlides } from "@/lib/slides";
import { SITE_URL, getPromoState } from "@/lib/site";

export const metadata: Metadata = {
  title: "Learn Japanese from Anime | AnimeVocab Chrome Extension",
  description:
    "AnimeVocab is a free Chrome extension that teaches Japanese vocabulary while you watch anime. Romaji-first word cards, spaced repetition, and Listening Mode for Netflix, Crunchyroll, and YouTube.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Learn Japanese from Anime — AnimeVocab",
    description:
      "Free Chrome extension: word cards from what you watch, romaji-first for beginners, SRS built in.",
    url: SITE_URL,
  },
};

export default function HomePage() {
  const promo = getPromoState();

  return (
    <>
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
        Built with <span aria-hidden="true">♥</span> by @attharrva15 — follow the creator
      </a>
    </>
  );
}
