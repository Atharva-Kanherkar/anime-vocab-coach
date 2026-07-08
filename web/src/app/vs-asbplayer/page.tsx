import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/vs-asbplayer";

export const metadata: Metadata = {
  title: "AnimeVocab vs asbplayer (2026): Romaji Cards vs Anki Sentence Mining",
  description:
    "asbplayer mines anime sentences into Anki from Japanese subtitles. AnimeVocab offers romaji-first one-word cards and Listening Mode when you cannot read subs yet.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AnimeVocab vs asbplayer (2026)",
    description:
      "asbplayer is the browser sentence miner. AnimeVocab is the month-zero romaji on-ramp with built-in SRS.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab vs asbplayer (2026)",
    description: "Honest comparison for anime Japanese learners choosing a mining stack.",
  },
};

export default function VsAsbplayerPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="AnimeVocab vs asbplayer (2026): Romaji Cards vs Anki Sentence Mining"
        description="asbplayer mines anime sentences into Anki from Japanese subtitles. AnimeVocab offers romaji-first one-word cards and Listening Mode when you cannot read subs yet."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "vs asbplayer" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AnimeVocab vs asbplayer"
          lede={
            <>
              <strong>asbplayer</strong> is the immersion community&apos;s browser miner: sync fan subtitle
              files, screenshot+audio+sentence into <strong>Anki</strong>, bolt on Yomitan.{" "}
              <strong>AnimeVocab</strong> is not a miner — it pushes <strong>one romaji-first word per line</strong>{" "}
              with built-in SRS on Crunchyroll, Netflix, and YouTube, including when JP subtitle text is missing.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Read Japanese subs and want rich Anki sentence cards?</strong> asbplayer (or desktop{" "}
              <Link href="/blog/subminer-vs-asbplayer-anime-mining-2026">SubMiner</Link>).{" "}
              <strong>Month-zero or Crunchyroll without JP subs?</strong> AnimeVocab first — graduate to miners
              once kana clicks.
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
                    <th scope="col">asbplayer</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Output</th>
                    <td className="us">Romaji-first word cards</td>
                    <td>Anki sentence cards (audio + image)</td>
                  </tr>
                  <tr>
                    <th scope="row">Requires reading JP subs</th>
                    <td className="us">
                      <span className="no">No</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Anki required</th>
                    <td className="us">
                      <span className="no">No</span>
                      <span className="cell-note">built-in SRS</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Fan subtitle files</th>
                    <td className="us">Not needed</td>
                    <td>Often required (Jimaku, Kitsunekko)</td>
                  </tr>
                  <tr>
                    <th scope="row">Crunchyroll no JP subs</th>
                    <td className="us">
                      <span className="yes">Listening Mode</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td>
                      <span className="yes">Free</span>
                      <span className="cell-note">open source</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="wrap prose" style={{ paddingInline: 0, marginTop: 24 }}>
              <h2>What asbplayer assumes</h2>
              <p>
                You maintain Anki, find or align Japanese `.srt` files, and click tokens with Yomitan. Power
                users love the control. Setup per show is real work — see{" "}
                <Link href="/blog/kitsunekko-subtitles-anime-2026">Kitsunekko subtitle workflow</Link> and{" "}
                <Link href="/blog/jimaku-crunchyroll-subtitles-vs-listening-mode">Jimaku vs Listening Mode</Link>.
              </p>
              <h2>What AnimeVocab optimizes for</h2>
              <p>
                One useful word tonight with romaji, meaning, and review scheduling — no note types, no mining
                macros. Compare deeper suites: <Link href="/vs-migaku">vs Migaku</Link>,{" "}
                <Link href="/vs-manabidojo">vs ManabiDojo</Link>. Romaji path:{" "}
                <Link href="/romaji-japanese-learning">romaji guide</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Start simple. Mine later.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/subminer-vs-asbplayer-anime-mining-2026", label: "SubMiner vs asbplayer" },
          { href: "/blog/asbplayer-alternative-beginners-anime-japanese", label: "asbplayer deep dive" },
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
