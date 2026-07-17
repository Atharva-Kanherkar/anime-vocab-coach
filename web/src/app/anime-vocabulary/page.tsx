import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/anime-vocabulary";

export const metadata: Metadata = {
  title: "Anime Vocabulary — Word Lists, Flashcards & Coach (2026)",
  description:
    "Anime vocabulary list for learners: romaji-first flashcards, spaced repetition, and an AI coach while you watch Netflix, Crunchyroll, and YouTube. Free Chrome extension.",
  keywords: [
    "anime vocabulary",
    "anime vocabulary list",
    "anime vocab",
    "japanese anime vocabulary",
    "anime vocabulary coach",
    "japanese vocabulary anime",
    "anime words for vocabulary",
    "common anime vocabulary",
  ],
  alternates: {
    canonical: `${SITE_URL}${path}`,
    languages: { en: `${SITE_URL}${path}`, ja: `${SITE_URL}/ja`, "x-default": `${SITE_URL}${path}` },
  },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Anime Vocabulary — Learn Words from Anime",
    description: "Turn episodes into an anime vocabulary list with SRS and Listening Mode.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Anime Vocabulary | AnimeVocab",
    description: "Anime vocab flashcards while you watch — free Chrome extension.",
  },
};

const faqs = [
  {
    question: "What is the best way to build anime vocabulary?",
    answer:
      "Capture one spoken word per line in context, understand it immediately, and review with spaced repetition. Passive watching with English subs alone does not build an anime vocabulary list you will remember.",
  },
  {
    question: "Is there an anime vocabulary coach?",
    answer:
      "Yes. AnimeVocab includes an AI coach that explains words in the exact scene they appeared — plus built-in SRS so your anime vocab sticks.",
  },
  {
    question: "Do I need to read hiragana first?",
    answer:
      "No. Cards are romaji-first by default (taikutsu before 退屈). Switch to kana or kanji when you are ready.",
  },
];

const starterWords = [
  { word: "taikutsu", gloss: "boring", note: "Slice-of-life anime" },
  { word: "genki", gloss: "energetic / fine", note: "Everyday dialogue" },
  { word: "yokatta", gloss: "thank goodness", note: "Relief reactions" },
  { word: "shinpai", gloss: "worry", note: "School & romance" },
  { word: "tanoshii", gloss: "fun", note: "SoL & comedy" },
  { word: "kowai", gloss: "scary", note: "Horror & thriller" },
  { word: "kawaii", gloss: "cute", note: "Already familiar — still worth SRS" },
  { word: "mendokusai", gloss: "what a pain", note: "Teen speech" },
];

export default function AnimeVocabularyPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Anime Vocabulary — Word Lists, Flashcards & Coach"
        description="Anime vocabulary list for learners — romaji-first cards, SRS, and Listening Mode on legal streams."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[{ href: "/", label: "Home" }, { label: "Anime vocabulary" }]}
          currentPath={path}
        />

        <CompareHero
          title="Anime vocabulary — lists, flashcards & coach"
          lede={
            <>
              Searching <strong>anime vocabulary</strong>, <strong>anime vocab</strong>, or{" "}
              <strong>anime vocabulary list</strong>? You do not need a static PDF — you need words from{" "}
              <strong>shows you actually watch</strong>, reviewed before you forget them.
            </>
          }
          verdictTag="How AnimeVocab helps"
          verdict={
            <>
              One curated word per line · romaji-first cards · built-in spaced repetition · AI coach in
              context · works on Netflix, Crunchyroll, and YouTube.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Starter anime vocabulary (common words)</h2>
            <p>A tiny sample — your real list should come from episodes you love:</p>
            <ul>
              {starterWords.map((w) => (
                <li key={w.word}>
                  <strong>{w.word}</strong> — {w.gloss}
                  <span className="cell-note"> ({w.note})</span>
                </li>
              ))}
            </ul>

            <h2>Static lists vs watching with capture</h2>
            <p>
              Blog posts titled &quot;japanese anime vocabulary list&quot; are fine for orientation. Lasting
              retention comes from{" "}
              <Link href="/learn-japanese-with-anime">learning Japanese with anime</Link> actively — the
              same words recurring across episodes you binge.
            </p>

            <h2>Related guides</h2>
            <ul>
              <li>
                <Link href="/free-japanese-anime-extension">Free Japanese anime extension</Link>
              </li>
              <li>
                <Link href="/learn-japanese-with-anime-free">Learn Japanese with anime free</Link>
              </li>
              <li>
                <Link href="/best-anime-to-learn-japanese">Best anime to learn Japanese</Link>
              </li>
              <li>
                <Link href="/ja">日本語ガイド（Japanese site）</Link>
              </li>
            </ul>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Turn tonight&apos;s episode into vocabulary.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/learn-japanese-with-anime", label: "Learn with anime" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
