import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/manabidojo-alternative";

export const metadata: Metadata = {
  title: "ManabiDojo Alternative (2026) — Free Anime Japanese Without Fan-Sub Hunting",
  description:
    "Best ManabiDojo alternative for beginners: AnimeVocab — romaji-first cards + Listening Mode when Crunchyroll has no Japanese subs. Free core SRS. Honest comparison for readers vs month-zero learners.",
  keywords: [
    "manabidojo alternative",
    "manabidojo free alternative",
    "manabi dojo alternative",
    "manabidojo vs",
    "manabidojo crunchyroll alternative",
    "best manabidojo alternative",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "ManabiDojo Alternative (2026)",
    description:
      "Fan-sub overlays vs romaji-first Listening Mode — pick the right Crunchyroll Japanese tool.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "ManabiDojo Alternative (2026)",
    description: "Free alternative when you can't read fan JP subs yet — or when overlays fail.",
  },
};

const faqs = [
  {
    question: "What is the best ManabiDojo alternative?",
    answer:
      "If you cannot read Japanese subtitles yet, AnimeVocab is the best ManabiDojo alternative: romaji-first vocabulary and Listening Mode from audio. If you already read kana and want fan JP overlays plus quizzes on Crunchyroll, ManabiDojo (or Lexirise) stays the better fit.",
  },
  {
    question: "Is ManabiDojo free?",
    answer:
      "ManabiDojo offers a free core for fan-sub overlays on supported titles, with premium for flashcards, quizzes, and extras. AnimeVocab's core cards and local SRS are free forever without a premium gate on the review loop.",
  },
  {
    question: "ManabiDojo vs AnimeVocab — which should I use?",
    answer:
      "ManabiDojo wins for readers who want integrated Jimaku-style Japanese subtitles and quizzes. AnimeVocab wins for month-zero learners and episodes with no overlay-ready Japanese track. Many people use both on different shows.",
  },
  {
    question: "Does AnimeVocab replace ManabiDojo fan subtitles?",
    answer:
      "No. AnimeVocab does not fetch fan .srt overlays. It pushes curated romaji cards and can transcribe spoken Japanese when text is missing — a different job than ManabiDojo's reader overlay.",
  },
  {
    question: "What about Lexirise as a ManabiDojo alternative?",
    answer:
      "Lexirise is another Crunchyroll-oriented reader tool. Compare Lexirise directly if you want popup lookups on Japanese text. For beginners who need romaji first, start with AnimeVocab instead.",
  },
];

export default function ManabiDojoAlternativePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="ManabiDojo Alternative (2026) — Free Anime Japanese Without Fan-Sub Hunting"
        description="Best ManabiDojo alternative for beginners: AnimeVocab — romaji-first cards + Listening Mode when Crunchyroll has no Japanese subs."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "ManabiDojo alternative" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="ManabiDojo alternative (2026)"
          lede={
            <>
              Searching <strong>ManabiDojo alternative</strong>? Usually you either (1) cannot read the fan
              Japanese subs ManabiDojo overlays, or (2) the overlay is missing for tonight&apos;s title.{" "}
              <strong>AnimeVocab</strong> is the free alternative for that gap — romaji-first cards and
              Listening Mode from audio.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Already reading JP subs + want quizzes?</strong> Stay on ManabiDojo (or try{" "}
              <Link href="/vs-lexirise">Lexirise</Link>). <strong>Month-zero / no JP track?</strong>{" "}
              AnimeVocab. Full table: <Link href="/vs-manabidojo">AnimeVocab vs ManabiDojo</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>What ManabiDojo is good at</h2>
            <p>
              ManabiDojo is a Chrome extension that layers <strong>fan Japanese subtitles</strong> onto
              Crunchyroll (and Netflix in beta), with quizzes and premium flashcards. It sits in the same
              lane as Jimaku-style overlays — excellent once you can read hiragana and want in-player
              Japanese text without hunting .srt files yourself.
            </p>

            <h2>When you need a ManabiDojo alternative</h2>
            <ul>
              <li>
                <strong>You cannot read the overlay yet</strong> — romaji-first beats staring at kana you
                have not learned.
              </li>
              <li>
                <strong>No fan sub for this episode</strong> — overlays fail; audio transcription still
                works.
              </li>
              <li>
                <strong>You want free built-in SRS</strong> — review without unlocking premium flashcards.
              </li>
              <li>
                <strong>You want open source / local-first</strong> — AnimeVocab keeps the free loop on your
                device.
              </li>
            </ul>

            <h2>ManabiDojo alternatives compared</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Job</th>
                    <th scope="col">Free core</th>
                    <th scope="col">Beginner romaji</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab</strong>
                    </td>
                    <td>Romaji cards + audio Listening Mode</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>ManabiDojo</td>
                    <td>Fan JP sub overlay + quizzes</td>
                    <td>Yes (premium extras)</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Lexirise</td>
                    <td>Crunchyroll reader / lookups</td>
                    <td>Yes (Pro extras)</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>asbplayer + Jimaku</td>
                    <td>Manual fan-sub mining → Anki</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>AnimeVocab as your free ManabiDojo alternative</h2>
            <p>
              Install once. Watch Crunchyroll or Netflix. Get one useful word per line in romaji. Review with
              built-in SRS ({TIERS.free.priceLabel} forever for the core loop). When Japanese text is missing,
              Listening Mode works from audio — the exact failure mode of fan-sub overlays. Guide:{" "}
              <Link href="/learn-japanese-crunchyroll">learn Japanese on Crunchyroll</Link>.
            </p>

            <h2>Related competitor pages</h2>
            <ul>
              <li>
                <Link href="/vs-manabidojo">AnimeVocab vs ManabiDojo</Link> — full feature table
              </li>
              <li>
                <Link href="/migaku-free-alternative">Migaku free alternative</Link> — paid mining suite lane
              </li>
              <li>
                <Link href="/blog/jimaku-crunchyroll-subtitles-vs-listening-mode">
                  Jimaku vs Listening Mode
                </Link>
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
            <h2>Can&apos;t read the fan subs yet? Start here.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/vs-manabidojo", label: "vs ManabiDojo" },
          { href: "/migaku-free-alternative", label: "Migaku free alt" },
          { href: "/vs-lexirise", label: "vs Lexirise" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
