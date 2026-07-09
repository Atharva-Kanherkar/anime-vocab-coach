import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/vs-yumego";

export const metadata: Metadata = {
  title: "AnimeVocab vs YumeGo (2026): Netflix Dual Subs vs Romaji Crunchyroll Cards",
  description:
    "YumeGo offers AI grammar and dual subtitles on Netflix and Disney+. AnimeVocab adds romaji-first cards and Listening Mode on Crunchyroll and YouTube.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AnimeVocab vs YumeGo (2026)",
    description:
      "YumeGo is a polished Netflix/Disney+ reader with JLPT tagging. AnimeVocab covers Crunchyroll audio when JP subs are missing.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab vs YumeGo (2026)",
    description: "Netflix-focused vs Crunchyroll-first — honest anime Japanese tool comparison.",
  },
};

export default function VsYumegoPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="AnimeVocab vs YumeGo (2026): Netflix Dual Subs vs Romaji Crunchyroll Cards"
        description="YumeGo offers AI grammar and dual subtitles on Netflix and Disney+. AnimeVocab adds romaji-first cards and Listening Mode on Crunchyroll and YouTube."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "vs YumeGo" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AnimeVocab vs YumeGo"
          lede={
            <>
              <strong>YumeGo</strong> is a polished Netflix/Disney+ extension with hover grammar breakdowns,
              JLPT tags, phrase library, and dual subtitles — popular in French-speaking learner communities.
              <strong> AnimeVocab</strong> targets <strong>Crunchyroll simulcasts</strong> and{" "}
              <strong>romaji-first beginners</strong> when Japanese subtitle text is not on screen.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Netflix/Disney+ reader who wants grammar popups and phrase saves?</strong> YumeGo.{" "}
              <strong>Crunchyroll without JP subs or month-zero romaji?</strong> AnimeVocab. Free YumeGo caps
              active translation minutes; AnimeVocab core loop is free without a daily timer.
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
                    <th scope="col">YumeGo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Platforms</th>
                    <td className="us">Crunchyroll, Netflix, YouTube</td>
                    <td>Netflix, Disney+, YouTube</td>
                  </tr>
                  <tr>
                    <th scope="row">Crunchyroll</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Romaji-first</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Grammar AI</th>
                    <td className="us">Word gloss + line context</td>
                    <td>DeepSeek grammar breakdowns</td>
                  </tr>
                  <tr>
                    <th scope="row">Listening / no JP subs</th>
                    <td className="us">
                      <span className="yes">Listening Mode</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Free tier limits</th>
                    <td className="us">SRS + cards free</td>
                    <td>~20 min/day active translation</td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td>Free · Premium subscription</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="wrap prose" style={{ paddingInline: 0, marginTop: 24 }}>
              <h2>When YumeGo fits</h2>
              <p>
                You watch Netflix or Disney+ with Japanese subtitle tracks, read kana, and want{" "}
                <strong>phrase-level saves</strong> with grammar explanations and JLPT labels. YumeGo&apos;s
                dashboard and streak tracking reward long Netflix sessions. Compare similar AI readers:{" "}
                <Link href="/vs-lingoku">vs Lingoku</Link>,{" "}
                <Link href="/vs-trancy">vs Trancy</Link>.
              </p>
              <h2>When AnimeVocab fits</h2>
              <p>
                Your weekly habit is <strong>Crunchyroll simulcasts</strong> — often English-only subs — or
                YouTube clips where you hear words but cannot read them. AnimeVocab ships{" "}
                <strong>romaji-first SRS</strong> without a daily translation timer.{" "}
                <Link href="/learn-japanese-crunchyroll">Crunchyroll guide</Link> ·{" "}
                <Link href="/blog/yumego-alternative-anime-japanese-2026">YumeGo alternative post</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Match the tool to your streaming habit.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/yumego-alternative-anime-japanese-2026", label: "YumeGo guide" },
          { href: "/vs-lingoku", label: "vs Lingoku" },
          { href: "/learn-japanese-netflix-anime", label: "Netflix guide" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
