import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/crunchyroll-japanese-subtitles";

export const metadata: Metadata = {
  title: "Crunchyroll Japanese Subtitles (2026): How to Get JP Subs — or Skip Them",
  description:
    "How to get Japanese subtitles on Crunchyroll: official tracks (rare outside Japan), Kitsunekko/Jimaku fan overlays, Substital, or Listening Mode when you cannot read JP text yet.",
  keywords: [
    "crunchyroll japanese subtitles",
    "does crunchyroll have japanese subtitles",
    "japanese subtitles crunchyroll",
    "add japanese subtitles crunchyroll",
    "crunchyroll japanese subs",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Crunchyroll Japanese Subtitles (2026)",
    description:
      "Official JP tracks are rare outside Japan. Here is how to overlay fan subs — or learn from audio without files.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Crunchyroll Japanese Subtitles (2026)",
    description: "How to get Japanese subtitles on Crunchyroll — or skip the file hunt as a beginner.",
  },
};

const faqs = [
  {
    question: "Does Crunchyroll have Japanese subtitles?",
    answer:
      "Outside Japan, most Crunchyroll titles ship with English subtitles only. Japanese dialogue audio is available, but Japanese subtitle tracks are often missing due to licensing — not a hidden player setting.",
  },
  {
    question: "How do I add Japanese subtitles to Crunchyroll?",
    answer:
      "Download a fan .srt from Kitsunekko or jimaku.cc, then overlay it with Substital or Jimaku Player while Crunchyroll plays. Align the timing offset carefully. ManabiDojo integrates fan tracks for some titles. Beginners who cannot read kana yet should prefer Listening Mode over file overlays.",
  },
  {
    question: "What is the easiest way for beginners?",
    answer:
      "Skip fan files at first. Use AnimeVocab Listening Mode to capture spoken lines as romaji-first cards with built-in spaced repetition. Overlay workflows assume you can already read Japanese text.",
  },
  {
    question: "Are fan Japanese subtitles legal?",
    answer:
      "Fan subtitles sit in a gray area — community transcriptions, not official licensor tracks. Use them for personal study; do not redistribute. Prefer official JP tracks whenever they exist.",
  },
  {
    question: "Will Language Reactor or Migaku give me Japanese subs on Crunchyroll?",
    answer:
      "No. Neither Language Reactor nor Migaku supports Crunchyroll, and neither can invent a Japanese track that Crunchyroll did not license. See the dedicated answers for each tool.",
  },
];

