import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/learn-japanese-youtube-anime";

export const metadata: Metadata = {
  title: "Learn Japanese from Anime on YouTube (2026 Guide)",
  description:
    "Learn Japanese from anime clips on YouTube — dual subs, vocabulary mining, shadowing clips, and tools for beginners vs advanced miners.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Learn Japanese from Anime on YouTube",
    description: "YouTube anime clips for Japanese study — workflows, tools, and clip-based repetition.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese from Anime on YouTube",
    description: "Clip-based Japanese study on YouTube with SRS and immersion tools.",
  },
};

export default function LearnJapaneseYoutubePage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese from Anime on YouTube (2026 Guide)"
        description="Learn Japanese from anime clips on YouTube — dual subs, vocabulary mining, shadowing clips, and tools for beginners vs advanced miners."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/blog", label: "Blog" },
            { label: "YouTube anime" },
          ]}
        />

        <CompareHero
          title="Learn Japanese from anime on YouTube"
          lede={
            <>
              YouTube is where <strong>clip-based study</strong> shines — 30-second scenes, looped audio, shadowing
              without committing to a full episode. Language Reactor, Migaku, Trancy, and Langadoo all target YouTube;
              AnimeVocab works there too with <strong>romaji-first cards</strong> when you are not reading kana yet.
            </>
          }
          verdictTag="Workflow"
          verdict={
            <>
              Paste or open a clip → pick one repeated phrase → shadow it → save to SRS. Five clips beat one
              passive episode. Pair with{" "}
              <Link href="/blog/shadowing-anime-japanese-pronunciation">shadowing routine</Link> and{" "}
              <Link href="/anime-spaced-repetition">spaced repetition</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Why YouTube beats full episodes for drills</h2>
            <p>
              Wordy.info and Migaku both recommend short loops over bingeing. YouTube&apos;s replay controls and
              abundance of slice-of-life scenes make it ideal for **Japanese shadowing practice** — repeat until
              timing matches, then log the phrase.
            </p>

            <h2>Tool fit on YouTube</h2>
            <ul>
              <li>
                <strong>Migaku</strong> — deep mining; best if you already read Japanese.
              </li>
              <li>
                <strong>Language Reactor</strong> — dual subs when available.
              </li>
              <li>
                <strong>AnimeVocab</strong> — one word per line, romaji-first, built-in review.
              </li>
            </ul>

            <p>
              Compare: <Link href="/learn-japanese-with-anime">full 2026 tool ranking</Link>,{" "}
              <Link href="/learn-japanese-netflix-anime">Netflix guide</Link>,{" "}
              <Link href="/best-anime-to-learn-japanese">best beginner anime</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Open a clip. Learn one line.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Install AnimeVocab
            </a>
          </div>
        </section>
      </main>
      <SiteFooter links={[{ href: "/blog", label: "Blog" }, { href: GITHUB_URL, label: "GitHub" }]} />
    </>
  );
}
