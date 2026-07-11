import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/anki-vs-migaku";

export const metadata: Metadata = {
  title: "Anki vs Migaku (2026) — What's the Difference?",
  description:
    "What's the difference between Anki and Migaku? Anki is free SRS. Migaku is a paid immersion suite that mines into Anki. You can learn without Migaku — or without Anki using AnimeVocab.",
  keywords: [
    "anki vs migaku",
    "what's the difference between anki and migaku",
    "difference between anki and migaku",
    "migaku anki",
    "do i need anki for migaku",
    "migaku without anki",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Anki vs Migaku — What's the Difference?",
    description: "Free SRS app vs paid mining suite — and when to skip both.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Anki vs Migaku",
    description: "Anki is the flashcard engine. Migaku is optional mining glue.",
  },
};

const faqs = [
  {
    question: "What's the difference between Anki and Migaku?",
    answer:
      "Anki is a free, open-source spaced repetition flashcard program. Migaku is a paid Chrome immersion suite that helps you mine words and sentences from websites and media — typically into Anki. Anki stores and schedules reviews; Migaku speeds up capture from content you watch or read.",
  },
  {
    question: "Do I need Anki if I use Migaku?",
    answer:
      "Most Migaku power users pair it with Anki (or Migaku’s own review). You can learn Japanese without Migaku using Anki alone, or without Anki using a tool with built-in SRS like AnimeVocab.",
  },
  {
    question: "Can I replace Migaku with free tools and keep Anki?",
    answer:
      "Yes. Reddit’s standard recipe is Yomitan + asbplayer + Anki — a free Migaku-style mining stack. Guide: Migaku free alternative.",
  },
  {
    question: "Can I skip Anki and Migaku as a beginner?",
    answer:
      "Yes. AnimeVocab includes built-in spaced repetition with romaji-first cards so you can start from anime without installing Anki or paying Migaku.",
  },
];

export default function AnkiVsMigakuPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Anki vs Migaku (2026) — What's the Difference?"
        description="Anki is free SRS. Migaku is a paid immersion suite that mines into Anki. When to use each — or AnimeVocab instead."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/migaku-free-alternative", label: "Migaku free alternative" },
            { label: "Anki vs Migaku" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Anki vs Migaku — what's the difference?"
          lede={
            <>
              People search this after Google’s “People also ask” blurs the two.{" "}
              <strong>Anki</strong> is the free flashcard / SRS engine. <strong>Migaku</strong> is paid software
              that helps you <em>create</em> cards from immersion. Confusing them is why “free Migaku
              alternative” threads always mention Anki.
            </>
          }
          verdictTag="One sentence"
          verdict={
            <>
              Keep Anki if you love decks. Skip Migaku with{" "}
              <Link href="/migaku-free-alternative">Yomitan + asbplayer</Link> — or skip both at first with{" "}
              <Link href="/free-japanese-anime-extension">AnimeVocab’s built-in SRS</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Anki = the gym. Migaku = the mining conveyor.</h2>
            <ul>
              <li>
                <strong>Anki</strong> — schedule reviews, sync decks, customize card templates. Free.
              </li>
              <li>
                <strong>Migaku</strong> — mine from supported websites/media into flashcards faster. Paid after
                trial.
              </li>
            </ul>

            <h2>Free path: keep Anki, drop Migaku</h2>
            <p>
              Yomitan + asbplayer + Anki is the Reddit-standard free mining stack. Details:{" "}
              <Link href="/migaku-free-alternative">What is the free alternative to Migaku?</Link>
            </p>

            <h2>Beginner path: skip Anki night</h2>
            <p>
              If you are not ready for templates and AnkiConnect, use AnimeVocab’s local SRS while you watch
              anime — then graduate to Anki later if you want.{" "}
              <Link href="/blog/anki-anime-beginners-2026">Anki for anime beginners</Link>.
            </p>

            <h2>FAQ</h2>
            {faqs.map((f) => (
              <div key={f.question}>
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Start without the subscription.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/migaku-free-alternative", label: "Migaku free alt" },
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: "/migaku-vs-language-reactor", label: "Migaku vs LR" },
          { href: "/blog/anki-anime-beginners-2026", label: "Anki beginners" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
