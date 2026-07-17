import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/language-reactor-alternative-crunchyroll";

const LR_CRUNCHYROLL_FORUM =
  "https://forum.languagelearningwithnetflix.com/t/crunchyroll-support/10646";

export const metadata: Metadata = {
  title: "Language Reactor Alternative for Crunchyroll (2026) — What Actually Works",
  description:
    "Best Language Reactor alternative for Crunchyroll: AnimeVocab Listening Mode for beginners, Lexirise/ManabiDojo for readers. Honest guide when LR's Netflix dual-subs do not apply.",
  keywords: [
    "language reactor alternative crunchyroll",
    "language reactor crunchyroll alternative",
    "best language reactor alternative crunchyroll",
    "language reactor alternative for crunchyroll",
    "dual subtitles crunchyroll japanese",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Language Reactor Alternative for Crunchyroll (2026)",
    description:
      "LR does not run on Crunchyroll. Here is the honest alternative stack for Japanese study on simulcasts.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Language Reactor Alternative for Crunchyroll",
    description: "What to use when Language Reactor's Netflix dual-subs do not cover Crunchyroll.",
  },
};

const faqs = [
  {
    question: "What is the best Language Reactor alternative for Crunchyroll?",
    answer:
      "If you cannot read Japanese subtitles yet, AnimeVocab is the best free Language Reactor alternative for Crunchyroll: romaji-first cards and Listening Mode from audio. If you already read kana and Japanese text is on screen, Lexirise or ManabiDojo are closer to a dual-sub reading experience.",
  },
  {
    question: "Does Language Reactor work on Crunchyroll?",
    answer:
      "No. Language Reactor is Netflix and YouTube first. The community has requested Crunchyroll support on the Language Reactor forum for years without a first-class integration.",
  },
  {
    question: "Can anything give me Language Reactor-style dual subs on Crunchyroll?",
    answer:
      "Not as a drop-in LR clone. Closest reading paths: Lexirise/ManabiDojo when JP text exists, or fan .srt overlays via Substital/Jimaku. Beginners should not chase dual-sub parity — chase vocabulary capture from audio instead.",
  },
  {
    question: "Is Migaku a Language Reactor alternative on Crunchyroll?",
    answer:
      "No. Migaku also does not support Crunchyroll. See Migaku vs Language Reactor for where each wins on Netflix — and use a CR-native tool for simulcasts.",
  },
  {
    question: "Should I uninstall Language Reactor?",
    answer:
      "Only if you never watch Netflix or YouTube. Otherwise keep LR for those platforms and add a Crunchyroll-native tool for anime nights. Splitting tools by platform is normal.",
  },
];

