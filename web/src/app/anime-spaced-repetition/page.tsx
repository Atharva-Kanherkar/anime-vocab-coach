import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/anime-spaced-repetition";

export const metadata: Metadata = {
  title: "Spaced Repetition for Anime Vocabulary (2026 Guide)",
  description:
    "Spaced repetition (SRS) for anime Japanese vocabulary — daily loop, Anki vs built-in review, and why binge watching fails without recall.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Spaced Repetition for Anime Vocabulary",
    description: "Turn anime input into long-term memory with SRS — workflows and tool comparison.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Anime Spaced Repetition Guide",
    description: "SRS for Japanese vocabulary from anime — daily habits that stick.",
  },
};

export default function AnimeSpacedRepetitionPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="Spaced Repetition for Anime Vocabulary (2026 Guide)"
        description="Spaced repetition (SRS) for anime Japanese vocabulary — daily loop, Anki vs built-in review, and why binge watching fails without recall."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/blog", label: "Blog" },
            { label: "Spaced repetition" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Spaced repetition for anime vocabulary"
          lede={
            <>
              Anime gives you input; <strong>spaced repetition (SRS)</strong> gives you recall. Without review,
              binge watching feels productive but vocabulary decays within days. Migaku, Anki, WaniKani, and
              extension-built decks all implement the same science with different setup cost.
            </>
          }
          verdictTag="Minimum loop"
          verdict={
            <>
              Capture <strong>word + line + show</strong>, review five minutes before the next episode, cap new
              words at five to ten per session. Built-in SRS (AnimeVocab, Migaku) beats Anki if setup kills your
              habit.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Built-in SRS vs Anki export</h2>
            <ul>
              <li>
                <strong>Anki + asbplayer</strong> — maximum control; highest setup friction.
              </li>
              <li>
                <strong>Migaku</strong> — deep mining suite with mobile sync ($9/mo).
              </li>
              <li>
                <strong>AnimeVocab</strong> — local SRS tied to words you clicked while watching; free core.
              </li>
              <li>
                <strong>Language Reactor</strong> — light export; you bring Anki discipline.
              </li>
            </ul>

            <p>
              Full guide:{" "}
              <Link href="/blog/spaced-repetition-anime-vocabulary">
                Spaced repetition for anime vocabulary (blog)
              </Link>
              {" "}· hub: <Link href="/anime-spaced-repetition">SRS landing page</Link>. Method:{" "}
              <Link href="/blog/one-word-per-episode-method">one word per episode</Link>. Tools:{" "}
              <Link href="/learn-japanese-with-anime">2026 ranking</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Review beats bingeing.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Install AnimeVocab
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog", label: "Blog" },
          { href: "/best-anime-to-learn-japanese", label: "Best anime" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
