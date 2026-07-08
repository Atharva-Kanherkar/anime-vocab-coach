import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/best-anime-to-learn-japanese";

export const metadata: Metadata = {
  title: "Best Anime to Learn Japanese (2026): Beginner Rankings",
  description:
    "Best anime to learn Japanese for beginners — Shirokuma Cafe, Non Non Biyori, Doraemon, and shows to avoid. Ranked for slow dialogue and everyday vocabulary.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Best Anime to Learn Japanese for Beginners (2026)",
    description: "Ranked beginner anime for Japanese listening practice — slice-of-life picks and shonen to skip.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Best Anime to Learn Japanese (2026)",
    description: "Beginner-ranked anime for Japanese vocabulary and listening — plus study workflow.",
  },
};

export default function BestAnimePage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="Best Anime to Learn Japanese (2026): Beginner Rankings"
        description="Best anime to learn Japanese for beginners — Shirokuma Cafe, Non Non Biyori, Doraemon, and shows to avoid. Ranked for slow dialogue and everyday vocabulary."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/blog", label: "Blog" },
            { label: "Best anime" },
          ]}
        />

        <CompareHero
          title="Best anime to learn Japanese"
          lede={
            <>
              The <strong>best anime to learn Japanese</strong> is not your favorite shonen — it is the show
              with slow, clear, everyday speech you will rewatch. This page ranks beginner-friendly titles
              the immersion community actually recommends, plus a short list of shows to save for later.
            </>
          }
          verdictTag="Tier 1 picks"
          verdict={
            <>
              Start with <strong>Shirokuma Cafe</strong>, <strong>Non Non Biyori</strong>, or{" "}
              <strong>Doraemon</strong>. Pair any of them with one-word-per-episode capture and daily review —
              not passive English-sub bingeing.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Tier 1 — start here</h2>
            <ul>
              <li>
                <strong>Shirokuma Cafe</strong> — slow dialogue, daily-life vocabulary, community favorite on
                r/LearnJapanese.
              </li>
              <li>
                <strong>Non Non Biyori</strong> — rural slice-of-life, long pauses, perfect for shadowing.
              </li>
              <li>
                <strong>Doraemon / Sazae-san</strong> — repetitive family Japanese; classic beginner immersion
                picks in Migaku and Trancy guides.
              </li>
            </ul>

            <h2>Tier 2 — after a month</h2>
            <ul>
              <li>
                <strong>K-On!</strong> — school speech and music vocab; still mostly standard Japanese.
              </li>
              <li>
                <strong>Studio Ghibli films</strong> — short runtime, emotional lines worth replaying in
                clip-based study.
              </li>
            </ul>

            <h2>Save for later</h2>
            <ul>
              <li>
                <strong>Attack on Titan, Jujutsu Kaisen, Chainsaw Man</strong> — great shows, bad first
                textbooks (slang, shouting, fantasy terms).
              </li>
              <li>
                <strong>Heavy dialect comedy</strong> — fun once you hear standard Tokyo pitch reliably.
              </li>
            </ul>

            <p>
              Full write-up with ranking criteria:{" "}
              <Link href="/blog/best-anime-to-learn-japanese-beginners">
                Best anime to learn Japanese for beginners (2026 ranked)
              </Link>
              {" "}· hub: <Link href="/best-anime-to-learn-japanese">this landing page</Link>. Workflow:{" "}
              <Link href="/blog/one-word-per-episode-method">one word per episode</Link>,{" "}
              <Link href="/anime-spaced-repetition">spaced repetition</Link>, tools on{" "}
              <Link href="/learn-japanese-crunchyroll">Crunchyroll</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Pick a show. Learn one word tonight.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Install AnimeVocab (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog", label: "Blog" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/learn-japanese-with-anime", label: "Compare tools" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
