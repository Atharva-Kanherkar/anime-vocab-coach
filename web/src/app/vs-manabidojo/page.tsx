import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/vs-manabidojo";

export const metadata: Metadata = {
  title: "AnimeVocab vs ManabiDojo (2026) — Best ManabiDojo Alternative?",
  description:
    "AnimeVocab vs ManabiDojo for Crunchyroll Japanese: fan-sub overlays vs romaji-first Listening Mode. Free alternative when you can't read JP subs yet.",
  keywords: [
    "animevocab vs manabidojo",
    "manabidojo vs animevocab",
    "manabidojo alternative",
    "manabidojo free alternative",
    "manabi dojo crunchyroll",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AnimeVocab vs ManabiDojo (2026)",
    description:
      "ManabiDojo overlays fan Japanese subs with quizzes. AnimeVocab is the free alternative for beginners and audio-only Crunchyroll.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab vs ManabiDojo (2026)",
    description: "Compare ManabiDojo and AnimeVocab — reader overlay vs romaji-first Listening Mode.",
  },
};

const faqs = [
  {
    question: "Is AnimeVocab a ManabiDojo alternative?",
    answer:
      "Yes for beginners and for episodes without overlay-ready Japanese subtitles. AnimeVocab uses romaji-first cards and Listening Mode from audio. It does not replace ManabiDojo's fan-sub overlay for readers.",
  },
  {
    question: "Is ManabiDojo free?",
    answer:
      "ManabiDojo has a free core for fan-sub overlays on supported titles, with premium for flashcards and quizzes. AnimeVocab's core SRS is free forever without gating reviews behind premium.",
  },
  {
    question: "ManabiDojo vs AnimeVocab — which for Crunchyroll?",
    answer:
      "Choose ManabiDojo if you can read Japanese and want integrated fan subs + quizzes. Choose AnimeVocab if you need romaji or the episode has no Japanese text track.",
  },
  {
    question: "Should I use both?",
    answer:
      "Often yes. Use AnimeVocab on hard or audio-only shows; switch to ManabiDojo or Lexirise once kana clicks and you want full JP overlays.",
  },
];

export default function VsManabiDojoPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="AnimeVocab vs ManabiDojo (2026) — Best ManabiDojo Alternative?"
        description="AnimeVocab vs ManabiDojo for Crunchyroll Japanese: fan-sub overlays vs romaji-first Listening Mode."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "vs ManabiDojo" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AnimeVocab vs ManabiDojo"
          lede={
            <>
              <strong>ManabiDojo</strong> is a Chrome extension that layers fan Japanese subtitles onto
              Crunchyroll and Netflix, with quizzes and premium flashcards. <strong>AnimeVocab</strong> is the{" "}
              <strong>ManabiDojo alternative</strong> for learners who <strong>cannot read those subtitles
              yet</strong> — romaji-first cards plus audio transcription when no Japanese text track exists.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Already reading Japanese subs and want Jimaku-style integration?</strong> ManabiDojo.{" "}
              <strong>Month-zero or audio-only Crunchyroll?</strong> AnimeVocab Listening Mode. Dedicated
              guide: <Link href="/manabidojo-alternative">ManabiDojo alternative</Link>.
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
                    <th scope="col">ManabiDojo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Best for</th>
                    <td className="us">Beginners · romaji · audio-first</td>
                    <td>Readers · fan JP subs · quizzes</td>
                  </tr>
                  <tr>
                    <th scope="row">Crunchyroll</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                      <span className="cell-note">transcribes audio</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                      <span className="cell-note">fan subtitle overlay</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Netflix</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td>Free tier · premium for SRS/quizzes</td>
                  </tr>
                  <tr>
                    <th scope="row">Built-in SRS</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>Premium</td>
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
              <h2>When ManabiDojo wins</h2>
              <p>
                You can read hiragana, want <strong>integrated fan Japanese subtitles</strong> on supported
                titles, and like bundled quizzes. ManabiDojo sits in the same lane as Jimaku-style overlays —
                see our{" "}
                <Link href="/blog/jimaku-crunchyroll-subtitles-vs-listening-mode">
                  Jimaku vs Listening Mode comparison
                </Link>
                .
              </p>
              <h2>When AnimeVocab wins (best ManabiDojo alternative)</h2>
              <p>
                You need <strong>romaji-first</strong> vocabulary, zero subtitle-file hunting, or the episode
                has <strong>no overlay-ready Japanese track</strong>. AnimeVocab pushes one word per line with
                free SRS. Full workflow: <Link href="/learn-japanese-crunchyroll">Crunchyroll guide</Link>,{" "}
                <Link href="/manabidojo-alternative">ManabiDojo alternative hub</Link>,{" "}
                <Link href="/vs-lexirise">vs Lexirise</Link>,{" "}
                <Link href="/migaku-free-alternative">Migaku free alternative</Link>.
              </p>

              <h2>FAQ</h2>
              {faqs.map((f) => (
                <div key={f.question}>
                  <h3>{f.question}</h3>
                  <p>{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Start from audio, not subtitle files.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/manabidojo-alternative", label: "ManabiDojo alternative" },
          { href: "/migaku-free-alternative", label: "Migaku free alt" },
          { href: "/vs-lexirise", label: "vs Lexirise" },
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
