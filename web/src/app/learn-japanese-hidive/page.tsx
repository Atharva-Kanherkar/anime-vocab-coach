import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/learn-japanese-hidive";

export const metadata: Metadata = {
  title: "Learn Japanese on HIDIVE Anime (2026): Subs & Study Tools",
  description:
    "Learn Japanese on HIDIVE — Japanese audio/subtitle availability, how it compares to Crunchyroll for immersion, and beginner tools when JP text is missing.",
  keywords: [
    "learn japanese hidive",
    "hidive japanese subtitles",
    "hidive anime immersion",
    "hidive learn japanese extension",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Learn Japanese on HIDIVE Anime (2026)",
    description:
      "HIDIVE anime for Japanese study — subtitle reality check and a beginner workflow that still works when JP tracks are missing.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese on HIDIVE Anime",
    description: "Subtitles, immersion tips, and beginner tools for HIDIVE anime.",
  },
};

const faqs = [
  {
    question: "Does HIDIVE have Japanese subtitles?",
    answer:
      "Many titles offer Japanese audio; Japanese subtitle availability varies by title and region. Always check the player menu before planning a dual-sub study session.",
  },
  {
    question: "Is HIDIVE better than Crunchyroll for learning Japanese?",
    answer:
      "Neither is universally better. HIDIVE has exclusive catalogs some learners love; Crunchyroll has broader simulcast coverage and more mature learning-extension ecosystems. Use whichever library you will actually watch.",
  },
  {
    question: "What tool should beginners use on HIDIVE?",
    answer:
      "If Japanese subtitles are present and you can read them, dictionary/reader extensions help. If you are month-zero or JP text is missing, build the habit on Crunchyroll/Netflix/YouTube with AnimeVocab Listening Mode and romaji-first cards, then apply the same one-word method on HIDIVE nights.",
  },
];

export default function LearnJapaneseHidivePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese on HIDIVE Anime (2026): Subs & Study Tools"
        description="Learn Japanese on HIDIVE — Japanese audio/subtitle availability, how it compares to Crunchyroll for immersion, and beginner tools when JP text is missing."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "HIDIVE" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Learn Japanese on HIDIVE anime"
          lede={
            <>
              HIDIVE is a legal anime stream with titles you will not always find elsewhere. For Japanese
              study, the question is the same as every platform:{" "}
              <strong>do you have Japanese audio, Japanese text, and a capture habit?</strong>
            </>
          }
          verdictTag="Start here"
          verdict={
            <>
              Confirm <strong>Japanese audio</strong> (and JP subs if available). Capture{" "}
              <strong>one word per episode</strong> — do not pause every line. If you still need romaji or the
              title lacks JP text, keep your daily loop on{" "}
              <Link href="/learn-japanese-crunchyroll">Crunchyroll</Link> /{" "}
              <Link href="/learn-japanese-netflix-anime">Netflix</Link> with{" "}
              <Link href="/free-japanese-anime-extension">AnimeVocab</Link>, then use HIDIVE for catalog
              depth.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>HIDIVE vs Crunchyroll for learners</h2>
            <ul>
              <li>
                <strong>Catalog</strong> — HIDIVE exclusives can be gold for shows you love; Crunchyroll wins
                on breadth and simulcasts.
              </li>
              <li>
                <strong>Tooling</strong> — more Chrome learning extensions target Netflix/Crunchyroll first.
                Plan for that.
              </li>
              <li>
                <strong>Method</strong> — platform matters less than{" "}
                <Link href="/blog/one-word-per-episode-method">one word per episode</Link> +{" "}
                <Link href="/anime-spaced-repetition">SRS</Link>.
              </li>
            </ul>

            <h2>Beginner workflow on HIDIVE nights</h2>
            <ol>
              <li>
                Pick a slice-of-life or dialogue-heavy title (
                <Link href="/best-anime-to-learn-japanese">beginner picks</Link>).
              </li>
              <li>Watch mostly for enjoyment; note one line that stuck.</li>
              <li>
                Save that word into your review deck — AnimeVocab if you are on a supported site that night,
                or add manually from HIDIVE notes.
              </li>
              <li>Review tomorrow before the next episode.</li>
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
              Related: <Link href="/learn-japanese-crunchyroll">Crunchyroll guide</Link>,{" "}
              <Link href="/learn-japanese-disney-plus">Disney+</Link>,{" "}
              <Link href="/learn-japanese-prime-video">Prime Video</Link>,{" "}
              <Link href="/blog/does-watching-anime-help-learn-japanese-2026">does anime help?</Link>
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Watch what you love. Capture one word.</h2>
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
