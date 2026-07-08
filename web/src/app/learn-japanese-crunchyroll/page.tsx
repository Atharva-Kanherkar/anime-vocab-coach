import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/learn-japanese-crunchyroll";

export const metadata: Metadata = {
  title: "Learn Japanese on Crunchyroll (2026): No JP Subs, Real Workflows",
  description:
    "Learn Japanese on Crunchyroll when Japanese subtitles are missing. Compare AnimeVocab, Lexirise, and ManabiDojo — transcription, romaji, and SRS that work on simulcasts.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Learn Japanese on Crunchyroll (2026)",
    description:
      "Crunchyroll rarely ships Japanese subtitle tracks. Here is how to learn Japanese on Crunchyroll anyway — tools, workflows, and what to avoid.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese on Crunchyroll (2026)",
    description: "How to learn Japanese on Crunchyroll without Japanese subtitles — tools and daily workflow.",
  },
};

export default function LearnJapaneseCrunchyrollPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese on Crunchyroll (2026): No JP Subs, Real Workflows"
        description="Learn Japanese on Crunchyroll when Japanese subtitles are missing. Compare AnimeVocab, Lexirise, and ManabiDojo — transcription, romaji, and SRS that work on simulcasts."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Crunchyroll" },
          ]}
        />

        <CompareHero
          title="Learn Japanese on Crunchyroll"
          lede={
            <>
              Crunchyroll is where anime fans actually watch — but outside Japan, most titles ship with{" "}
              <strong>English subtitles only</strong>. That breaks tools that need Japanese text in the
              player (Language Reactor, Migaku on Crunchyroll, raw mining). You can still{" "}
              <strong>learn Japanese on Crunchyroll</strong> if you work from audio and review what you save.
            </>
          }
          verdictTag="Start here"
          verdict={
            <>
              Use <strong>Japanese audio + deliberate vocabulary capture</strong>. Keep English subs for plot
              if you want, but save words from what was spoken — not from the English translation.{" "}
              <strong>AnimeVocab</strong> transcribes lines when JP subs are missing;{" "}
              <strong>Lexirise</strong> works when subtitle text exists in the DOM. Pick based on whether you
              read kana yet.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Why Crunchyroll is hard for Japanese learners</h2>
            <p>
              Licensing limits Japanese subtitle tracks in many regions. Community threads (WaniKani, Reddit)
              have documented this for years: you get English translations, not Japanese transcriptions. Migaku
              does not support Crunchyroll; learners searching <strong>Migaku Crunchyroll</strong> hit a dead
              end. Fan subtitle workflows (Jimaku + asbplayer) work for advanced readers, not month-zero
              beginners.
            </p>

            <h2>Tools that work on Crunchyroll in 2026</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Best for</th>
                    <th scope="col">JP subs required?</th>
                    <th scope="col">Built-in review</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="us">
                      AnimeVocab
                    </th>
                    <td className="us">Beginners · romaji-first · Listening Mode</td>
                    <td className="us">
                      <span className="yes">No</span>
                    </td>
                    <td className="us">
                      <span className="yes">SRS</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Lexirise</th>
                    <td>Readers · dual subs · click-to-translate</td>
                    <td>Partial (uses available text)</td>
                    <td>Pro SRS</td>
                  </tr>
                  <tr>
                    <th scope="row">ManabiDojo</th>
                    <td>Integrated JP subs for select titles</td>
                    <td>Often yes (fan subs)</td>
                    <td>Flashcards (premium)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>20-minute Crunchyroll study session</h2>
            <ol className="article-ol">
              <li>
                Pick a slow slice-of-life show from our{" "}
                <Link href="/best-anime-to-learn-japanese">best anime for beginners</Link> list.
              </li>
              <li>Watch one episode — notice one repeated word or phrase per scene.</li>
              <li>Save it with the line and show title (extension or notebook).</li>
              <li>Review for five minutes before the next episode — SRS beats bingeing.</li>
            </ol>

            <p>
              Deep dive:{" "}
              <Link href="/blog/learn-japanese-crunchyroll-no-japanese-subs">
                Learn Japanese on Crunchyroll when there are no Japanese subtitles
              </Link>
              , or compare{" "}
              <Link href="/blog/jimaku-crunchyroll-subtitles-vs-listening-mode">
                Jimaku Player vs Listening Mode
              </Link>
              . Compare <Link href="/vs-lexirise">AnimeVocab vs Lexirise</Link>,{" "}
              <Link href="/vs-manabidojo">vs ManabiDojo</Link>, or see the full{" "}
              <Link href="/learn-japanese-with-anime">2026 tool ranking</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Simulcast tonight? Learn a word from it.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog", label: "Blog" },
          { href: "/best-anime-to-learn-japanese", label: "Best anime" },
          { href: "/vs-lexirise", label: "vs Lexirise" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
