import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/vs-lingoku";

export const metadata: Metadata = {
  title: "AnimeVocab vs Lingoku (2026): AI Dual Subs vs Romaji-First Anime Cards",
  description:
    "Lingoku offers AI dual subtitles and web word blending on Netflix and YouTube. AnimeVocab targets month-zero learners with romaji-first cards and Listening Mode on Crunchyroll.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AnimeVocab vs Lingoku (2026)",
    description:
      "Lingoku is AI-heavy for readers on Netflix/YouTube. AnimeVocab is romaji-first with built-in SRS when you cannot read kana or JP subs are missing.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab vs Lingoku (2026)",
    description: "Honest comparison for anime Japanese learners picking an extension in 2026.",
  },
};

export default function VsLingokuPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="AnimeVocab vs Lingoku (2026): AI Dual Subs vs Romaji-First Anime Cards"
        description="Lingoku offers AI dual subtitles and web word blending on Netflix and YouTube. AnimeVocab targets month-zero learners with romaji-first cards and Listening Mode on Crunchyroll."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "vs Lingoku" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AnimeVocab vs Lingoku"
          lede={
            <>
              <strong>Lingoku</strong> is the 2026 AI immersion extension: dual subtitles on Netflix/YouTube,
              contextual word blending on English websites, BYOK models (Ollama, DeepSeek, OpenAI), and no
              signup. <strong>AnimeVocab</strong> is narrower — <strong>romaji-first word cards</strong> and{" "}
              <strong>Listening Mode</strong> when Crunchyroll has no Japanese subtitle text to read.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Read kana and want AI glosses on Netflix dual subs?</strong> Lingoku.{" "}
              <strong>Month-zero on Crunchyroll or cannot parse Japanese subtitles yet?</strong> AnimeVocab.
              Many learners start with AnimeVocab, add Lingoku or Language Reactor once hiragana clicks.
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
                    <th scope="col">Lingoku</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Platforms</th>
                    <td className="us">Crunchyroll, Netflix, YouTube</td>
                    <td>Netflix, YouTube, Bilibili, any website</td>
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
                      <span className="cell-note">assumes script literacy</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Listening / no JP subs</th>
                    <td className="us">
                      <span className="yes">Listening Mode</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">needs subtitle text</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">AI setup</th>
                    <td className="us">None required</td>
                    <td>BYOK optional (Ollama, DeepSeek, etc.)</td>
                  </tr>
                  <tr>
                    <th scope="row">Built-in SRS</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>Exposure-based review</td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td>Free tier + API costs if BYOK</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="wrap prose" style={{ paddingInline: 0, marginTop: 24 }}>
              <h2>When Lingoku is the right pick</h2>
              <p>
                You already read hiragana, watch Netflix or YouTube with Japanese subtitle tracks, and want{" "}
                <strong>AI contextual explanations</strong> without pausing. Lingoku also blends Japanese tokens
                into English news pages for passive exposure — a comprehensible-input play that works once you can
                recognize script. Deep dive:{" "}
                <Link href="/blog/lingoku-alternative-anime-japanese-2026">Lingoku alternative guide</Link>.
              </p>
              <h2>When AnimeVocab wins</h2>
              <p>
                Crunchyroll simulcasts often ship English-only subs. Lingoku cannot mine text that is not on
                screen. AnimeVocab transcribes spoken Japanese into <strong>romaji-first cards</strong> and
                schedules review — no API key, no Anki wiring.{" "}
                <Link href="/learn-japanese-crunchyroll">Crunchyroll workflow</Link> ·{" "}
                <Link href="/romaji-japanese-learning">Romaji learning guide</Link>.
              </p>
              <h2>Third option: Language Reactor</h2>
              <p>
                Mature dual-sub player without AI blending or BYOK — see{" "}
                <Link href="/vs-language-reactor">AnimeVocab vs Language Reactor</Link>. Netflix reader stack
                with furigana:{" "}
                <Link href="/blog/hashigo-yomitan-netflix-japanese-anime-2026">HASHIGO + Yomitan</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Start with audio, add AI readers later.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/lingoku-alternative-anime-japanese-2026", label: "Lingoku guide" },
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: "/blog/best-chrome-extensions-learn-japanese-anime-2026", label: "Extension ranking" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
