import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/learn-japanese-disney-plus";

export const metadata: Metadata = {
  title: "Learn Japanese on Disney+ Anime (2026): Subtitles & Tools",
  description:
    "Learn Japanese on Disney+ anime — Japanese subtitle availability, YumeGo, Language Reactor alternatives, and romaji-first workflows when you cannot read kana yet.",
  keywords: [
    "learn japanese disney plus",
    "disney plus japanese subtitles anime",
    "yumego disney plus",
    "learn japanese disney+",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Learn Japanese on Disney+ Anime (2026)",
    description: "Disney+ anime Japanese learning tools — dual subs, grammar readers, and beginner paths.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese on Disney+ Anime",
    description: "Subtitles, YumeGo, and beginner workflows for Disney+ anime.",
  },
};

const faqs = [
  {
    question: "Does Disney+ have Japanese subtitles for anime?",
    answer:
      "Often yes on titles with Japanese audio — check the subtitle menu for Japanese (not only English CC). Availability varies by region and title.",
  },
  {
    question: "What is the best extension for learning Japanese on Disney+?",
    answer:
      "If you can read Japanese subtitles, YumeGo targets Disney+ with grammar popups and phrase saves. Language Reactor focuses more on Netflix/YouTube. Beginners who need romaji should use AnimeVocab on Netflix/Crunchyroll/YouTube or wait until kana clicks before a Disney+ reader stack.",
  },
];

export default function LearnJapaneseDisneyPlusPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese on Disney+ Anime (2026): Subtitles & Tools"
        description="Learn Japanese on Disney+ anime — Japanese subtitle availability, YumeGo, Language Reactor alternatives, and romaji-first workflows when you cannot read kana yet."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Disney+" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Learn Japanese on Disney+ anime"
          lede={
            <>
              Disney+ carries anime and Japanese-audio titles with subtitle menus that often include{" "}
              <strong>Japanese tracks</strong>. That makes it a strong platform for{" "}
              <strong>reader tools</strong> like YumeGo — and a weaker fit for month-zero learners who still
              need romaji from audio.
            </>
          }
          verdictTag="Start here"
          verdict={
            <>
              Confirm a <strong>Japanese</strong> subtitle track. If you can read it, try{" "}
              <Link href="/vs-yumego">YumeGo</Link> for grammar + phrase saves. If you cannot read kana yet,
              build vocabulary on Crunchyroll/Netflix with{" "}
              <Link href="/free-japanese-anime-extension">AnimeVocab</Link> first, then graduate to Disney+
              dual-sub readers.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Tool fit on Disney+</h2>
            <ul>
              <li>
                <strong>YumeGo</strong> — Disney+ + Netflix grammar reader (
                <Link href="/vs-yumego">vs AnimeVocab</Link>).
              </li>
              <li>
                <strong>Language Reactor</strong> — stronger on Netflix/YouTube; check current Disney+ support
                before relying on it (<Link href="/vs-language-reactor">comparison</Link>).
              </li>
              <li>
                <strong>AnimeVocab</strong> — romaji-first on Crunchyroll/Netflix/YouTube; use as the beginner
                on-ramp before Disney+ reader stacks.
              </li>
            </ul>

            <h2>FAQ</h2>
            <ul>
              {faqs.map((f) => (
                <li key={f.question}>
                  <strong>{f.question}</strong>
                  <br />
                  {f.answer}
                </li>
              ))}
            </ul>

            <p>
              Related: <Link href="/learn-japanese-netflix-anime">Netflix anime guide</Link>,{" "}
              <Link href="/blog/best-apps-learn-japanese-anime-2026">best apps 2026</Link>,{" "}
              <Link href="/romaji-japanese-learning">romaji path</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Match the tool to the platform.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/vs-yumego", label: "vs YumeGo" },
          { href: "/learn-japanese-netflix-anime", label: "Netflix guide" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
