import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/free-japanese-anime-extension";

export const metadata: Metadata = {
  title: "Free Chrome Extension to Learn Japanese from Anime (2026)",
  description:
    "Free Chrome extension for learning Japanese from anime on Crunchyroll, Netflix, and YouTube — romaji-first cards, built-in SRS, Listening Mode. No credit card.",
  keywords: [
    "free chrome extension learn japanese",
    "free japanese anime extension",
    "learn japanese anime free",
    "free language reactor alternative",
    "free migaku alternative",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Free Chrome Extension to Learn Japanese from Anime",
    description:
      "Romaji-first vocabulary cards while you watch. Spaced repetition built in. Free forever for the core loop.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Free Japanese Anime Learning Extension",
    description: "Crunchyroll, Netflix, YouTube — romaji cards + SRS. Free.",
  },
};

const faqs = [
  {
    question: "Is AnimeVocab really free?",
    answer:
      "Yes. The core loop — romaji-first word cards, local spaced repetition, and watching on Crunchyroll, Netflix, and YouTube — is free with no account required. Pro is optional for hosted Listening Mode transcription without bringing your own API key.",
  },
  {
    question: "What is the best free Chrome extension to learn Japanese from anime?",
    answer:
      "It depends on reading level. If you cannot read kana yet or watch Crunchyroll without Japanese subtitles, AnimeVocab is built for that. If you already read Japanese subs on Netflix, Language Reactor's free tier is strong. asbplayer is free for Anki miners who can sync fan subtitle files.",
  },
  {
    question: "Does the free tier work on Crunchyroll?",
    answer:
      "Yes. AnimeVocab runs on Crunchyroll simulcasts. When Japanese subtitle text is missing, Listening Mode works from audio so beginners are not stuck waiting for fan .srt files.",
  },
  {
    question: "Do I need Anki?",
    answer:
      "No. AnimeVocab includes built-in spaced repetition. Power users who already live in Anki can graduate later to asbplayer, SubMiner, or Migaku.",
  },
];

export default function FreeJapaneseAnimeExtensionPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Free Chrome Extension to Learn Japanese from Anime (2026)"
        description="Free Chrome extension for learning Japanese from anime on Crunchyroll, Netflix, and YouTube — romaji-first cards, built-in SRS, Listening Mode. No credit card."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Free extension" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Free Chrome extension to learn Japanese from anime"
          lede={
            <>
              Searching <strong>free Japanese anime extension</strong> usually lands you on dual-subtitle
              tools that assume you already read kana — or paid mining suites.{" "}
              <strong>AnimeVocab</strong> is free for the habit that matters: one useful word per line, in{" "}
              <strong>romaji</strong>, with <strong>spaced repetition</strong>, on the streams you already
              watch.
            </>
          }
          verdictTag="What you get free"
          verdict={
            <>
              Install from GitHub / Chrome (no credit card). Watch Crunchyroll, Netflix, or YouTube. Save
              romaji-first cards. Review on a schedule. Optional Pro only if you want hosted Listening Mode
              without your own OpenAI key.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Free tools compared (honest 2026 map)</h2>
            <ul>
              <li>
                <strong>AnimeVocab</strong> — romaji-first + built-in SRS + Crunchyroll Listening Mode. Best
                free pick for month-zero learners.
              </li>
              <li>
                <strong>Language Reactor</strong> — free dual subs on Netflix/YouTube if you can read Japanese
                text (<Link href="/vs-language-reactor">comparison</Link>).
              </li>
              <li>
                <strong>asbplayer</strong> — free Anki mining if you bring Japanese subtitle files (
                <Link href="/vs-asbplayer">comparison</Link>).
              </li>
              <li>
                <strong>Lexirise / ManabiDojo</strong> — free cores for readers on Crunchyroll; not romaji-first
                (<Link href="/vs-lexirise">vs Lexirise</Link>, <Link href="/vs-manabidojo">vs ManabiDojo</Link>).
              </li>
            </ul>

            <h2>Why &quot;free&quot; rankings often miss beginners</h2>
            <p>
              Most 2026 listicles crown Language Reactor or Animelon without asking:{" "}
              <em>Can you read the Japanese subtitle they require?</em> and{" "}
              <em>Are you on Crunchyroll?</em> If either answer is painful, a free dual-sub tool still leaves
              you stuck. AnimeVocab exists for that gap — see the full{" "}
              <Link href="/blog/best-apps-learn-japanese-anime-2026">best apps ranking</Link> and{" "}
              <Link href="/learn-japanese-crunchyroll">Crunchyroll guide</Link>.
            </p>

            <h2>Install in under two minutes</h2>
            <ol>
              <li>
                Open the{" "}
                <a href={GITHUB_URL} rel="noopener noreferrer">
                  AnimeVocab GitHub repo
                </a>{" "}
                / Chrome install path.
              </li>
              <li>Pin the extension. Open Crunchyroll, Netflix, or YouTube anime.</li>
              <li>Keep English subs if you want — save one romaji word per line.</li>
              <li>Review due cards before the next episode.</li>
            </ol>

            <p>
              Deeper workflows:{" "}
              <Link href="/romaji-japanese-learning">romaji-first learning</Link>,{" "}
              <Link href="/anime-spaced-repetition">spaced repetition</Link>,{" "}
              <Link href="/studio">free AI manga maker</Link> for output practice.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Free tonight. Keep the habit forever.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/best-apps-learn-japanese-anime-2026", label: "Best apps 2026" },
          { href: "/learn-japanese-with-anime", label: "Full tool ranking" },
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
