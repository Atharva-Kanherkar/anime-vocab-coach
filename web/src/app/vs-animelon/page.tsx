import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/vs-animelon";

export const metadata: Metadata = {
  title: "Animelon Alternative (2026): Free Romaji Anime Without the Gray Catalog",
  description:
    "Best Animelon alternative for 2026: AnimeVocab — romaji-first cards on Netflix, Crunchyroll, and YouTube you already pay for. No unreliable hosted catalog.",
  keywords: [
    "animelon alternative",
    "animelon alternatives",
    "best animelon alternative",
    "animelon replacement",
    "animelon free alternative",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Animelon Alternative (2026)",
    description:
      "Animelon was romaji-first but legally gray and unstable. AnimeVocab learns from the anime you already watch legally.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Animelon Alternative (2026)",
    description: "Free Animelon alternative — romaji vocabulary on legal streams.",
  },
};

export default function VsAnimelonPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="Animelon Alternative (2026): Free Romaji Anime Without the Gray Catalog"
        description="Best Animelon alternative for 2026: AnimeVocab — romaji-first cards on Netflix, Crunchyroll, and YouTube you already pay for. No unreliable hosted catalog."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "Animelon alternative" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Animelon Alternative (2026)"
          lede={
            <>
              Searching for an <strong>Animelon alternative</strong>?{" "}
              <strong>Animelon</strong> was beloved for switchable romaji/hiragana/kanji subtitle modes on a
              free anime catalog. It also lived in a <strong>legally gray</strong> hosting model and breaks
              often — titles vanish, players fail. <strong>AnimeVocab</strong> keeps the{" "}
              <strong>romaji-first beginner</strong> idea but runs on streams you already have rights to watch.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Want romaji subs on a hosted gray catalog?</strong> Animelon when it works.{" "}
              <strong>Want romaji vocabulary from Netflix, Crunchyroll, or YouTube tonight?</strong> AnimeVocab.
              Most learners should not depend on a catalog that can disappear mid-season.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">&nbsp;</th>
                    <th scope="col" className="us">
                      AnimeVocab
                    </th>
                    <th scope="col">Animelon</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Content source</th>
                    <td className="us">Your Netflix / CR / YouTube</td>
                    <td>Hosted anime site</td>
                  </tr>
                  <tr>
                    <th scope="row">Romaji support</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Reliability</th>
                    <td className="us">Extension + official streams</td>
                    <td>Often down / titles removed</td>
                  </tr>
                  <tr>
                    <th scope="row">Built-in SRS</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>Quizzes only</td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td>
                      <span className="yes">Free</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="wrap prose" style={{ paddingInline: 0, marginTop: 24 }}>
              <h2>When Animelon still gets mentioned</h2>
              <p>
                Reddit and old guides cite Animelon as the only free <strong>romaji subtitle mode</strong>{" "}
                option. That was true for years. In 2026, alternatives include AnimeVocab on legal streams and
                fan-sub overlays (Jimaku, ManabiDojo) for readers — see{" "}
                <Link href="/blog/animelon-alternative-anime-japanese-2026">Animelon alternative deep dive</Link>
                .
              </p>
              <h2>When AnimeVocab wins</h2>
              <p>
                You want tonight&apos;s simulcast on Crunchyroll, your Netflix queue, or a YouTube clip — with{" "}
                <strong>one word per line</strong> and review scheduling. No hunting a mirror site.{" "}
                <Link href="/romaji-japanese-learning">Romaji learning guide</Link> ·{" "}
                <Link href="/learn-japanese-crunchyroll">Crunchyroll workflow</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Learn from the anime you already pay for.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/animelon-alternative-anime-japanese-2026", label: "Animelon alternative post" },
          { href: "/vs-manabidojo", label: "vs ManabiDojo" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
