import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/vs-trancy";

export const metadata: Metadata = {
  title: "AnimeVocab vs Trancy (2026): AI Subtitles vs Romaji Word Cards",
  description:
    "AnimeVocab vs Trancy for learning Japanese from anime — Whisper subtitles vs romaji-first cards, pricing, and who each tool serves.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AnimeVocab vs Trancy (2026)",
    description: "Trancy generates AI bilingual subtitles. AnimeVocab pushes one romaji word per line with SRS.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab vs Trancy",
    description: "Compare Trancy AI subtitles with AnimeVocab romaji-first learning.",
  },
};

export default function VsTrancyPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="AnimeVocab vs Trancy (2026): AI Subtitles vs Romaji Word Cards"
        description="AnimeVocab vs Trancy for learning Japanese from anime — Whisper subtitles vs romaji-first cards, pricing, and who each tool serves."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "vs Trancy" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AnimeVocab vs Trancy"
          lede={
            <>
              Trancy markets <strong>AI bilingual subtitles</strong> (Whisper-powered) for anime and YouTube —
              strong immersion overlay, subscription for heavy transcription. AnimeVocab focuses on{" "}
              <strong>one useful word per line in romaji</strong> with built-in SRS, open source, and a free core
              aimed at beginners who do not want subtitle walls of kanji.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              Want <strong>full bilingual subtitles on screen</strong> and will pay for AI minutes? Trancy. Want{" "}
              <strong>zero-setup vocabulary capture</strong> with review built in — especially on Crunchyroll
              without reading kana? AnimeVocab.
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
                    <th scope="col">Trancy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Core model</th>
                    <td className="us">One word card per line · romaji-first</td>
                    <td>AI dual subtitles + lookups</td>
                  </tr>
                  <tr>
                    <th scope="row">Beginner (no kana)</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>Partial (phonetic subs, paid AI)</td>
                  </tr>
                  <tr>
                    <th scope="row">Built-in SRS</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>Light flashcards</td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td>Free tier · from ~$4/mo</td>
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
              <p>
                Trancy&apos;s blog pushes active techniques — shadowing, bilingual subs, vocabulary review — aligned
                with what SLA research recommends. AnimeVocab automates the smallest slice of that stack for
                beginners. See{" "}
                <Link href="/blog/shadowing-anime-japanese-pronunciation">shadowing with anime</Link> and{" "}
                <Link href="/learn-japanese-crunchyroll">Crunchyroll workflows</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Start free tonight.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/vs-lexirise", label: "vs Lexirise" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
