import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/migaku-free-alternative";

export const metadata: Metadata = {
  title: "What Is the Free Alternative to Migaku? (2026 Guide)",
  description:
    "What is the free alternative to Migaku? Reddit’s DIY stack is Yomitan + asbplayer + Anki. All-in-ones: Language Reactor & Trancy. For anime beginners on Crunchyroll without Anki: AnimeVocab.",
  keywords: [
    "what is the free alternative to migaku",
    "migaku free alternative",
    "free migaku alternative",
    "migaku free alternative reddit",
    "migaku alternative reddit",
    "migaku free alternative github",
    "yomichan migaku alternative",
    "yomitan migaku alternative",
    "asbplayer migaku alternative",
    "migaku vs language reactor",
    "best free migaku alternative",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "What Is the Free Alternative to Migaku? (2026)",
    description:
      "DIY (Yomitan + asbplayer + Anki), freemium readers (Language Reactor, Trancy), or AnimeVocab for romaji + Crunchyroll — honest map.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Free Migaku Alternative (2026)",
    description: "Reddit’s stack vs all-in-ones vs AnimeVocab for anime beginners.",
  },
};

/** Exact PAA + AI-Overview questions from the Migaku free alternative SERP. */
const faqs = [
  {
    question: "What is the free alternative to Migaku?",
    answer:
      "There is no single clone. The free DIY alternative Reddit recommends is Yomitan + asbplayer + Anki. The free all-in-one for Netflix/YouTube dual subs is Language Reactor (or Trancy’s free tier). For Japanese anime beginners who need romaji and Crunchyroll without Anki setup, AnimeVocab is the free alternative.",
  },
  {
    question: "Is Migaku better than Language Reactor?",
    answer:
      "Migaku is deeper for Anki sentence mining and paid immersion workflows. Language Reactor is better as a free dual-subtitle companion on Netflix and YouTube if you can already read Japanese text. For beginners who cannot read kana yet, neither is ideal — AnimeVocab is built for that gap. Full comparison: AnimeVocab vs Language Reactor and Migaku vs Language Reactor.",
  },
  {
    question: "What sites work with Migaku?",
    answer:
      "Migaku’s media tools focus on sites like Netflix, YouTube, Disney+, and similar surfaces — not Crunchyroll. If you watch anime on Crunchyroll, use AnimeVocab Listening Mode, Lexirise, or ManabiDojo instead of expecting Migaku to cover CR.",
  },
  {
    question: "What's the difference between Anki and Migaku?",
    answer:
      "Anki is the free spaced-repetition flashcard app. Migaku is a paid immersion suite that helps you mine sentences from media into Anki (or its own review). You can use Anki forever without Migaku; Migaku without Anki is uncommon for power users. AnimeVocab includes built-in SRS so beginners can skip Anki entirely at first.",
  },
  {
    question: "What does Reddit recommend as a Migaku free alternative?",
    answer:
      "r/LearnJapanese threads usually say: drop Migaku’s subscription and rebuild mining with Yomitan (ex-Yomichan) + asbplayer + Anki. That stack is free and powerful — and setup-heavy. If you want zero Anki config for anime, try AnimeVocab first.",
  },
  {
    question: "Is there a free open-source Migaku alternative on GitHub?",
    answer:
      "asbplayer is the main open-source mining player. AnimeVocab’s Chrome extension is also open source (AGPL) with a free core loop — romaji cards and local SRS — without requiring Anki Connect.",
  },
  {
    question: "Is AnimeVocab really free forever?",
    answer:
      "Yes. Core word cards and local SRS are free with no account and no trial countdown. Optional Pro is only for hosted Listening Mode transcription without bringing your own API key.",
  },
];

