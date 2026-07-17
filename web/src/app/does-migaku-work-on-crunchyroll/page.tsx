import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/does-migaku-work-on-crunchyroll";

/** Migaku's own product note: they do not support Crunchyroll. */
const MIGAKU_OWN_NOTE = "https://migaku.com/blog/japanese/solo-leveling-japanese";

export const metadata: Metadata = {
  title: "Does Migaku Work on Crunchyroll? (2026: No — Here's What Does)",
  description:
    "Does Migaku work on Crunchyroll? No. Migaku is Netflix/YouTube/Disney+-first. Honest answer, Migaku's own note, and Crunchyroll alternatives that actually run.",
  keywords: [
    "does migaku work on crunchyroll",
    "migaku crunchyroll",
    "migaku on crunchyroll",
    "migaku crunchyroll alternative",
    "migaku alternative crunchyroll",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Does Migaku Work on Crunchyroll? (2026)",
    description:
      "Short answer: no. Migaku does not support Crunchyroll. Here is what works for Japanese study on CR instead.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Does Migaku Work on Crunchyroll?",
    description: "No — Netflix/YouTube/Disney+-first. What to use on Crunchyroll instead.",
  },
};

const faqs = [
  {
    question: "Does Migaku work on Crunchyroll?",
    answer:
      "No. Migaku does not support Crunchyroll as a first-class platform. Their browser tooling centers on Netflix, YouTube, Disney+, Viki, and similar — not the anime simulcast hub most fans use. Migaku's own blog has noted that Migaku does not currently support Crunchyroll.",
  },
  {
    question: "Why doesn't Migaku support Crunchyroll?",
    answer:
      "Mining suites need selectable Japanese subtitle text. Outside Japan, Crunchyroll often ships English-only subs, so the player is a poor fit for Migaku's dual-sub / mining model. Migaku invested in platforms where JP tracks are more reliable.",
  },
  {
    question: "Is Migaku worth it if I only watch Crunchyroll?",
    answer:
      "No. Paying for Migaku expecting Crunchyroll coverage is a common refund trigger. Pick a CR-native tool: AnimeVocab for romaji beginners, Lexirise or ManabiDojo for readers who can use on-screen Japanese text.",
  },
  {
    question: "I already pay for Migaku and watch Netflix plus Crunchyroll — what now?",
    answer:
      "Keep Migaku for Netflix (and other supported sites). Add AnimeVocab or a Crunchyroll reader for simulcast nights. Splitting platforms is rational in 2026 — one suite does not need to cover every streamer.",
  },
  {
    question: "What is the best Migaku Crunchyroll alternative?",
    answer:
      "For month-zero learners: AnimeVocab (romaji-first cards + Listening Mode). For readers: Lexirise click-to-translate or ManabiDojo with fan JP subs. For Anki sentence miners: Jimaku/Substital overlays + asbplayer — still not Migaku, but the same mining habit.",
  },
];

