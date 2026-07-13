import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/rikaikun-alternative";

export const metadata: Metadata = {
  title: "Rikaikun Alternative (2026): What to Use Now That It's Retired",
  description:
    "Rikaikun is retired. Best rikaikun alternatives in 2026: Yomitan for hover dictionary, AnimeVocab for anime vocab + SRS, asbplayer for Anki mining.",
  keywords: [
    "rikaikun alternative",
    "rikaikun retired",
    "rikaikun replacement",
    "yomitan alternative rikaikun",
    "rikaikun anime japanese",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Rikaikun Alternative (2026)",
    description:
      "Rikaikun is dead. Yomitan replaces the hover dictionary; AnimeVocab fills the anime beginner gap with romaji + SRS.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Rikaikun Alternative (2026)",
    description: "What to use now that Rikaikun is retired — Yomitan, AnimeVocab, and the mining stack.",
  },
};

const faqs = [
  {
    question: "What replaced Rikaikun?",
    answer:
      "Yomitan (formerly Yomichan) is the direct successor for hover dictionary lookups on Japanese web pages. For anime immersion with vocabulary capture and SRS, AnimeVocab or a mining stack (asbplayer + Anki) replaces what Rikaikun never did anyway.",
  },
  {
    question: "Is Rikaikun still working?",
    answer:
      "No. Rikaikun was retired and removed from the Chrome Web Store. Old installs may break on modern Chrome. Do not plan a 2026 study workflow around Rikaikun — migrate to Yomitan for reading and AnimeVocab or asbplayer for video.",
  },
  {
    question: "Rikaikun vs Yomitan — which should I use?",
    answer:
      "Yomitan wins unconditionally in 2026 — it is the maintained fork with better dictionaries, pitch accent, and Anki export. Rikaikun is historical. Install Yomitan for any hover-dictionary job Rikaikun used to do.",
  },
  {
    question: "What is the best Rikaikun alternative for anime beginners?",
    answer:
      "Rikaikun was never an anime tool — it hovered over static text. Beginners who want vocabulary from Netflix, Crunchyroll, or YouTube should use AnimeVocab: romaji-first cards, built-in SRS, and Listening Mode when JP subs are missing.",
  },
  {
    question: "Do I need Migaku now that Rikaikun is gone?",
    answer:
      "No. Migaku is a paid mining suite, not a Rikaikun replacement. The free stack is Yomitan + asbplayer + Anki for power users, or AnimeVocab for month-zero learners. See AnimeVocab vs Migaku for the honest split.",
  },
];

export default function RikaikunAlternativePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Rikaikun Alternative (2026): What to Use Now That It's Retired"
        description="Rikaikun is retired. Best rikaikun alternatives: Yomitan for hover dictionary, AnimeVocab for anime vocab + SRS."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "Rikaikun alternative" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Rikaikun alternative (2026)"
          lede={
            <>
              Searching <strong>rikaikun alternative</strong>? <strong>Rikaikun is retired</strong> — removed
              from the Chrome Web Store and unmaintained. The hover-dictionary job moved to{" "}
              <strong>Yomitan</strong>. For anime beginners who want <strong>vocabulary + SRS</strong> — not
              just dictionary popups — <strong>AnimeVocab</strong> is the free path on Netflix, Crunchyroll,
              and YouTube.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Reading Japanese on web pages?</strong> Install Yomitan.{" "}
              <strong>Learning from anime / cannot read kana yet?</strong> AnimeVocab.{" "}
              <strong>Sentence mining to Anki?</strong>{" "}
              <Link href="/asbplayer-alternative">asbplayer alternative guide</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>What Rikaikun used to do</h2>
            <p>
              Rikaikun was the OG <strong>hover dictionary</strong> for Japanese text in the browser — hold
              Shift, point at a word, see a reading and gloss. It was brilliant for manga sites and news
              pages. It was never a video player, never captured vocabulary automatically, and never shipped
              spaced repetition. That gap is why people now search <strong>rikaikun alternative</strong> with
              different jobs in mind.
            </p>

            <h2>The direct replacement: Yomitan</h2>
            <p>
              <strong>Yomitan</strong> (ex-Yomichan) is the maintained successor — richer dictionaries, pitch
              accent, frequency data, and Anki export. Install it for any static-text reading Rikaikun handled.
              Pair it with asbplayer when you mine sentences from anime with Japanese subtitle files. Deep
              dive: <Link href="/blog/migaku-vs-yomitan-2026">Migaku vs Yomitan</Link>.
            </p>

            <h2>When you need more than a dictionary</h2>
            <ul>
              <li>
                <strong>You watch anime, not web pages</strong> — hover dicts need selectable Japanese text on
                screen.
              </li>
              <li>
                <strong>You cannot read kana yet</strong> — dictionary popups assume literacy.
              </li>
              <li>
                <strong>Crunchyroll has no JP track</strong> — Yomitan has nothing to hover; Listening Mode
                works from audio.
              </li>
              <li>
                <strong>You want review without Anki setup</strong> — built-in SRS beats configuring decks on
                night one.
              </li>
            </ul>

            <h2>Rikaikun alternatives compared</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Job</th>
                    <th scope="col">Anime video</th>
                    <th scope="col">Beginner romaji</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Yomitan</strong>
                    </td>
                    <td>Hover dictionary (Rikaikun successor)</td>
                    <td>Only with JP text on screen</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>AnimeVocab</strong>
                    </td>
                    <td>Romaji cards + Listening Mode + SRS</td>
                    <td>
                      <span className="yes">Netflix / CR / YT</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>asbplayer + Anki</td>
                    <td>Sentence mining from JP subs</td>
                    <td>With fan .srt files</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Migaku</td>
                    <td>Paid mining suite</td>
                    <td>Netflix / YouTube-first</td>
                    <td>
                      <span className="no">Setup-heavy</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>AnimeVocab for anime learners leaving Rikaikun</h2>
            <p>
              Rikaikun nostalgia threads often mix up <strong>dictionary</strong> and <strong>immersion</strong>.
              AnimeVocab does the immersion job: one romaji-first word per line from the show you are watching,
              reviewed with built-in SRS ({TIERS.free.priceLabel} forever for the core loop). Paid suites like
              Migaku overlap partially — see{" "}
              <Link href="/vs-migaku">AnimeVocab vs Migaku</Link> for when each wins.
            </p>

            <h2>Related pages</h2>
            <ul>
              <li>
                <Link href="/blog/migaku-vs-yomitan-2026">Migaku vs Yomitan (2026)</Link>
              </li>
              <li>
                <Link href="/asbplayer-alternative">asbplayer alternative</Link>
              </li>
              <li>
                <Link href="/vs-migaku">AnimeVocab vs Migaku</Link>
              </li>
              <li>
                <Link href="/blog/yomitan-crunchyroll-2026">Does Yomitan work on Crunchyroll?</Link>
              </li>
              <li>
                <Link href="/free-japanese-anime-extension">Free Japanese anime extension</Link>
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
            <h2>Rikaikun is gone. Pick the right replacement.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/asbplayer-alternative", label: "asbplayer alt" },
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: "/language-reactor-alternative", label: "LR alternative" },
          { href: "/learn-japanese-with-anime", label: "Compare hub" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