export default function MigakuFreeAlternativePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="What Is the Free Alternative to Migaku? (2026 Guide)"
        description="What is the free alternative to Migaku? Reddit’s DIY stack, Language Reactor/Trancy freemium, and AnimeVocab for anime beginners on Crunchyroll."
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
          title="What is the free alternative to Migaku?"
          lede={
            <>
              Google and Reddit answer this with a <strong>DIY stack</strong> (Yomitan + asbplayer + Anki) or{" "}
              <strong>freemium readers</strong> (Language Reactor, Trancy). That is correct for power users —
              and incomplete for anime beginners. <strong>AnimeVocab</strong> is the free Migaku alternative
              when you need romaji-first cards, built-in SRS, and Crunchyroll audio without Anki night.
            </>
          }
          verdictTag="Pick by job (2026)"
          verdict={
            <>
              <strong>Replicate Migaku mining free:</strong> Yomitan + asbplayer + Anki.{" "}
              <strong>Netflix/YouTube dual subs free:</strong> Language Reactor.{" "}
              <strong>Anime month-zero / Crunchyroll / no Anki:</strong> AnimeVocab.{" "}
              <strong>Keep Migaku</strong> if you already mine daily and want the paid suite. Side-by-side:{" "}
              <Link href="/vs-migaku">vs Migaku</Link> ·{" "}
              <Link href="/migaku-vs-language-reactor">Migaku vs Language Reactor</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>What Reddit says (Migaku free alternative)</h2>
            <p>
              Threads like <em>Free migaku alternatives?</em> on r/LearnJapanese usually agree: Migaku added
              more than many people want to pay for, and you can rebuild the core mining loop with free tools.
              The default recipe is:
            </p>
            <ol>
              <li>
                <strong>Yomitan</strong> (successor to Yomichan) — hover dictionary + optional Anki export
              </li>
              <li>
                <strong>asbplayer</strong> — selectable subs, audio + screenshot mining into Anki
              </li>
              <li>
                <strong>Anki</strong> — free SRS that actually stores the cards
              </li>
            </ol>
            <p>
              That stack is the closest free clone of Migaku’s power-user flow. It is also the reason beginners
              bounce — config, JP subtitle files, and Anki templates. Deep dive:{" "}
              <Link href="/blog/migaku-free-alternative-reddit-2026">Migaku free alternative Reddit roundup</Link>
              , <Link href="/vs-asbplayer">vs asbplayer</Link>,{" "}
              <Link href="/blog/yomitan-anime-alternative-video-immersion-2026">Yomitan for anime</Link>.
            </p>

            <h2>1. Power-user free setup (closest to Migaku mining)</h2>
            <p>
              Use this if you can already read Japanese subtitles and you want sentence mining without a
              subscription — the same answer AI overviews and Reddit give.
            </p>
            <ul>
              <li>
                <strong>Yomitan / Yomichan</strong> — free browser dictionary (lookups, pitch, audio)
              </li>
              <li>
                <strong>asbplayer</strong> — free mining player for browser / local video + Anki Connect
              </li>
              <li>
                <strong>Anki</strong> — free SRS; Migaku is optional glue, not a requirement
              </li>
            </ul>
            <p>
              Difference vs Migaku: you own the stack (often open source), but you do the wiring. See{" "}
              <Link href="/anki-vs-migaku">Anki vs Migaku</Link>.
            </p>

            <h2>2. All-in-one freemium extensions (no Anki required)</h2>
            <ul>
              <li>
                <strong>Language Reactor</strong> — best free dual-subtitle companion for Netflix and YouTube
                if you can read JP text (<Link href="/vs-language-reactor">vs Language Reactor</Link>)
              </li>
              <li>
                <strong>Trancy</strong> — freemium bilingual subs + AI features; popular “Migaku alternative”
                marketing for Netflix/YouTube (<Link href="/vs-trancy">vs Trancy</Link>)
              </li>
            </ul>
            <p>
              Neither replaces Crunchyroll Listening Mode for beginners.{" "}
              <Link href="/migaku-vs-language-reactor">Is Migaku better than Language Reactor?</Link>
            </p>

            <h2>3. AnimeVocab — free Migaku alternative for anime beginners</h2>
            <p>
              AI overviews and competitor blogs often skip the learner who <em>cannot read kana yet</em> and
              watches <em>Crunchyroll without Japanese subs</em>. That is AnimeVocab’s job:
            </p>
            <ul>
              <li>
                <strong>Romaji-first cards</strong> — start tonight without a kana course first
              </li>
              <li>
                <strong>Built-in SRS</strong> — no Anki install for the core habit ({TIERS.free.priceLabel}{" "}
                forever)
              </li>
              <li>
                <strong>Listening Mode</strong> — works from spoken Japanese when subtitle text is missing
                (Migaku does not cover Crunchyroll)
              </li>
              <li>
                <strong>Open source / local-first</strong> — GitHub-friendly; no account required for free loop
              </li>
            </ul>

            <h2>Free Migaku alternatives compared (2026)</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Path</th>
                    <th scope="col">Free?</th>
                    <th scope="col">Best for</th>
                    <th scope="col">Crunchyroll</th>
                    <th scope="col">Anki?</th>
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
                    <td>Beginners · romaji · anime</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Optional later</td>
                  </tr>
                  <tr>
                    <td>Yomitan + asbplayer + Anki</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Power-user mining (Reddit default)</td>
                    <td>With fan .srt</td>
                    <td>
                      <span className="yes">Required</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Language Reactor</td>
                    <td>Freemium</td>
                    <td>Netflix/YouTube dual subs</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Optional</td>
                  </tr>
                  <tr>
                    <td>Trancy</td>
                    <td>Freemium</td>
                    <td>Netflix/YouTube + AI extras</td>
                    <td>
                      <span className="no">Limited</span>
                    </td>
                    <td>Built-in / export</td>
                  </tr>
                  <tr>
                    <td>Migaku</td>
                    <td>Trial → paid</td>
                    <td>Paid mining suite</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Core workflow</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>What sites work with Migaku? (and what to use instead)</h2>
            <p>
              Migaku is strongest on Netflix / YouTube-class surfaces. It is <strong>not</strong> a Crunchyroll
              magic wand. For CR:{" "}
              <Link href="/blog/migaku-crunchyroll-alternative-2026">Migaku Crunchyroll alternatives</Link>,{" "}
              <Link href="/learn-japanese-crunchyroll">Crunchyroll Japanese guide</Link>,{" "}
              <Link href="/manabidojo-alternative">ManabiDojo alternative</Link>.
            </p>

            <h2>When you should still pay for Migaku</h2>
            <p>
              You already review Anki daily, can read kana, and want deep mining automation. Read{" "}
              <Link href="/blog/is-migaku-worth-it-2026">Is Migaku worth it?</Link>. Canceling?{" "}
              <Link href="/blog/cancel-migaku-keep-learning-anime-2026">Keep learning without Migaku</Link>.
            </p>

            <h2>FAQ</h2>
            {faqs.map((f) => (
              <div key={f.question}>
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}

            <p>
              Also: <Link href="/vs-migaku">AnimeVocab vs Migaku</Link>,{" "}
              <Link href="/free-japanese-anime-extension">free Japanese anime extension</Link>,{" "}
              <Link href="/learn-japanese-with-anime">2026 tool ranking</Link>,{" "}
              <Link href={GITHUB_URL}>AnimeVocab on GitHub</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Skip the subscription. Start this episode.</h2>
            <p style={{ color: "var(--ink-2)", marginBottom: 18 }}>
              Free Chrome extension — romaji + SRS. No Anki required to begin.
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
          { href: "/migaku-vs-language-reactor", label: "Migaku vs LR" },
          { href: "/anki-vs-migaku", label: "Anki vs Migaku" },
          { href: "/manabidojo-alternative", label: "ManabiDojo alt" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/blog/is-migaku-worth-it-2026", label: "Is Migaku worth it?" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
