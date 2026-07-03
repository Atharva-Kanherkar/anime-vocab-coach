import type { Metadata } from "next";
import { FxSlider } from "@/components/fx-slider";
import { FeatureCoverflow } from "@/components/feature-coverflow";
import { HomeNav, PricingSection, SiteFooter } from "@/components/site-chrome";
import { heroSlides } from "@/lib/slides";
import { GITHUB_URL, SITE_URL, getPromoState } from "@/lib/site";

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

const HOME_FOOTER_LINKS = [
  { href: "/#pricing", label: "Pricing" },
  { href: "/learn-japanese-with-anime", label: "Compare" },
  { href: GITHUB_URL, label: "GitHub" },
  { href: "/privacy", label: "Privacy" },
];

export default function HomePage() {
  const promo = getPromoState();

  return (
    <>
      <HomeNav />
      <main id="main">
        <FxSlider slides={heroSlides} />

        <section className="manifesto">
          <div className="wrap reveal">
            <span className="man-quote" aria-hidden="true">「</span>
            <p>
              Vocabulary from <strong>real shows</strong>, not textbook dialogues —
              without opening Anki mid-episode.
            </p>
          </div>
        </section>

        <section className="features" id="features">
          <div className="wrap">
            <header className="section-head reveal">
              <span className="jp-mark" aria-hidden="true">特徴</span>
              <h2>Why learners pick AnimeVocab</h2>
            </header>
          </div>
          <FeatureCoverflow />
        </section>

        <PricingSection initialPromo={promo} />

        <section className="faq" id="faq">
          <div className="wrap narrow">
            <header className="section-head reveal">
              <span className="jp-mark" aria-hidden="true">質問</span>
              <h2>FAQ</h2>
            </header>
            <details className="reveal">
              <summary>Can I learn Japanese just by watching anime?</summary>
              <p>
                Only if you actively notice and remember words. AnimeVocab handles that: one
                word at a time, in context, with scheduled reviews.
              </p>
            </details>
            <details className="reveal">
              <summary>I can&apos;t read hiragana yet. Can I still use this?</summary>
              <p>
                Yes. That&apos;s the default setup. Cards show <em>taikutsu</em> before 退屈.
                Switch to kana-first or kanji-first when you&apos;re ready.
              </p>
            </details>
            <details className="reveal">
              <summary>How is this different from subtitle dictionary tools?</summary>
              <p>
                Most tools assume you can read Japanese subtitles and hover words yourself.
                AnimeVocab pushes one curated word to you in romaji and tracks SRS for you.
              </p>
            </details>
            <details className="reveal">
              <summary>Where is my data stored?</summary>
              <p>
                In your browser only. No accounts, no analytics. Source code is on GitHub under
                AGPL.
              </p>
            </details>
          </div>
        </section>

        <section className="final-frame">
          <div className="final-bg" aria-hidden="true">
            <span className="final-kanji">始</span>
          </div>
          <div className="final-inner reveal">
            <p className="final-jp" lang="ja">次のエピソードから、始めよう。</p>
            <h2>Your next episode can teach you a word.</h2>
            <a className="btn btn-accent btn-lg" href={GITHUB_URL} rel="noopener noreferrer">
              Add to Chrome — free
            </a>
          </div>
        </section>
      </main>
      <SiteFooter links={HOME_FOOTER_LINKS} />
    </>
  );
}
