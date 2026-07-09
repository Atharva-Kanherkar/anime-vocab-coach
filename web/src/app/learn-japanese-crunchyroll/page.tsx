import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/learn-japanese-crunchyroll";

const faqs = [
  {
    question: "Does Crunchyroll have Japanese subtitles?",
    answer:
      "Outside Japan, most Crunchyroll titles ship with English subtitles only. Japanese dialogue audio is available, but Japanese subtitle tracks are often missing — which breaks tools that need on-screen Japanese text.",
  },
  {
    question: "How can I learn Japanese on Crunchyroll without Japanese subtitles?",
    answer:
      "Work from audio: save spoken words with romaji and review them with spaced repetition. AnimeVocab Listening Mode transcribes tab audio when JP subs are missing. Advanced readers can overlay fan .srt files from Kitsunekko or jimaku.cc.",
  },
  {
    question: "Does Migaku work on Crunchyroll?",
    answer:
      "Migaku does not support Crunchyroll as a first-class platform. Learners searching Migaku Crunchyroll usually need Lexirise, ManabiDojo, AnimeVocab, or a fan-subtitle mining stack instead.",
  },
  {
    question: "What is the best free tool for Crunchyroll Japanese beginners?",
    answer:
      "If you cannot read kana yet, AnimeVocab's free romaji-first cards and Listening Mode. If you already read Japanese subtitle text, Lexirise or ManabiDojo free cores are stronger for click-to-translate mining.",
  },
];


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
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese on Crunchyroll (2026): No JP Subs, Real Workflows"
        description="Learn Japanese on Crunchyroll when Japanese subtitles are missing. Compare AnimeVocab, Lexirise, and ManabiDojo — transcription, romaji, and SRS that work on simulcasts."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Crunchyroll" },
          ]}
          currentPath={path}
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
              end — see our{" "}
              <Link href="/blog/migaku-crunchyroll-alternative-2026">Migaku Crunchyroll alternative guide</Link>.
              Fan subtitle workflows (Jimaku + asbplayer) work for advanced readers, not month-zero beginners.
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

            <h2>FAQ</h2>
            <ul>
              {faqs.map((f) => (
                <li key={f.question}>
                  <strong>{f.question}</strong>
                  <br />
                  {f.answer}
                </li>
              ))}
            </ul>

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
              Coming from Funimation?{" "}
              <Link href="/blog/funimation-to-crunchyroll-learn-japanese-2026">
                Keep your Japanese study habit after the Funimation → Crunchyroll move
              </Link>
              . Extension acting up after a player update?{" "}
              <Link href="/blog/chrome-extension-not-working-crunchyroll-2026">
                Crunchyroll extension troubleshooting
              </Link>
              .
            </p>

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
          { href: "/blog/learn-japanese-while-watching-crunchyroll-2026", label: "While-watching workflow" },
          { href: "/blog/crunchyroll-japanese-learning-extension-2026", label: "CR extensions ranked" },
          { href: "/blog/substital-crunchyroll-japanese-subtitles-2026", label: "Substital guide" },
          { href: "/blog/kitsunekko-subtitles-anime-2026", label: "Kitsunekko guide" },
          { href: "/blog/jimaku-crunchyroll-subtitles-vs-listening-mode", label: "Jimaku vs Listening Mode" },
          { href: "/vs-manabidojo", label: "vs ManabiDojo" },
          { href: "/vs-lexirise", label: "vs Lexirise" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/best-anime-to-learn-japanese", label: "Best anime" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
