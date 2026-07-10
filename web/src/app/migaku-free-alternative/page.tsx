import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/migaku-free-alternative";

export const metadata: Metadata = {
  title: "Migaku Free Alternative (2026) — Learn Japanese from Anime Without Paying",
  description:
    "Best free Migaku alternative for anime learners in 2026: AnimeVocab — romaji-first cards, built-in SRS, Crunchyroll Listening Mode. No trial countdown. No Anki required.",
  keywords: [
    "migaku free alternative",
    "free migaku alternative",
    "migaku alternative free",
    "migaku alternative",
    "best free migaku alternative",
    "migaku without subscription",
    "cheaper than migaku",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Migaku Free Alternative (2026)",
    description:
      "Skip the Migaku subscription. Free romaji-first anime vocabulary + SRS on Crunchyroll and Netflix.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Migaku Free Alternative (2026)",
    description: "Free anime Japanese learning without Migaku's subscription or Anki setup.",
  },
};

const faqs = [
  {
    question: "What is the best free Migaku alternative in 2026?",
    answer:
      "For beginners learning Japanese from anime, AnimeVocab is the strongest free Migaku alternative: romaji-first cards, built-in spaced repetition, and Listening Mode on Crunchyroll/Netflix when Japanese subtitles are missing. Power users who already live in Anki may prefer asbplayer (free) or stay on Migaku.",
  },
  {
    question: "Is AnimeVocab really free forever?",
    answer:
      "Yes. Core word cards and local SRS are free with no account and no trial countdown. Optional Pro is only for hosted Listening Mode transcription without bringing your own API key.",
  },
  {
    question: "Why look for a Migaku free alternative?",
    answer:
      "Migaku is a paid immersion suite (~$9/mo or lifetime) aimed at power users who mine sentences into Anki. Many learners want the immersion idea without a subscription, Anki templates, or a steep setup curve.",
  },
  {
    question: "Does Migaku work on Crunchyroll?",
    answer:
      "No. Migaku focuses on Netflix, YouTube, and related surfaces — not Crunchyroll. If you watch anime on Crunchyroll, AnimeVocab Listening Mode or reader tools like ManabiDojo/Lexirise are the real alternatives.",
  },
  {
    question: "Do I need Anki if I switch from Migaku?",
    answer:
      "No. AnimeVocab includes built-in spaced repetition. Keep Anki only if you already love it — you can graduate later.",
  },
  {
    question: "Migaku vs Language Reactor vs AnimeVocab — which free path?",
    answer:
      "Language Reactor's free tier is strong if you can already read Japanese dual subs on Netflix/YouTube. AnimeVocab is for month-zero learners and audio-only Crunchyroll. Migaku is paid depth for committed miners.",
  },
];

