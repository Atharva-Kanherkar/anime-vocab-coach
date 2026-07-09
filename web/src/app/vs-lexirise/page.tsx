import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/vs-lexirise";

export const metadata: Metadata = {
  title: "AnimeVocab vs Lexirise (2026): Crunchyroll Anime Learning Extensions",
  description:
    "AnimeVocab vs Lexirise on Crunchyroll — romaji-first Listening Mode vs dual subtitles and click-to-translate. Which fits beginners vs readers?",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AnimeVocab vs Lexirise (2026)",
    description:
      "Lexirise offers dual subs and mining on Crunchyroll. AnimeVocab offers romaji-first cards and audio transcription when JP subs are missing.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab vs Lexirise (2026)",
    description: "Honest Crunchyroll-focused comparison for anime Japanese learners.",
  },
};

export default function VsLexirisePage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="AnimeVocab vs Lexirise (2026): Crunchyroll Anime Learning Extensions"
        description="AnimeVocab vs Lexirise on Crunchyroll — romaji-first Listening Mode vs dual subtitles and click-to-translate. Which fits beginners vs readers?"
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "vs Lexirise" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AnimeVocab vs Lexirise"
          lede={
            <>
              Both extensions target <strong>learn Japanese on Crunchyroll</strong> — the platform Migaku
              skips. Lexirise is a <strong>dual-subtitle reader with click-to-translate</strong>. AnimeVocab
              is a <strong>romaji-first word card + Listening Mode</strong> tool when you cannot read kana or
              when Japanese subtitle text is not available.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Cannot read Japanese subtitles yet?</strong> AnimeVocab.{" "}
              <strong>Already reading and want dual subs + mining on Crunchyroll?</strong> Lexirise core is
              free. Many learners start with AnimeVocab, add Lexirise after kana — they solve different
              bottlenecks.
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
                    <th scope="col">Lexirise</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Best for</th>
                    <td className="us">Beginners · romaji · audio-first</td>
                    <td>Readers · dual subs · mining</td>
                  </tr>
                  <tr>
                    <th scope="row">Crunchyroll</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                      <span className="cell-note">transcribes audio</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                      <span className="cell-note">uses on-screen text</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td>Free core · Pro for SRS extras</td>
                  </tr>
                  <tr>
                    <th scope="row">Built-in SRS</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>Pro tier</td>
                  </tr>
                  <tr>
                    <th scope="row">Open source</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="wrap prose" style={{ paddingInline: 0, marginTop: 24 }}>
              <h2>When Lexirise wins</h2>
              <p>
                You read hiragana/katakana, want <strong>dual subtitles</strong> on Crunchyroll, and like
                click-to-translate mining into a vocabulary library. Lexirise explicitly markets itself as the
                answer to <strong>Migaku Crunchyroll</strong> searches.
              </p>
              <h2>When AnimeVocab wins</h2>
              <p>
                You are month-zero, need <strong>romaji-first</strong> cards, or the episode has{" "}
                <strong>no Japanese subtitle track</strong> — AnimeVocab&apos;s Listening Mode works from audio.
                See our <Link href="/learn-japanese-crunchyroll">Crunchyroll guide</Link> and{" "}
                <Link href="/romaji-japanese-learning">romaji learning page</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Try the beginner path first.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
