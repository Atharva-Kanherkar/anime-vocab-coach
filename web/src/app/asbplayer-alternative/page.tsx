import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/asbplayer-alternative";

export const metadata: Metadata = {
  title: "asbplayer Alternative (2026) — Learn Anime Japanese Without Anki Mining",
  description:
    "Best asbplayer alternative for beginners: AnimeVocab — romaji-first cards + built-in SRS on Netflix and Crunchyroll. No fan-sub files or Anki required to start.",
  keywords: [
    "asbplayer alternative",
    "asbplayer netflix",
    "asbplayer alternative beginners",
    "asbplayer vs",
    "anime anki alternative",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "asbplayer Alternative (2026)",
    description:
      "asbplayer mines sentences into Anki. AnimeVocab is the month-zero romaji on-ramp with built-in SRS.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "asbplayer Alternative (2026)",
    description: "Free asbplayer alternative for beginners — romaji cards without Anki setup.",
  },
};

const faqs = [
  {
    question: "What is the best asbplayer alternative?",
    answer:
      "If you cannot read Japanese subtitles yet or do not want an Anki mining pipeline, AnimeVocab is the best asbplayer alternative: romaji-first one-word cards with built-in SRS. If you already read JP subs and want rich Anki sentence cards, stay on asbplayer (or SubMiner).",
  },
  {
    question: "Does asbplayer work on Netflix?",
    answer:
      "asbplayer can work with Netflix when you have Japanese subtitle files or tracks to mine from. Setup is heavier than a dual-sub reader. Beginners who only want vocabulary tonight usually prefer AnimeVocab or Language Reactor instead.",
  },
  {
    question: "asbplayer vs AnimeVocab — which should I use?",
    answer:
      "asbplayer wins for immersion learners who mine full sentences into Anki with audio and screenshots. AnimeVocab wins for month-zero learners and Crunchyroll nights without JP subs. Graduate to miners once kana clicks.",
  },
  {
    question: "Is there a free asbplayer alternative?",
    answer:
      "Yes. AnimeVocab's core cards and local SRS are free forever — no Anki required. asbplayer itself is also free, but the workflow assumes Japanese subtitle files and Anki.",
  },
  {
    question: "Does AnimeVocab replace asbplayer mining?",
    answer:
      "No. AnimeVocab is not a sentence miner. It pushes one curated romaji-first word per line with built-in SRS — an on-ramp, not an Anki pipeline replacement.",
  },
];

export default function AsbplayerAlternativePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="asbplayer Alternative (2026) — Learn Anime Japanese Without Anki Mining"
        description="Best asbplayer alternative for beginners: AnimeVocab — romaji-first cards + built-in SRS. No fan-sub files or Anki required to start."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "asbplayer alternative" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="asbplayer alternative (2026)"
          lede={
            <>
              Searching <strong>asbplayer alternative</strong>? asbplayer is the immersion community&apos;s
              browser miner — sync fan subs, screenshot + audio + sentence into <strong>Anki</strong>, bolt on
              Yomitan. <strong>AnimeVocab</strong> is the free alternative when you are not ready for that
              pipeline: one romaji-first word per line with built-in SRS.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Read JP subs and want Anki sentence cards?</strong> Stay on asbplayer (or{" "}
              <Link href="/blog/subminer-vs-asbplayer-anime-mining-2026">SubMiner</Link>).{" "}
              <strong>Month-zero / no JP track?</strong> AnimeVocab. Full table:{" "}
              <Link href="/vs-asbplayer">AnimeVocab vs asbplayer</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>What asbplayer is good at</h2>
            <p>
              asbplayer turns anime (and other video) into rich <strong>Anki sentence cards</strong> — audio,
              image, and Japanese text — when you already have subtitle files or readable JP tracks. Power
              users pair it with Yomitan for dictionary lookups. Maximum control; maximum setup.
            </p>

            <h2>When you need an asbplayer alternative</h2>
            <ul>
              <li>
                <strong>You cannot read Japanese subtitles yet</strong> — mining assumes you can parse the line.
              </li>
              <li>
                <strong>You do not want Anki yet</strong> — built-in SRS beats configuring decks on night one.
              </li>
              <li>
                <strong>No fan .srt / no JP track</strong> — miners stall; Listening Mode still works from audio.
              </li>
              <li>
                <strong>You want a Chrome install and go</strong> — no Jimaku hunting before the first word.
              </li>
            </ul>

            <h2>asbplayer alternatives compared</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Job</th>
                    <th scope="col">Anki required</th>
                    <th scope="col">Beginner romaji</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab</strong>
                    </td>
                    <td>Romaji cards + Listening Mode</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>asbplayer</td>
                    <td>Browser sentence mining → Anki</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>SubMiner</td>
                    <td>Desktop mining → Anki</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Language Reactor</td>
                    <td>Netflix/YouTube dual-sub reader</td>
                    <td>
                      <span className="no">Optional export</span>
                    </td>
                    <td>
                      <span className="no">Needs reading</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>AnimeVocab as your free asbplayer alternative</h2>
            <p>
              Install once. Watch Crunchyroll, Netflix, or YouTube. Get one useful word per line in romaji.
              Review with built-in SRS ({TIERS.free.priceLabel} forever for the core loop). Graduate to
              asbplayer later when you want full sentence mining. Guide:{" "}
              <Link href="/free-japanese-anime-extension">free Japanese anime extension</Link>.
            </p>

            <h2>Related pages</h2>
            <ul>
              <li>
                <Link href="/vs-asbplayer">AnimeVocab vs asbplayer</Link> — full feature table
              </li>
              <li>
                <Link href="/blog/subminer-vs-asbplayer-anime-mining-2026">SubMiner vs asbplayer</Link>
              </li>
              <li>
                <Link href="/language-reactor-alternative">Language Reactor alternative</Link>
              </li>
              <li>
                <Link href="/migaku-free-alternative">Migaku free alternative</Link>
              </li>
            </ul>

            <h2>FAQ</h2>
            {faqs.map((f) => (
              <div key={f.question}>
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Not ready for Anki mining? Start here.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/vs-asbplayer", label: "vs asbplayer" },
          { href: "/language-reactor-alternative", label: "LR alternative" },
          { href: "/migaku-free-alternative", label: "Migaku free alt" },
          { href: "/learn-japanese-with-anime", label: "Compare hub" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
