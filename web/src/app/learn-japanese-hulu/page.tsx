import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/learn-japanese-hulu";

export const metadata: Metadata = {
  title: "Learn Japanese on Hulu Anime (2026): Subs, Tools & Workflow",
  description:
    "Learn Japanese on Hulu anime — Japanese audio/subtitle availability in the US, how it compares to Crunchyroll/Netflix, and beginner study tools.",
  keywords: [
    "learn japanese hulu",
    "hulu anime japanese subtitles",
    "hulu japanese immersion",
    "learn japanese hulu anime",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Learn Japanese on Hulu Anime (2026)",
    description:
      "Hulu anime for Japanese study — subtitle checks, catalog tips, and a beginner capture workflow.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese on Hulu Anime",
    description: "Subtitles, immersion tips, and beginner tools for Hulu anime.",
  },
};

const faqs = [
  {
    question: "Does Hulu have Japanese subtitles for anime?",
    answer:
      "Sometimes. Availability depends on the title and your region. Open the audio/subtitle menu and look for Japanese audio plus Japanese (not only English CC) before planning a dual-sub session.",
  },
  {
    question: "Is Hulu good for learning Japanese compared to Crunchyroll?",
    answer:
      "Hulu can be great for specific licensed titles in the US. Crunchyroll usually wins for simulcasts and learning-extension ecosystems. Use whichever library you will actually finish.",
  },
  {
    question: "What extension should I use on Hulu?",
    answer:
      "Reader/mining extensions vary by site support and break often after player updates. Month-zero learners should keep a reliable daily loop on Netflix/Crunchyroll/YouTube with AnimeVocab, then apply the same one-word method on Hulu nights.",
  },
];

export default function LearnJapaneseHuluPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese on Hulu Anime (2026): Subs, Tools & Workflow"
        description="Learn Japanese on Hulu anime — Japanese audio/subtitle availability in the US, how it compares to Crunchyroll/Netflix, and beginner study tools."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Hulu" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Learn Japanese on Hulu anime"
          lede={
            <>
              Hulu carries anime many US learners already pay for. For Japanese study, ignore the brand logo
              and ask: <strong>Japanese audio?</strong> <strong>Japanese text?</strong>{" "}
              <strong>A capture habit?</strong>
            </>
          }
          verdictTag="Start here"
          verdict={
            <>
              Confirm tracks in the player. Capture <strong>one word per episode</strong>. If you need
              romaji-first tooling or Listening Mode, keep your daily stack on{" "}
              <Link href="/learn-japanese-crunchyroll">Crunchyroll</Link> /{" "}
              <Link href="/learn-japanese-netflix-anime">Netflix</Link> with{" "}
              <Link href="/free-japanese-anime-extension">AnimeVocab</Link>, and treat Hulu as catalog
              immersion.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Hulu vs Netflix vs Crunchyroll for learners</h2>
            <ul>
              <li>
                <strong>Hulu</strong> — US-friendly bundles; check each title&apos;s JP tracks.
              </li>
              <li>
                <strong>Netflix</strong> — stronger dual-sub / reader ecosystem (
                <Link href="/learn-japanese-netflix-anime">guide</Link>).
              </li>
              <li>
                <strong>Crunchyroll</strong> — simulcasts + Listening Mode workflows (
                <Link href="/learn-japanese-crunchyroll">guide</Link>).
              </li>
            </ul>

            <h2>Beginner session template</h2>
            <ol>
              <li>Japanese audio on.</li>
              <li>JP subs only if you can read them without freezing.</li>
              <li>
                Save one line with{" "}
                <Link href="/blog/one-word-per-episode-method">one word per episode</Link>.
              </li>
              <li>
                Review tomorrow with <Link href="/anime-spaced-repetition">SRS</Link>.
              </li>
            </ol>

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
              Related: <Link href="/learn-japanese-hidive">HIDIVE</Link>,{" "}
              <Link href="/learn-japanese-disney-plus">Disney+</Link>,{" "}
              <Link href="/learn-japanese-prime-video">Prime Video</Link>,{" "}
              <Link href="/best-anime-to-learn-japanese">best beginner anime</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Your library only helps if you capture.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/learn-japanese-netflix-anime", label: "Netflix" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