export default function MigakuFreeAlternativePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Migaku Free Alternative (2026) — Learn Japanese from Anime Without Paying"
        description="Best free Migaku alternative for anime learners in 2026: AnimeVocab — romaji-first cards, built-in SRS, Crunchyroll Listening Mode."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "Migaku free alternative" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Migaku free alternative (2026)"
          lede={
            <>
              Searching <strong>Migaku free alternative</strong>? You want immersion from shows you already
              watch — without a subscription, Anki template night, or a 10-day trial clock.{" "}
              <strong>AnimeVocab</strong> is the free Chrome extension built for that: romaji-first cards,
              built-in SRS, and audio when Japanese subs are missing.
            </>
          }
          verdictTag="Bottom line"
          verdict={
            <>
              <strong>Best free Migaku alternative for anime beginners:</strong> AnimeVocab.{" "}
              <strong>Best free dual-sub reader (if you can read kana):</strong> Language Reactor.{" "}
              <strong>Best free Anki miner:</strong> asbplayer.{" "}
              <strong>Keep Migaku</strong> only if you already mine daily and want the full paid suite. Full
              side-by-side: <Link href="/vs-migaku">AnimeVocab vs Migaku</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Why people search “Migaku free alternative”</h2>
            <p>
              Migaku is excellent machinery for a narrow person: committed immersion learners who want
              sentence mining, card templates, and a paid workflow. Everyone else hits the same wall —
              price after trial, setup friction, and tools that assume you can already read Japanese
              subtitles. A <strong>free Migaku alternative</strong> should still teach from real anime, not
              just be “another flashcard app.”
            </p>

            <h2>Free Migaku alternatives compared (2026)</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Free forever?</th>
                    <th scope="col">Best for</th>
                    <th scope="col">Crunchyroll</th>
                    <th scope="col">Needs Anki?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab</strong>
                    </td>
                    <td>
                      <span className="yes">Yes</span> (core)
                    </td>
                    <td>Beginners · romaji · audio</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>No — built-in SRS</td>
                  </tr>
                  <tr>
                    <td>Language Reactor</td>
                    <td>Freemium</td>
                    <td>Readers · Netflix/YouTube dual subs</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Optional</td>
                  </tr>
                  <tr>
                    <td>asbplayer</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Anki miners with JP .srt files</td>
                    <td>With fan subs</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Migaku</td>
                    <td>Trial → paid</td>
                    <td>Power-user mining suite</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Core workflow</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>What AnimeVocab gives you free (vs Migaku paid)</h2>
            <ul>
              <li>
                <strong>Romaji-first cards</strong> — start tonight without finishing a kana course first.
              </li>
              <li>
                <strong>Built-in spaced repetition</strong> — no Anki install required for the core habit.
              </li>
              <li>
                <strong>Listening Mode</strong> — works from spoken Japanese when subtitle text is missing
                (the common Crunchyroll case Migaku does not cover).
              </li>
              <li>
                <strong>Local-first</strong> — progress on your device; open source; no account for the free
                loop.
              </li>
              <li>
                <strong>Price</strong> — free forever for cards + SRS. Optional Pro {TIERS.pro.priceLabel} only
                for hosted transcription convenience.
              </li>
            </ul>

            <h2>When you should still pay for Migaku</h2>
            <p>
              Keep or buy Migaku if you already review Anki daily, can read kana comfortably, and want deep
              mining automation across supported sites. Honest take:{" "}
              <Link href="/blog/is-migaku-worth-it-2026">Is Migaku worth it?</Link>. If you are canceling:{" "}
              <Link href="/blog/cancel-migaku-keep-learning-anime-2026">keep learning without Migaku</Link>.
            </p>

            <h2>Crunchyroll note (Migaku gap)</h2>
            <p>
              Migaku does not support Crunchyroll. If that is where you watch, see{" "}
              <Link href="/blog/migaku-crunchyroll-alternative-2026">Migaku Crunchyroll alternatives</Link>{" "}
              and the <Link href="/learn-japanese-crunchyroll">Crunchyroll Japanese guide</Link>. Reader
              overlays: <Link href="/manabidojo-alternative">ManabiDojo alternative</Link>,{" "}
              <Link href="/vs-lexirise">vs Lexirise</Link>.
            </p>

            <h2>FAQ</h2>
            {faqs.map((f) => (
              <div key={f.question}>
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}

            <p>
              Also: <Link href="/vs-migaku">full vs Migaku comparison</Link>,{" "}
              <Link href="/free-japanese-anime-extension">free Japanese anime extension hub</Link>,{" "}
              <Link href="/learn-japanese-with-anime">2026 tool ranking</Link>,{" "}
              <Link href="/vs-language-reactor">vs Language Reactor</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Skip the subscription. Start this episode.</h2>
            <p style={{ color: "var(--ink-2)", marginBottom: 18 }}>
              Free Chrome extension — no trial clock on the core loop.
            </p>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: "/manabidojo-alternative", label: "ManabiDojo alt" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/blog/is-migaku-worth-it-2026", label: "Is Migaku worth it?" },
          { href: "/learn-japanese-with-anime", label: "Compare tools" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
