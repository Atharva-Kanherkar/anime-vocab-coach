import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/japanese-subtitles-anime";

export const metadata: Metadata = {
  title: "Japanese Subtitles for Anime (2026): Jimaku, Kitsunekko, or No Files at All",
  description:
    "How to get Japanese subtitles for anime in 2026 — Kitsunekko fan subs, Jimaku Player, Substital overlays, or Listening Mode when you cannot read JP text yet.",
  keywords: [
    "japanese subtitles anime",
    "japanese subtitles crunchyroll",
    "kitsunekko subtitles",
    "jimaku crunchyroll",
    "add japanese subtitles anime",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Japanese Subtitles for Anime (2026)",
    description:
      "Jimaku, Kitsunekko fan subs, Substital overlays — or skip files entirely with Listening Mode for beginners.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Japanese Subtitles for Anime (2026)",
    description:
      "Japanese subtitles for anime: fan sub files, overlay tools, and the no-files path for beginners.",
  },
};

const faqs = [
  {
    question: "How do I get Japanese subtitles for anime on Crunchyroll?",
    answer:
      "Crunchyroll rarely ships Japanese subtitle tracks outside Japan. Options: overlay fan .srt files from Kitsunekko or jimaku.cc with Substital or Jimaku Player, use ManabiDojo for integrated fan subs, or skip text entirely with AnimeVocab Listening Mode for romaji cards from audio.",
  },
  {
    question: "What is Kitsunekko?",
    answer:
      "Kitsunekko is a long-running fan subtitle archive where volunteers upload Japanese .srt files matched to anime episodes. You download the file, then overlay it on your stream with Substital or Jimaku Player. Timing alignment is manual work.",
  },
  {
    question: "Jimaku vs Substital — which is better?",
    answer:
      "Substital is simpler: upload a file, nudge offset, done. Jimaku Player remembers series offsets and can fetch from jimaku.cc — better for repeat viewers who overlay fan subs every week. Neither teaches romaji; both assume you can read Japanese text.",
  },
  {
    question: "What if I cannot read Japanese subtitles yet?",
    answer:
      "A perfect Japanese .srt overlay is still a reading wall for month-zero learners. Use AnimeVocab Listening Mode to transcribe spoken lines into romaji-first cards with built-in SRS — no file hunt required.",
  },
  {
    question: "Are fan Japanese subtitles legal?",
    answer:
      "Fan subtitles exist in a gray area — they are community translations, not official licensor tracks. Use them for personal study; do not redistribute. When official JP subs exist (rare on CR), prefer those.",
  },
];

export default function JapaneseSubtitlesAnimePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Japanese Subtitles for Anime (2026): Jimaku, Kitsunekko, or No Files at All"
        description="How to get Japanese subtitles for anime — fan sub files, overlay tools, and Listening Mode when you cannot read JP text yet."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Japanese subtitles" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Japanese subtitles for anime (2026)"
          lede={
            <>
              Searching <strong>japanese subtitles anime</strong>? On most Western streams you get{" "}
              <strong>English translations, not Japanese text</strong>. The community fills the gap with{" "}
              <strong>Kitsunekko</strong> fan files and <strong>Jimaku</strong> overlays — or you skip files
              entirely with <strong>Listening Mode</strong> when you cannot read kana yet.
            </>
          }
          verdictTag="Pick your path"
          verdict={
            <>
              <strong>Can read JP + want on-screen text?</strong> Kitsunekko → Substital/Jimaku.{" "}
              <strong>Month-zero / no file hunt?</strong> AnimeVocab Listening Mode. Platform guide:{" "}
              <Link href="/learn-japanese-crunchyroll">learn Japanese on Crunchyroll</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Why Japanese subtitles are hard to find</h2>
            <p>
              Licensing limits Japanese subtitle tracks on Crunchyroll, Netflix, and most Western platforms.
              You hear Japanese audio, but the on-screen text is usually English. That breaks tools that need
              selectable JP subs — Language Reactor, Yomitan hover, raw mining. Fan subtitle communities (
              Kitsunekko, jimaku.cc) exist because official tracks are missing, not because learners enjoy
              file management.
            </p>

            <h2>Path 1: Fan subtitle files (Kitsunekko + overlays)</h2>
            <p>
              Download a matching <strong>.srt</strong> from Kitsunekko, load it in{" "}
              <strong>Substital</strong> or <strong>Jimaku Player</strong>, align timing, then read Japanese
              while English burn-in stays on screen. Power users pair overlays with Yomitan and asbplayer for
              Anki mining.
            </p>
            <ul>
              <li>
                <Link href="/blog/kitsunekko-subtitles-anime-2026">Kitsunekko subtitles guide (2026)</Link> —
                find and download fan files
              </li>
              <li>
                <Link href="/blog/substital-crunchyroll-japanese-subtitles-2026">
                  Substital on Crunchyroll
                </Link>{" "}
                — simple overlay setup
              </li>
              <li>
                <Link href="/blog/jimaku-crunchyroll-subtitles-vs-listening-mode">
                  Jimaku vs Listening Mode
                </Link>{" "}
                — offset memory vs no files
              </li>
            </ul>

            <h2>Path 2: Integrated fan-sub tools</h2>
            <p>
              <strong>ManabiDojo</strong> fetches fan Japanese subs and adds quizzes on Crunchyroll — strong
              when you can already read. <strong>Lexirise</strong> click-to-translates when JP text exists in
              the DOM. Both assume literacy; neither ships romaji on-ramp.
            </p>

            <h2>Path 3: No subtitle files at all (beginners)</h2>
            <p>
              If you <strong>cannot read Japanese</strong>, overlaying a perfect `.srt` still feels like a
              wall. <strong>AnimeVocab Listening Mode</strong> transcribes spoken lines into romaji-first cards
              with built-in SRS — no Kitsunekko hunt, no offset tuning. Core loop is{" "}
              {TIERS.free.priceLabel} forever; Pro unlocks transcription when JP subs are missing.
            </p>

            <h2>Japanese subtitle paths compared</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Approach</th>
                    <th scope="col">Setup</th>
                    <th scope="col">Can read kana?</th>
                    <th scope="col">JP text on screen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Kitsunekko + Substital</td>
                    <td>Download + offset</td>
                    <td>
                      <span className="yes">Required</span>
                    </td>
                    <td>
                      <span className="yes">Yes (overlay)</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Jimaku Player</td>
                    <td>Userscript + offsets</td>
                    <td>
                      <span className="yes">Required</span>
                    </td>
                    <td>
                      <span className="yes">Yes (overlay)</span>
                    </td>
                  </tr>
                  <tr>
                    <td>ManabiDojo</td>
                    <td>Extension install</td>
                    <td>
                      <span className="yes">Required</span>
                    </td>
                    <td>
                      <span className="yes">When available</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>AnimeVocab Listening Mode</strong>
                    </td>
                    <td>Chrome install</td>
                    <td>
                      <span className="no">Romaji-first</span>
                    </td>
                    <td>
                      <span className="no">Not required</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>Related guides</h2>
            <ul>
              <li>
                <Link href="/learn-japanese-crunchyroll">Learn Japanese on Crunchyroll</Link> — platform hub
              </li>
              <li>
                <Link href="/blog/jimaku-crunchyroll-subtitles-vs-listening-mode">
                  Jimaku vs Listening Mode
                </Link>
              </li>
              <li>
                <Link href="/blog/kitsunekko-subtitles-anime-2026">Kitsunekko subtitles (2026)</Link>
              </li>
              <li>
                <Link href="/blog/substital-crunchyroll-japanese-subtitles-2026">
                  Substital Crunchyroll guide
                </Link>
              </li>
              <li>
                <Link href="/asbplayer-alternative">asbplayer alternative</Link> — mine fan subs to Anki
              </li>
              <li>
                <Link href="/romaji-japanese-learning">Romaji-first learning path</Link>
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
            <h2>Cannot read JP subs yet? Skip the file hunt.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/asbplayer-alternative", label: "asbplayer alt" },
          { href: "/lingopie-alternative", label: "Lingopie alt" },
          { href: "/learn-japanese-with-anime", label: "Compare hub" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
