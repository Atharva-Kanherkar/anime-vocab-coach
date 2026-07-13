import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/learn-japanese-with-anime";

export const metadata: Metadata = {
  title: "Learn Japanese with Anime (2026) — Free Tools Ranked + Beginner Plan",
  description:
    "Learn Japanese with anime free and paid: AnimeVocab, Language Reactor, asbplayer, Lexirise, Migaku. Ranked for beginners, Crunchyroll, and romaji — plus beginner show picks.",
  keywords: [
    "learn japanese with anime",
    "learn japanese with anime free",
    "how to learn japanese with anime",
    "learn japanese from anime",
    "best way to learn japanese with anime",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Learn Japanese with Anime (2026)",
    description:
      "Free and paid tools ranked — plus how to turn tonight’s episode into vocabulary.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese with Anime (2026)",
    description: "Tools ranked for beginners and power users. Free path included.",
  },
};

const faqs = [
  {
    question: "Can you learn Japanese with anime?",
    answer:
      "Yes if you actively notice words, understand them in context, and review them — not if you only watch with English subs. Free tools make that loop possible on shows you already watch.",
  },
  {
    question: "What is the best free way to learn Japanese with anime?",
    answer:
      "Beginners: AnimeVocab (romaji + built-in SRS + Crunchyroll Listening Mode). Readers on Netflix/YouTube: Language Reactor. Miners: asbplayer + Yomitan + Anki. Full free guide: learn Japanese with anime free.",
  },
  {
    question: "Which anime is best for learning Japanese?",
    answer:
      "Shirokuma Cafe, Ghibli films, and slice-of-life shows like Yuru Camp. See best anime to learn Japanese for the ranked list.",
  },
];

export default function LearnJapaneseWithAnimePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese with Anime (2026) — Free Tools Ranked + Beginner Plan"
        description="Learn Japanese with anime free and paid: AnimeVocab, Language Reactor, asbplayer, Lexirise, Migaku — ranked for beginners and Crunchyroll."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { label: "How to learn Japanese with anime" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Learn Japanese with anime (2026)"
          lede={
            <>
              Anime is why a huge number of people start Japanese — and a great source of spoken vocabulary
              you&apos;ll actually remember. Watching with English subs alone teaches almost nothing. Here is
              what works, every major tool ranked, and a{" "}
              <Link href="/learn-japanese-with-anime-free">learn Japanese with anime free</Link> path if you
              refuse another subscription.
            </>
          }
          verdictTag="The one thing that matters"
          verdict={
            <>
              Passive watching doesn&apos;t work. Learning happens when you{" "}
              <strong>
                notice a word, understand it in context, and see it again before you forget
              </strong>
              . Every tool below is a different way to force that loop. Free starter:{" "}
              <Link href="/free-japanese-anime-extension">AnimeVocab Chrome extension</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Type</th>
                    <th scope="col">Price</th>
                    <th scope="col">No JP subs needed</th>
                    <th scope="col">Beginner / romaji</th>
                    <th scope="col">Built-in review</th>
                    <th scope="col">Open source</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="us">
                      AnimeVocab
                    </th>
                    <td className="us">Chrome ext</td>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td className="us">
                      <span className="yes">Yes</span>
                      <span className="cell-note">transcribes audio</span>
                    </td>
                    <td className="us">
                      <span className="yes">Yes</span>
                      <span className="cell-note">romaji-first</span>
                    </td>
                    <td className="us">
                      <span className="yes">Built-in SRS</span>
                    </td>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Language Reactor</th>
                    <td>Chrome / FF ext</td>
                    <td>Free · Pro ~$5/mo</td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">needs a sub track</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">intermediate+</span>
                    </td>
                    <td>Light (Anki export)</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Migaku</th>
                    <td>Ext + mobile apps</td>
                    <td>$9/mo · $399 lifetime</td>
                    <td>
                      <span className="no">Partial</span>
                      <span className="cell-note">YouTube/podcasts, not Netflix/CR</span>
                    </td>
                    <td>Partial (furigana)</td>
                    <td>
                      <span className="yes">Built-in SRS</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Trancy</th>
                    <td>Ext + mobile</td>
                    <td>Free · from $3.99/mo</td>
                    <td>
                      <span className="yes">Yes</span>
                      <span className="cell-note">Whisper, paid</span>
                    </td>
                    <td>Partial (phonetic subs)</td>
                    <td>Light flashcards</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Lexirise</th>
                    <td>Chrome ext</td>
                    <td>Free · Pro tier</td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">needs on-screen JP text</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Pro SRS</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">ManabiDojo</th>
                    <td>Chrome ext</td>
                    <td>Free core · premium</td>
                    <td>
                      <span className="no">Partial</span>
                      <span className="cell-note">fan JP subs overlay</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Premium flashcards</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">YumeGo</th>
                    <td>Chrome ext</td>
                    <td>Free · Premium</td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">needs JP sub text</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Phrase library + SRS</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Lingoku</th>
                    <td>Chrome / Edge / FF ext</td>
                    <td>Free · BYOK API</td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">needs JP sub text</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Exposure SRS</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">asbplayer</th>
                    <td>Chrome ext + web</td>
                    <td>
                      <span className="yes">Free</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">needs subs/files</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">no dict/romaji</span>
                    </td>
                    <td>Anki only</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Animelon</th>
                    <td>Website</td>
                    <td>
                      <span className="yes">Free</span>
                    </td>
                    <td>Own catalog</td>
                    <td>
                      <span className="yes">Yes</span>
                      <span className="cell-note">romaji subs</span>
                    </td>
                    <td>Quizzes</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Memento</th>
                    <td>Desktop player</td>
                    <td>
                      <span className="yes">Free</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">local files</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Anki only</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--ink-3)", marginTop: 10 }}>
              Prices and features verified from public sources as of 2026 and change often. Check each
              tool&apos;s site before subscribing.
            </p>
          </div>
        </section>

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>The beginner problem nobody mentions</h2>
            <p>
              Here&apos;s the trap most guides skip:{" "}
              <strong>
                almost every &quot;learn Japanese with anime&quot; tool assumes you can already read Japanese
                subtitles.
              </strong>{" "}
              Dual-subtitle readers, sentence miners, subtitle repositories like Jimaku and Kitsunekko. They
              all hand you kana and kanji and expect you to read them. If you can&apos;t tell hiragana from
              katakana yet, most of this ecosystem is closed to you.
            </p>
            <p>
              That&apos;s the specific gap AnimeVocab was built for, and why this guide separates tools into
              two honest camps rather than crowning one winner.
            </p>

            <h2>If you&apos;re a beginner (can&apos;t read kana yet)</h2>
            <p>Start where romaji is a first-class citizen and setup is near zero.</p>
            <ul>
              <li>
                <strong>AnimeVocab</strong>: a Chrome extension that pushes one useful word per line,
                romaji-first, and works on YouTube, Netflix, and Crunchyroll. On shows with no Japanese
                subtitle track it transcribes the audio, so Crunchyroll and new releases aren&apos;t off-limits.
                Core is free; Pro ({TIERS.pro.priceLabel}) only pays for hands-off transcription.{" "}
                <Link href="/language-reactor-alternative">Language Reactor alternative →</Link>
                {" · "}
                <Link href="/vs-language-reactor">vs Language Reactor</Link>
              </li>
              <li>
                <strong>Animelon</strong>: a free website that streams anime with switchable romaji, hiragana,
                kanji, and English subtitle tracks plus a hover dictionary and quizzes. Genuinely
                beginner-friendly. The catch: it hosts content on a legally gray basis and is unreliable (titles
                vanish and playback breaks).{" "}
                <Link href="/animelon-alternative">Animelon alternative →</Link>
                {" · "}
                <Link href="/vs-animelon">vs Animelon</Link>
              </li>
              <li>
                <strong>Leaving Lingopie or a retired hover dictionary?</strong>{" "}
                <Link href="/lingopie-alternative">Lingopie alternative</Link>
                {" · "}
                <Link href="/rikaikun-alternative">Rikaikun alternative</Link>
                {" · "}
                <Link href="/japanese-subtitles-anime">Japanese subtitles for anime</Link>
              </li>
            </ul>

            <h2>If you can already read some Japanese</h2>
            <p>Now the power tools earn their keep.</p>
            <ul>
              <li>
                <strong>Language Reactor</strong>: a solid free dual-subtitle reader for Netflix and YouTube,
                with a deep dictionary. Pro (~$5/mo) adds machine translation and Anki export. Needs an
                existing subtitle track and is pitched at intermediate learners.{" "}
                <Link href="/language-reactor-alternative">Language Reactor alternative</Link> ·{" "}
                <Link href="/vs-language-reactor">See how it compares to AnimeVocab →</Link>
              </li>
              <li>
                <strong>Migaku</strong>: the deepest browser mining suite, built around sentence-mining into a
                built-in SRS. Real depth if you&apos;re committed to that workflow and to the setup and
                subscription ($9/mo, or $399 lifetime) it asks for. Looking for free first?{" "}
                <Link href="/migaku-free-alternative">Migaku free alternative</Link> ·{" "}
                <Link href="/vs-migaku">vs Migaku</Link>.
              </li>
              <li>
                <strong>SubMiner</strong>: desktop mpv overlay with bundled Yomitan and one-click Anki sentence
                cards — the 2026 upgrade path for local-file immersion miners.{" "}
                <Link href="/blog/subminer-vs-asbplayer-anime-mining-2026">SubMiner vs asbplayer →</Link>
              </li>
              <li>
                <strong>asbplayer</strong>: free and open source, the immersion crowd&apos;s favorite for mining
                audio + screenshot + sentence cards into Anki. No dictionary or romaji of its own; you bolt on
                Yomitan. Powerful, not beginner-usable.{" "}
                <Link href="/vs-asbplayer">AnimeVocab vs asbplayer →</Link>
                {" · "}
                <Link href="/asbplayer-alternative">asbplayer alternative</Link>
              </li>
              <li>
                <strong>Memento</strong>: a free, actively maintained desktop player (mpv-based) with a
                Yomitan-style pop-up dictionary and strong Anki export. For local video files and readers, not
                romaji beginners.
              </li>
            </ul>

            <h2>The bottom line</h2>
            <p>
              There&apos;s a best tool for where you are right now. The mining tools (Migaku, asbplayer) are
              built for learners who already read Japanese and want to turn immersion into an Anki pipeline:
              powerful for that crowd, overkill for everyone else. Language Reactor is a solid reader once
              you&apos;re past kana. But every one of them starts with a subtitle you have to read. If you&apos;re not
              there yet, or you just want to watch tonight&apos;s episode and come away with a word, AnimeVocab
              is the one that meets you where you are, and the only one that keeps working when there&apos;s no
              subtitle track at all. Free install hub:{" "}
              <Link href="/free-japanese-anime-extension">free Japanese anime extension</Link>. App ranking:{" "}
              <Link href="/blog/best-apps-learn-japanese-anime-2026">best apps (2026)</Link>. Chrome roundup:{" "}
              <Link href="/blog/best-chrome-extensions-learn-japanese-anime-2026">
                best extensions ranked (2026)
              </Link>
              .
            </p>

            <h2>Where you watch (platform guides)</h2>
            <ul>
              <li>
                <Link href="/learn-japanese-crunchyroll">Crunchyroll</Link> — simulcasts + Listening Mode when
                JP subs are missing
              </li>
              <li>
                <Link href="/learn-japanese-netflix-anime">Netflix anime</Link> — dual-sub / reader ecosystem
              </li>
              <li>
                <Link href="/learn-japanese-youtube-anime">YouTube anime</Link> — free clips and channels
              </li>
              <li>
                <Link href="/learn-japanese-disney-plus">Disney+</Link> ·{" "}
                <Link href="/learn-japanese-prime-video">Prime Video</Link> ·{" "}
                <Link href="/learn-japanese-hidive">HIDIVE</Link> ·{" "}
                <Link href="/learn-japanese-hulu">Hulu</Link>
              </li>
            </ul>

            <h2>Learn by creating manga</h2>
            <p>
              Watching builds listening vocabulary; <strong>writing short manga</strong> forces you to produce
              Japanese you remember.{" "}
              <Link href="/learn-japanese-manga">Learn Japanese by writing manga</Link> walks through the
              workflow, and <Link href="/ai-manga-maker">AnimeVocab Manga Studio</Link> lets you draft a full
              chapter free — edit dialogue, redraw panels, and publish to the{" "}
              <Link href="/gallery">public gallery</Link>. Open <Link href="/studio">Manga Studio</Link> to try
              it without an account.
            </p>
            <div className="pick">
              <div className="card mine">
                <h3>New to Japanese?</h3>
                <p>
                  Install AnimeVocab, keep your English subs on, and learn one word per line starting tonight.
                  No kana required. Full free path:{" "}
                  <Link href="/learn-japanese-with-anime-free">learn Japanese with anime free</Link>.
                </p>
              </div>
              <div className="card">
                <h3>Already reading?</h3>
                <p>
                  Pair a mining tool (Migaku or asbplayer) with Japanese subs from Jimaku, and let Anki handle
                  review.
                </p>
              </div>
            </div>

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
            <h2>Your next episode can teach you a word.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/learn-japanese-with-anime-free", label: "Free guide" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/blog/how-to-learn-japanese-watching-anime-2026", label: "How-to method" },
          { href: "/blog/best-apps-learn-japanese-anime-2026", label: "Best apps 2026" },
          { href: "/blog", label: "Blog" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/best-anime-to-learn-japanese", label: "Best anime" },
          { href: "/vs-animelon", label: "vs Animelon" },
          { href: "/animelon-alternative", label: "Animelon alt" },
          { href: "/vs-lingoku", label: "vs Lingoku" },
          { href: "/vs-yumego", label: "vs YumeGo" },
          { href: "/vs-lexirise", label: "vs Lexirise" },
          { href: "/vs-asbplayer", label: "vs asbplayer" },
          { href: "/asbplayer-alternative", label: "asbplayer alt" },
          { href: "/vs-wordy", label: "vs Wordy" },
          { href: "/vs-manabidojo", label: "vs ManabiDojo" },
          { href: "/manabidojo-alternative", label: "ManabiDojo alt" },
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: "/language-reactor-alternative", label: "LR alt" },
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: "/migaku-free-alternative", label: "Migaku free alt" },
          { href: "/lingopie-alternative", label: "Lingopie alt" },
          { href: "/rikaikun-alternative", label: "Rikaikun alt" },
          { href: "/japanese-subtitles-anime", label: "JP subs hub" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
