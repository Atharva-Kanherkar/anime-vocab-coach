import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/language-reactor-alternative";

export const metadata: Metadata = {
  title: "Language Reactor Alternative (2026) — Free When Dual Subs Aren't Enough",
  description:
    "Best Language Reactor alternative for beginners and Crunchyroll: AnimeVocab — romaji-first cards + Listening Mode when Japanese subs are missing. Honest comparison.",
  keywords: [
    "language reactor alternative",
    "language reactor free alternative",
    "best free language reactor alternative",
    "does language reactor work on crunchyroll",
    "language reactor crunchyroll",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Language Reactor Alternative (2026)",
    description:
      "Language Reactor wins for Netflix dual subs. AnimeVocab is the free alternative for romaji beginners and Crunchyroll gaps.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Language Reactor Alternative (2026)",
    description:
      "Free Language Reactor alternative for beginners and Crunchyroll — romaji-first + Listening Mode.",
  },
};

const faqs = [
  {
    question: "What is the best Language Reactor alternative?",
    answer:
      "If you cannot read Japanese subtitles yet, or you study on Crunchyroll where Language Reactor does not fit, AnimeVocab is the best free Language Reactor alternative: romaji-first cards and Listening Mode from audio. If you already read kana and mainly watch Netflix/YouTube, stay on Language Reactor.",
  },
  {
    question: "Does Language Reactor work on Crunchyroll?",
    answer:
      "No — do not plan your Crunchyroll study life around Language Reactor. LR is built around Netflix/YouTube subtitle tracks. Use AnimeVocab Listening Mode or a Crunchyroll reader tool when JP text exists.",
  },
  {
    question: "Is there a free Language Reactor alternative?",
    answer:
      "Yes. AnimeVocab's core cards and local SRS are free forever. Language Reactor's free tier remains excellent for Netflix dual subs if you can already read Japanese text.",
  },
  {
    question: "Language Reactor vs AnimeVocab — which should I use?",
    answer:
      "Language Reactor wins for intermediate readers who want dual subtitles on Netflix/YouTube. AnimeVocab wins for month-zero learners and episodes with no Japanese subtitle track. Many people use both on different nights.",
  },
  {
    question: "Does AnimeVocab replace Language Reactor dual subs?",
    answer:
      "No. AnimeVocab does not mirror dual-subtitle playback. It pushes one curated romaji-first word per line with built-in SRS — a different job than a dual-sub reader.",
  },
  {
    question: "What is the best Language Reactor alternative for Crunchyroll specifically?",
    answer:
      "AnimeVocab Listening Mode for beginners and missing JP tracks; Lexirise or ManabiDojo when Japanese text is on screen. See the dedicated Crunchyroll page for the long-tail comparison.",
  },
];

export default function LanguageReactorAlternativePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Language Reactor Alternative (2026) — Free When Dual Subs Aren't Enough"
        description="Best Language Reactor alternative for beginners and Crunchyroll: AnimeVocab — romaji-first cards + Listening Mode when Japanese subs are missing."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "Language Reactor alternative" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Language Reactor alternative (2026)"
          lede={
            <>
              Searching <strong>Language Reactor alternative</strong>? Usually you either (1) cannot read the
              dual Japanese subs yet, or (2) you hit Crunchyroll where LR does not work.{" "}
              <strong>AnimeVocab</strong> is the free alternative for that gap — romaji-first cards and
              Listening Mode from audio.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Already reading JP subs on Netflix?</strong> Stay on Language Reactor.{" "}
              <strong>Month-zero / Crunchyroll / no JP track?</strong> AnimeVocab. Full table:{" "}
              <Link href="/vs-language-reactor">AnimeVocab vs Language Reactor</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>What Language Reactor is good at</h2>
            <p>
              Language Reactor is the mature <strong>dual-subtitle reader</strong> for Netflix and YouTube —
              dictionary popups, playback controls, and a strong free tier once you can read Japanese text.
              It is not built for month-zero romaji learners or Crunchyroll simulcasts without a JP track.
            </p>

            <h2>When you need a Language Reactor alternative</h2>
            <ul>
              <li>
                <strong>You cannot read kana yet</strong> — dual JP/EN subs still dump reading work on you.
              </li>
              <li>
                <strong>You watch Crunchyroll</strong> — LR is Netflix/YouTube-first (
                <Link href="/blog/language-reactor-crunchyroll-2026">does LR work on Crunchyroll?</Link>).
              </li>
              <li>
                <strong>No Japanese subtitle track</strong> — readers fail; audio Listening Mode still works.
              </li>
              <li>
                <strong>You want free built-in SRS</strong> — review without a separate Anki export ritual.
              </li>
            </ul>

            <h2>Language Reactor alternatives compared</h2>
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
                    <td>Language Reactor</td>
                    <td>Netflix/YouTube dual-sub reader</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Migaku</td>
                    <td>Paid mining suite</td>
                    <td>Limited</td>
                    <td>
                      <span className="no">Setup-heavy</span>
                    </td>
                  </tr>
                  <tr>
                    <td>asbplayer + Anki</td>
                    <td>Sentence mining from JP subs</td>
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

            <h2>AnimeVocab as your free Language Reactor alternative</h2>
            <p>
              Install once. Watch Netflix, Crunchyroll, or YouTube. Get one useful word per line in romaji.
              Review with built-in SRS ({TIERS.free.priceLabel} forever for the core loop). When Japanese text
              is missing — including many Crunchyroll nights — Listening Mode works from audio. Guide:{" "}
              <Link href="/learn-japanese-crunchyroll">learn Japanese on Crunchyroll</Link>.
            </p>

            <h2>Crunchyroll-specific: Language Reactor alternative</h2>
            <p>
              The long-tail query is not just &quot;Language Reactor alternative&quot; — it is often{" "}
              <strong>Language Reactor alternative Crunchyroll</strong>. Direct answer: LR does not run there (
              <Link href="/does-language-reactor-work-on-crunchyroll">full write-up</Link>
              ). Dedicated page for that intent:{" "}
              <Link href="/language-reactor-alternative-crunchyroll">
                Language Reactor alternative for Crunchyroll
              </Link>
              . Same gap for Migaku:{" "}
              <Link href="/does-migaku-work-on-crunchyroll">does Migaku work on Crunchyroll?</Link>. Need JP text
              overlays instead of a dual-sub clone?{" "}
              <Link href="/crunchyroll-japanese-subtitles">Crunchyroll Japanese subtitles</Link>.
            </p>

            <h2>Related pages</h2>
            <ul>
              <li>
                <Link href="/vs-language-reactor">AnimeVocab vs Language Reactor</Link> — full feature table
              </li>
              <li>
                <Link href="/migaku-vs-language-reactor">Migaku vs Language Reactor</Link>
              </li>
              <li>
                <Link href="/language-reactor-alternative-crunchyroll">
                  Language Reactor alternative for Crunchyroll
                </Link>
              </li>
              <li>
                <Link href="/does-language-reactor-work-on-crunchyroll">
                  Does Language Reactor work on Crunchyroll?
                </Link>
              </li>
              <li>
                <Link href="/animelon-alternative">Animelon alternative</Link>
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
            <h2>Dual subs not enough yet? Start with romaji.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: "/migaku-vs-language-reactor", label: "Migaku vs LR" },
          { href: "/language-reactor-alternative-crunchyroll", label: "LR alt for CR" },
          { href: "/does-language-reactor-work-on-crunchyroll", label: "LR on CR?" },
          { href: "/animelon-alternative", label: "Animelon alt" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