export default function LanguageReactorAlternativeCrunchyrollPage() {
  const faqLd = faqJsonLd(faqs);
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to replace Language Reactor on Crunchyroll",
    description:
      "Pick a Crunchyroll-native Language Reactor alternative based on whether you can read Japanese text.",
    totalTime: "PT15M",
    step: [
      {
        "@type": "HowToStep",
        name: "Confirm Language Reactor does not cover Crunchyroll",
        text: "Keep Language Reactor for Netflix and YouTube. Do not expect dual Japanese/English subs on Crunchyroll from LR.",
        url: `${SITE_URL}/does-language-reactor-work-on-crunchyroll`,
      },
      {
        "@type": "HowToStep",
        name: "Install a Crunchyroll-native alternative",
        text: "AnimeVocab for romaji beginners and missing JP tracks; Lexirise or ManabiDojo for readers.",
        url: `${SITE_URL}/free-japanese-anime-extension`,
      },
      {
        "@type": "HowToStep",
        name: "Capture and review vocabulary",
        text: "Save a few words per episode and review with built-in SRS or Anki before the next watch.",
        url: `${SITE_URL}/anime-spaced-repetition`,
      },
    ],
  };

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Language Reactor Alternative for Crunchyroll (2026) — What Actually Works"
        description="Best Language Reactor alternative for Crunchyroll: AnimeVocab Listening Mode for beginners, Lexirise/ManabiDojo for readers."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/language-reactor-alternative", label: "Language Reactor alternative" },
            { label: "Crunchyroll" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Language Reactor alternative for Crunchyroll"
          lede={
            <>
              Searching <strong>Language Reactor alternative Crunchyroll</strong>? You already know the blocker:{" "}
              <strong>Language Reactor does not run on Crunchyroll</strong>. This page is the Crunchyroll-specific
              answer — not a generic dual-sub comparison for Netflix nights.
            </>
          }
          verdictTag="Crunchyroll pick"
          verdict={
            <>
              <strong>Beginners / no JP track:</strong> AnimeVocab ({TIERS.free.priceLabel} core) with Listening
              Mode. <strong>Readers with on-screen JP text:</strong> Lexirise or ManabiDojo. Keep Language Reactor
              for Netflix — see the general <Link href="/language-reactor-alternative">LR alternative hub</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Why the Netflix tool fails the anime streamer</h2>
            <p>
              Language Reactor&apos;s strength is dual Japanese/English subtitles on platforms that expose clean
              subtitle tracks. Crunchyroll is a different player with different licensing. Outside Japan, English
              subs dominate; Japanese tracks are often absent. Community requests for Crunchyroll support sit on the{" "}
              <a href={LR_CRUNCHYROLL_FORUM} rel="noopener noreferrer" target="_blank">
                Language Reactor forum
              </a>{" "}
              without a shipped integration. Full direct answer:{" "}
              <Link href="/does-language-reactor-work-on-crunchyroll">
                does Language Reactor work on Crunchyroll?
              </Link>
              .
            </p>

            <h2>Where Language Reactor still beats every alternative</h2>
            <p>
              On <strong>Netflix and YouTube</strong>, once you can read Japanese, Language Reactor remains hard to
              beat for free dual-sub immersion. AnimeVocab does not pretend to clone that UI. An honest alternative
              page must say: if your watch diet is Netflix-heavy and literacy is fine, stay on LR. Switch only for
              the Crunchyroll (and beginner) gap.
            </p>
            <p>
              Dual-sub reading is a real skill accelerator when Japanese text is present: you see the form, hear the
              pronunciation, and check the English gloss without leaving the player. That loop is why LR dominates
              &quot;learn Japanese with Netflix&quot; recommendations. The failure mode is importing that expectation
              onto Crunchyroll, then concluding Japanese immersion &quot;doesn&apos;t work&quot; because the wrong
              extension sat idle on the wrong site.
            </p>

            <h2>What &quot;alternative&quot; should mean here</h2>
            <p>
              A Language Reactor alternative for Crunchyroll should preserve the <em>outcome</em> — learn vocabulary
              from anime you already watch — not the exact dual-sub chrome. Outcomes that matter:
            </p>
            <ul>
              <li>You can capture a word from tonight&apos;s episode without leaving the browser tab.</li>
              <li>You can review that word tomorrow without rebuilding an Anki deck from scratch (unless you want to).</li>
              <li>You are honest about whether Japanese text exists; if it does not, you have an audio path.</li>
              <li>You do not pay a second subscription that still cannot attach to Crunchyroll.</li>
            </ul>
            <p>
              Measured that way, AnimeVocab is the beginner default; Lexirise/ManabiDojo are the reader defaults; fan
              overlays are the advanced mining default. None of them are &quot;Language Reactor but on CR&quot; —
              and that is fine.
            </p>

            <h2>Crunchyroll alternatives compared</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Closest to LR dual-subs?</th>
                    <th scope="col">Crunchyroll</th>
                    <th scope="col">Beginner romaji</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab</strong>
                    </td>
                    <td>Different job (cards + audio)</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Lexirise</td>
                    <td>Closer for readers</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>ManabiDojo</td>
                    <td>Closer with fan JP tracks</td>
                    <td>
                      <span className="yes">Partial</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Language Reactor</td>
                    <td>The reference dual-sub UI</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Migaku</td>
                    <td>Deeper mining, paid</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>
                      <span className="no">Setup-heavy</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Migaku is not the Crunchyroll escape hatch either —{" "}
              <Link href="/does-migaku-work-on-crunchyroll">does Migaku work on Crunchyroll?</Link> and{" "}
              <Link href="/migaku-vs-language-reactor">Migaku vs Language Reactor</Link> for the Netflix-side
              tradeoffs.
            </p>

            <h2>How to get Japanese text (or skip it) on Crunchyroll</h2>
            <p>
              Dual-sub dreams on Crunchyroll usually require fan files or a reader that can see text. Practical
              how-to: <Link href="/crunchyroll-japanese-subtitles">Crunchyroll Japanese subtitles</Link>. If you
              cannot read yet, skip the file ritual — Listening Mode is the Language Reactor alternative that
              matches your level.
            </p>

            <h2>Recommended stack by night</h2>
            <ul>
              <li>
                <strong>Netflix night, can read JP:</strong> Language Reactor (keep it).
              </li>
              <li>
                <strong>Crunchyroll night, cannot read yet:</strong> AnimeVocab Listening Mode + short SRS.
              </li>
              <li>
                <strong>Crunchyroll night, can read:</strong> Lexirise / ManabiDojo, or Substital + fan{" "}
                <code>.srt</code>.
              </li>
              <li>
                <strong>Paid Anki mining on supported sites:</strong> Migaku — never as a CR-only purchase.
              </li>
            </ul>
            <p>
              Platform hub with workflows:{" "}
              <Link href="/learn-japanese-crunchyroll">learn Japanese on Crunchyroll</Link>. Feature table vs LR:{" "}
              <Link href="/vs-language-reactor">AnimeVocab vs Language Reactor</Link>.
            </p>

            <h2>Related pages in this cluster</h2>
            <ul>
              <li>
                <Link href="/does-language-reactor-work-on-crunchyroll">
                  Does Language Reactor work on Crunchyroll?
                </Link>
              </li>
              <li>
                <Link href="/does-migaku-work-on-crunchyroll">Does Migaku work on Crunchyroll?</Link>
              </li>
              <li>
                <Link href="/crunchyroll-japanese-subtitles">Crunchyroll Japanese subtitles</Link>
              </li>
              <li>
                <Link href="/migaku-vs-language-reactor">Migaku vs Language Reactor</Link>
              </li>
              <li>
                <Link href="/language-reactor-alternative">Language Reactor alternative (all platforms)</Link>
              </li>
              <li>
                <Link href="/learn-japanese-crunchyroll">Learn Japanese on Crunchyroll</Link>
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
            <h2>Need an LR alternative that runs on Crunchyroll?</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/language-reactor-alternative", label: "LR alternative hub" },
          { href: "/does-language-reactor-work-on-crunchyroll", label: "LR on CR?" },
          { href: "/crunchyroll-japanese-subtitles", label: "JP subtitles" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll hub" },
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
