import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/learn-japanese-netflix-anime";

export const metadata: Metadata = {
  title: "Learn Japanese on Netflix Anime (2026): Subtitles & Tools",
  description:
    "Learn Japanese on Netflix anime — Japanese subtitle tracks, dual subs, Language Reactor, HASHIGO, and AnimeVocab Listening Mode when subs are missing.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Learn Japanese on Netflix Anime (2026)",
    description: "Netflix often has Japanese subtitles on anime. Here is the 2026 workflow and tool fit.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese on Netflix Anime",
    description: "Dual subtitles, SRS, and tools for Netflix anime immersion.",
  },
};

export default function LearnJapaneseNetflixPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese on Netflix Anime (2026): Subtitles & Tools"
        description="Learn Japanese on Netflix anime — Japanese subtitle tracks, dual subs, Language Reactor, HASHIGO, and AnimeVocab Listening Mode when subs are missing."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Netflix anime" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Learn Japanese on Netflix anime"
          lede={
            <>
              Netflix is often <strong>better than Crunchyroll for Japanese subtitle availability</strong> —
              especially JP Netflix or US titles with standard Japanese tracks. The workflow still needs a
              vocabulary loop: dual subs or audio capture, save in context, review with{" "}
              <strong>spaced repetition</strong>.
            </>
          }
          verdictTag="Check first"
          verdict={
            <>
              Open subtitle settings and confirm a <strong>Japanese</strong> track (not English only). If you
              can read it, Language Reactor or HASHIGO! are strong. If you cannot — or subs are missing — use{" "}
              <strong>AnimeVocab Listening Mode</strong> for romaji-first cards from audio.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Japanese subs vs [CC] on Netflix</h2>
            <ul>
              <li>
                <strong>Standard Japanese</strong> — dialogue as spoken; best for reading while listening.
              </li>
              <li>
                <strong>[CC] Japanese</strong> — often verbatim including SFX; still usable for study.
              </li>
              <li>
                <strong>English only</strong> — treat as entertainment or use audio-first tools.
              </li>
            </ul>

            <h2>Tool fit</h2>
            <ul>
              <li>
                <strong>Language Reactor</strong> — dual subtitles + dictionary; intermediate+ (
                <Link href="/vs-language-reactor">comparison</Link>).
              </li>
              <li>
                <strong>HASHIGO!</strong> — furigana and JLPT coloring on Netflix.{" "}
                <Link href="/blog/hashigo-yomitan-netflix-japanese-anime-2026">Reader stack guide →</Link>
              </li>
              <li>
                <strong>Lingoku</strong> — AI dual subs + web blending; BYOK (
                <Link href="/vs-lingoku">vs AnimeVocab</Link>).
              </li>
              <li>
                <strong>YumeGo</strong> — grammar popups and phrase library on Netflix/Disney+ (
                <Link href="/vs-yumego">vs AnimeVocab</Link>).
              </li>
              <li>
                <strong>AnimeVocab</strong> — romaji cards + SRS; Listening Mode when you skip reading.
              </li>
              <li>
                <strong>asbplayer</strong> — mining with external files; advanced Anki pipeline.
              </li>
            </ul>

            <p>
              Missing Japanese audio on a title?{" "}
              <Link href="/blog/netflix-japanese-audio-not-available-2026">
                Netflix Japanese audio not available — fixes
              </Link>
              .
            </p>
            <p>
              Full post:{" "}
              <Link href="/blog/learn-japanese-netflix-anime-2026">
                Learn Japanese on Netflix anime in 2026 (blog)
              </Link>
              {" "}· hub: <Link href="/learn-japanese-netflix-anime">Netflix landing guide</Link>. Compare platforms:{" "}
              <Link href="/learn-japanese-crunchyroll">Crunchyroll guide</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Netflix night? Make it study.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/chrome-extension-learn-japanese-netflix-2026", label: "Netflix extensions" },
          { href: "/blog/hashigo-yomitan-netflix-japanese-anime-2026", label: "HASHIGO guide" },
          { href: "/vs-lingoku", label: "vs Lingoku" },
          { href: "/vs-yumego", label: "vs YumeGo" },
          { href: "/learn-japanese-disney-plus", label: "Disney+" },
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