export default function CrunchyrollJapaneseSubtitlesPage() {
  const faqLd = faqJsonLd(faqs);
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to get Japanese subtitles on Crunchyroll",
    description:
      "Add Japanese subtitle overlays to Crunchyroll with fan files, or use an audio-first workflow when you cannot read JP text yet.",
    totalTime: "PT25M",
    step: [
      {
        "@type": "HowToStep",
        name: "Check whether an official Japanese subtitle track exists",
        text: "Open the Crunchyroll player subtitle menu. Outside Japan, most titles only offer English (and sometimes other translation languages) — not Japanese.",
      },
      {
        "@type": "HowToStep",
        name: "Choose overlay files or an audio-first tool",
        text: "If you can read kana, download a fan .srt from Kitsunekko or jimaku.cc. If you cannot, install AnimeVocab and use Listening Mode instead of hunting files.",
        url: `${SITE_URL}/japanese-subtitles-anime`,
      },
      {
        "@type": "HowToStep",
        name: "Overlay and align (readers) or capture from audio (beginners)",
        text: "Readers: load the .srt in Substital or Jimaku Player and nudge the offset until dialogue locks. Beginners: save one spoken word per line and review with SRS tomorrow.",
        url: `${SITE_URL}/learn-japanese-crunchyroll`,
      },
    ],
  };

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Crunchyroll Japanese Subtitles (2026): How to Get JP Subs — or Skip Them"
        description="How to get Japanese subtitles on Crunchyroll — official tracks, fan overlays, or Listening Mode when you cannot read JP text yet."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
            { label: "Japanese subtitles" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Crunchyroll Japanese subtitles (2026)"
          lede={
            <>
              Searching <strong>Crunchyroll Japanese subtitles</strong>? Outside Japan, most titles ship{" "}
              <strong>English translations, not Japanese text</strong>. You can still study — either by overlaying
              fan Japanese <code>.srt</code> files, or by skipping files entirely and learning from audio.
            </>
          }
          verdictTag="Pick your path"
          verdict={
            <>
              <strong>Can read kana?</strong> Kitsunekko / jimaku.cc + Substital or Jimaku Player.{" "}
              <strong>Month-zero?</strong> AnimeVocab Listening Mode ({TIERS.free.priceLabel} core) — no file hunt.
              Broader anime-sub guide: <Link href="/japanese-subtitles-anime">Japanese subtitles for anime</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Why official Japanese subs are rare on Crunchyroll</h2>
            <p>
              Licensing limits Japanese subtitle tracks in many regions. You usually get Japanese{" "}
              <em>audio</em> and English (or other) <em>translation</em> subs. Community threads on WaniKani and
              Reddit have documented this for years — it is not a Chrome bug and not something Language Reactor or
              Migaku can unlock. Those tools do not support Crunchyroll anyway (
              <Link href="/does-language-reactor-work-on-crunchyroll">LR</Link>,{" "}
              <Link href="/does-migaku-work-on-crunchyroll">Migaku</Link>).
            </p>

            <h2>Option A — Overlay fan Japanese subtitles</h2>
            <p>
              Advanced readers treat Crunchyroll as a video surface and layer Japanese text themselves:
            </p>
            <ol className="article-ol">
              <li>
                Find a matching fan <code>.srt</code> on <strong>Kitsunekko</strong> or <strong>jimaku.cc</strong>{" "}
                for the exact episode.
              </li>
              <li>
                Install <strong>Substital</strong> (simple upload + offset) or <strong>Jimaku Player</strong>{" "}
                (remembers series offsets; can fetch from jimaku.cc).
              </li>
              <li>Play the Crunchyroll episode, load the file, and nudge timing until mouths and text lock.</li>
              <li>
                Optional: mine sentences into Anki with <Link href="/vs-asbplayer">asbplayer</Link> + Yomitan.
              </li>
            </ol>
            <p>
              Detailed Substital walkthrough:{" "}
              <Link href="/blog/substital-crunchyroll-japanese-subtitles-2026">Substital on Crunchyroll</Link>.
              Kitsunekko tips: <Link href="/blog/kitsunekko-subtitles-anime-2026">Kitsunekko guide</Link>. Jimaku vs
              audio capture:{" "}
              <Link href="/blog/jimaku-crunchyroll-subtitles-vs-listening-mode">Jimaku vs Listening Mode</Link>.
            </p>
            <p>
              <strong>Honest tradeoff:</strong> overlays assume literacy. A perfect Japanese file is still a reading
              wall if you cannot parse kana at speed. Timing mismatches and missing episodes are normal — budget
              setup time every season.
            </p>

            <h2>What &quot;Japanese subtitles&quot; actually means on Crunchyroll</h2>
            <p>
              People use the phrase for three different jobs, and mixing them up wastes weekends:
            </p>
            <ol className="article-ol">
              <li>
                <strong>Official Japanese closed captions</strong> from the licensor — rare outside Japan, selected
                in the player&apos;s subtitle menu when present.
              </li>
              <li>
                <strong>Fan Japanese transcriptions</strong> you overlay yourself — Kitsunekko / jimaku.cc files that
                approximate what was said, with variable quality and timing.
              </li>
              <li>
                <strong>English translation subs</strong> — useful for plot, useless as a Japanese reading track.
                Tools that only see English text cannot teach you Japanese orthography.
              </li>
            </ol>
            <p>
              When someone asks for &quot;Crunchyroll Japanese subtitles&quot; they usually want job (1) or (2).
              Beginners who cannot read kana yet should not optimize for either — they should optimize for capturing
              spoken vocabulary and reviewing it. That is why this page refuses to pretend every learner needs a
              perfect <code>.srt</code> before episode one.
            </p>

            <h2>Option B — Skip files; learn from audio</h2>
            <p>
              If you are early in Japanese, fan-sub mining is the wrong first boss. Work from what was{" "}
              <strong>spoken</strong>:
            </p>
            <ul>
              <li>
                Keep English subs for plot comprehension if you want — but save vocabulary from the Japanese audio
                line, not from the English translation.
              </li>
              <li>
                Use <strong>AnimeVocab Listening Mode</strong> to transcribe lines when JP text is missing, then
                review with built-in spaced repetition.
              </li>
              <li>
                Pick slow shows from{" "}
                <Link href="/best-anime-to-learn-japanese">best anime to learn Japanese</Link> so word boundaries
                are audible.
              </li>
            </ul>
            <p>
              Full platform hub: <Link href="/learn-japanese-crunchyroll">learn Japanese on Crunchyroll</Link>. Direct
              blog FAQ:{" "}
              <Link href="/blog/does-crunchyroll-have-japanese-subtitles-2026">
                Does Crunchyroll have Japanese subtitles?
              </Link>
            </p>

            <h2>Option C — Reader tools when some JP text exists</h2>
            <p>
              Some titles or regions expose more Japanese text; fan-integrated tools can help:
            </p>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Approach</th>
                    <th scope="col">Needs literacy?</th>
                    <th scope="col">Setup pain</th>
                    <th scope="col">Best for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab Listening Mode</strong>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Low</td>
                    <td>Beginners · no JP track</td>
                  </tr>
                  <tr>
                    <td>Substital / Jimaku + fan .srt</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Medium–high</td>
                    <td>Readers who want true JP text</td>
                  </tr>
                  <tr>
                    <td>Lexirise</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Low</td>
                    <td>Click-to-translate when text exists</td>
                  </tr>
                  <tr>
                    <td>ManabiDojo</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Low–medium</td>
                    <td>Integrated fan subs + quizzes</td>
                  </tr>
                  <tr>
                    <td>Language Reactor / Migaku</td>
                    <td>—</td>
                    <td>
                      <span className="no">N/A on CR</span>
                    </td>
                    <td>Use on Netflix instead</td>
                  </tr>
                </tbody>
              </table>
            </div>

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
            <h2>No JP track tonight? Learn from the audio anyway.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/japanese-subtitles-anime", label: "JP subs (all platforms)" },
          { href: "/does-language-reactor-work-on-crunchyroll", label: "LR on CR?" },
          { href: "/does-migaku-work-on-crunchyroll", label: "Migaku on CR?" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll hub" },
          { href: "/blog/substital-crunchyroll-japanese-subtitles-2026", label: "Substital guide" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