export default function DoesMigakuWorkOnCrunchyrollPage() {
  const faqLd = faqJsonLd(faqs);
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to replace Migaku on Crunchyroll",
    description:
      "Stop expecting Migaku on Crunchyroll and pick a workflow that matches your Japanese level.",
    totalTime: "PT20M",
    step: [
      {
        "@type": "HowToStep",
        name: "Confirm Migaku does not run on Crunchyroll",
        text: "Do not pay for Migaku expecting Crunchyroll mining. Keep it only if you also study on supported platforms like Netflix.",
        url: MIGAKU_OWN_NOTE,
      },
      {
        "@type": "HowToStep",
        name: "Choose a Crunchyroll-native path by skill level",
        text: "AnimeVocab for romaji beginners; Lexirise or ManabiDojo for readers; fan .srt + asbplayer for Anki miners.",
        url: `${SITE_URL}/learn-japanese-crunchyroll`,
      },
      {
        "@type": "HowToStep",
        name: "Capture vocabulary and review with SRS",
        text: "Save a few spoken or on-screen words per episode and review before the next watch session.",
        url: `${SITE_URL}/anime-spaced-repetition`,
      },
    ],
  };

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Does Migaku Work on Crunchyroll? (2026: No — Here's What Does)"
        description="Does Migaku work on Crunchyroll? No. Honest answer and Crunchyroll alternatives that actually run for Japanese study."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/migaku-free-alternative", label: "Migaku" },
            { label: "On Crunchyroll?" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Does Migaku work on Crunchyroll?"
          lede={
            <>
              <strong>No.</strong> Migaku does not work on Crunchyroll. If you searched{" "}
              <strong>Migaku Crunchyroll</strong> hoping the paid mining suite would attach to tonight&apos;s
              simulcast, you hit the same wall as everyone else: Migaku is{" "}
              <strong>Netflix / YouTube / Disney+ / Viki-first</strong>, not a Crunchyroll product.
            </>
          }
          verdictTag="Direct answer"
          verdict={
            <>
              Do not buy Migaku for Crunchyroll alone. Use <strong>AnimeVocab</strong> ({TIERS.free.priceLabel}{" "}
              core) for romaji beginners, or Lexirise / ManabiDojo when Japanese text is on screen. Hub:{" "}
              <Link href="/learn-japanese-crunchyroll">learn Japanese on Crunchyroll</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Proof from Migaku&apos;s own writing</h2>
            <p>
              This is not competitor FUD. Migaku&apos;s own Japanese anime guidance has stated plainly that{" "}
              <strong>Migaku does not currently support Crunchyroll</strong> — for example in their{" "}
              <a href={MIGAKU_OWN_NOTE} rel="noopener noreferrer" target="_blank">
                Solo Leveling Japanese study note
              </a>
              , which steers readers toward Japanese Netflix (often via VPN) when they want Migaku + JP subs.
              Learner forums and comparison write-ups have repeated the same constraint for years: the community
              keeps asking; the product still does not ship Crunchyroll as a supported site.
            </p>
            <p>
              The underlying constraint is the same one that blocks Language Reactor: outside Japan, Crunchyroll
              frequently lacks a Japanese subtitle track. Tools designed around clickable JP text cannot invent a
              track that licensing never delivered. See also{" "}
              <Link href="/does-language-reactor-work-on-crunchyroll">
                does Language Reactor work on Crunchyroll?
              </Link>{" "}
              — same answer, different product.
            </p>

            <h2>Where Migaku still wins</h2>
            <p>
              Be fair: if you already live in Anki, can read Japanese subtitle text, and study on{" "}
              <strong>Netflix or YouTube</strong>, Migaku can be an excellent paid mining suite — frequency lists,
              one-click cards, and a review ecosystem that Language Reactor does not fully replace. The honest
              head-to-head is on <Link href="/migaku-vs-language-reactor">Migaku vs Language Reactor</Link>. The
              mistake is treating Migaku as a universal anime immersion subscription that covers every streamer you
              already pay for.
            </p>
            <p>
              Power users often run a split stack without drama: Migaku (or Language Reactor) on Netflix nights,
              then a Crunchyroll-native capture tool when the weekly simulcast drops. That is not &quot;giving
              up&quot; on Migaku — it is refusing to let a marketing hope override the supported-sites list. If your
              entire watch diet is Crunchyroll, skip the trial that cannot attach to the player and start where the
              episode actually is.
            </p>

            <h2>What the community keeps asking for</h2>
            <p>
              Search threads across Reddit, Discord immersion servers, and Japanese-learning forums repeat the same
              pattern: someone buys or trials Migaku for anime, opens Crunchyroll, and discovers the extension does
              nothing useful on that tab. The follow-up question is always &quot;so what do I use instead?&quot; —
              not &quot;how do I force Migaku onto CR.&quot; Fragile workarounds that require ripping streams or
              injecting subtitle files are not a supported product path and should not be your study plan. Prefer
              tools that document Crunchyroll support up front.
            </p>

            <h2>What works on Crunchyroll instead</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Path</th>
                    <th scope="col">Skill level</th>
                    <th scope="col">JP subs required?</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab</strong>
                    </td>
                    <td>Beginner</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Romaji-first cards + Listening Mode from audio</td>
                  </tr>
                  <tr>
                    <td>Lexirise</td>
                    <td>Can read kana</td>
                    <td>Uses available on-screen text</td>
                    <td>Click-to-translate on Crunchyroll</td>
                  </tr>
                  <tr>
                    <td>ManabiDojo</td>
                    <td>Readers</td>
                    <td>Often fan JP tracks</td>
                    <td>Integrated quizzes for select titles</td>
                  </tr>
                  <tr>
                    <td>Jimaku / Substital + asbplayer</td>
                    <td>Anki miners</td>
                    <td>Fan .srt overlay</td>
                    <td>Closest DIY Migaku-like mining on CR</td>
                  </tr>
                  <tr>
                    <td>Migaku</td>
                    <td>Power users</td>
                    <td>On supported sites only</td>
                    <td>
                      <span className="no">Not on Crunchyroll</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Need Japanese subtitle files rather than a mining suite? Read{" "}
              <Link href="/crunchyroll-japanese-subtitles">how to get Japanese subtitles on Crunchyroll</Link>.
              Want a free Migaku-shaped habit without the invoice?{" "}
              <Link href="/migaku-free-alternative">Migaku free alternative</Link>.
            </p>

            <h2>Pricing reality (say it out loud)</h2>
            <p>
              Migaku is a <strong>subscription on top of</strong> the Crunchyroll (or Netflix) fee you already pay —
              and it still does not run on Crunchyroll. The free DIY stack (Yomitan + asbplayer + Anki) has the same
              CR limitation without the invoice. AnimeVocab&apos;s core loop is free forever on Crunchyroll; Pro
              unlocks Listening Mode transcription when JP subs are missing. Paying twice for a platform gap is the
              pattern we keep seeing in refund threads.
            </p>

            <h2>Beginner path tonight (no Migaku, no fan subs)</h2>
            <ol className="article-ol">
              <li>Open tonight&apos;s Crunchyroll episode — Japanese audio, English subs OK for plot.</li>
              <li>
                Install <Link href="/free-japanese-anime-extension">AnimeVocab</Link> and enable Listening Mode if
                JP text is missing.
              </li>
              <li>Save one spoken word per line in romaji — not ten.</li>
              <li>
                Review five minutes tomorrow (
                <Link href="/anime-spaced-repetition">SRS guide</Link>).
              </li>
            </ol>
            <p>
              Graduate to Lexirise or ManabiDojo when kana clicks; graduate to asbplayer when Anki feels natural.
              Longer narrative version:{" "}
              <Link href="/blog/migaku-crunchyroll-alternative-2026">Migaku Crunchyroll alternative (blog)</Link>.
            </p>

            <h2>Related pages in this cluster</h2>
            <ul>
              <li>
                <Link href="/does-language-reactor-work-on-crunchyroll">
                  Does Language Reactor work on Crunchyroll?
                </Link>
              </li>
              <li>
                <Link href="/crunchyroll-japanese-subtitles">Crunchyroll Japanese subtitles</Link>
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
                <Link href="/learn-japanese-crunchyroll">Learn Japanese on Crunchyroll</Link>
              </li>
              <li>
                <Link href="/vs-migaku">AnimeVocab vs Migaku</Link>
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
            <h2>Need a Migaku Crunchyroll alternative tonight?</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/does-language-reactor-work-on-crunchyroll", label: "LR on CR?" },
          { href: "/crunchyroll-japanese-subtitles", label: "JP subtitles" },
          { href: "/migaku-free-alternative", label: "Migaku free alt" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll hub" },
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
