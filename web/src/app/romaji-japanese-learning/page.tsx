import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/romaji-japanese-learning";

const faqs = [
  {
    question: "Is learning Japanese with romaji cheating?",
    answer:
      "No. Romaji is a temporary on-ramp so you can notice spoken vocabulary before you can read kana. Switch to hiragana once roughly 50 words stick by sound.",
  },
  {
    question: "What is the best romaji Japanese learning tool for anime?",
    answer:
      "AnimeVocab shows romaji-first cards from Crunchyroll, Netflix, and YouTube with built-in spaced repetition. Animelon offered romaji subtitle modes but is unreliable as a primary catalog.",
  },
  {
    question: "When should I stop using romaji?",
    answer:
      "After you can recognize hiragana comfortably and look up words with a popup dictionary. Then dual-subtitle tools and Yomitan become useful instead of a wall.",
  },
];

export const metadata: Metadata = {
  title: "Romaji Japanese Learning with Anime (2026): When It Helps",
  description:
    "Romaji-first Japanese learning for anime fans who cannot read kana yet. When romaji helps, when to switch to hiragana, and tools that support both.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Romaji Japanese Learning with Anime",
    description: "Learn Japanese from anime in romaji before kana — tools, timeline, and honest tradeoffs.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Romaji Japanese Learning with Anime",
    description: "Romaji-first path for anime learners — not cheating, a on-ramp.",
  },
};

export default function RomajiJapaneseLearningPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Romaji Japanese Learning with Anime (2026): When It Helps"
        description="Romaji-first Japanese learning for anime fans who cannot read kana yet. When romaji helps, when to switch to hiragana, and tools that support both."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Romaji learning" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Romaji-first Japanese learning"
          lede={
            <>
              Most anime tools assume you read <strong>hiragana at minimum</strong>. Language Reactor, Migaku,
              Yomitan, and asbplayer all start from Japanese text in subtitles.{" "}
              <strong>Romaji Japanese learning</strong> is the on-ramp for fans who hear words clearly but
              cannot decode the script yet — especially on Crunchyroll without JP subs.
            </>
          }
          verdictTag="Honest take"
          verdict={
            <>
              Romaji is not a forever strategy — it is a <strong>friction remover</strong> so you notice spoken
              vocabulary while watching. AnimeVocab shows romaji-first cards and maps to kana as you progress;
              Animelon offers romaji subtitle tracks but on an unreliable catalog.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>When romaji-first wins</h2>
            <ul>
              <li>Month zero — you watch weekly simulcasts but kana course is not finished.</li>
              <li>
                <strong>Learn Japanese on Crunchyroll</strong> with audio only — romaji bridges speech to
                meaning.
              </li>
              <li>You want one useful word per line, not a 40-field Anki card.</li>
            </ul>

            <h2>When to add kana</h2>
            <p>
              After ~50 words by sound, hiragana unlocks dictionaries and miners. Netflix JP subs and fan
              workflows become usable. The underlying vocabulary transfers — only the display layer changes.
            </p>

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
              Read more:{" "}
              <Link href="/blog/romaji-first-japanese-anime">Romaji-first Japanese learning (blog)</Link>,{" "}
              <Link href="/free-japanese-anime-extension">free extension hub</Link>,{" "}
              <Link href="/learn-japanese-crunchyroll">Crunchyroll guide</Link>,{" "}
              <Link href="/vs-language-reactor">vs Language Reactor</Link> (reader-focused).
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Start from audio, not kanji walls.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Try AnimeVocab free
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/hiragana-before-anime-or-after-2026", label: "Hiragana before anime?" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/best-anime-to-learn-japanese", label: "Best anime" },
          { href: "/blog/best-apps-learn-japanese-anime-2026", label: "Best apps 2026" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
