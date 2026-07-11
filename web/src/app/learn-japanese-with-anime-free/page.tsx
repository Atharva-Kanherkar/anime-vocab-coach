import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/learn-japanese-with-anime-free";

export const metadata: Metadata = {
  title: "Learn Japanese with Anime Free (2026) — Tools, Anki & Beginner Shows",
  description:
    "Learn Japanese with anime free: Language Reactor, asbplayer + Yomitan, Lexirise, Animelon — plus AnimeVocab for romaji + Crunchyroll without Anki. Beginner show list included.",
  keywords: [
    "learn japanese with anime free",
    "learn japanese with anime free online",
    "learn japanese with anime free app",
    "learn japanese with anime free reddit",
    "learn japanese anime free",
    "free japanese learning anime",
    "best free way to learn japanese from anime",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Learn Japanese with Anime Free (2026)",
    description:
      "Free extensions and sites for anime immersion — and the beginner path that skips Anki night.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese with Anime Free",
    description: "Free tool stack + beginner anime list. AnimeVocab for romaji + Crunchyroll.",
  },
};

const faqs = [
  {
    question: "Can I learn Japanese with anime for free?",
    answer:
      "Yes. Pair free tools with shows you already watch: Language Reactor on Netflix/YouTube, asbplayer + Yomitan + Anki for mining, Lexirise or Animelon for subtitle click-lookups, or AnimeVocab for romaji-first cards and Crunchyroll Listening Mode with built-in SRS — no credit card for the core loop.",
  },
  {
    question: "What is the best free way to learn Japanese from anime?",
    answer:
      "If you can read kana and have Japanese subtitles: Language Reactor or asbplayer + Yomitan. If you are an absolute beginner or watch Crunchyroll without JP subs: AnimeVocab. Always pick slice-of-life shows first (Shirokuma Cafe, Ghibli, Yuru Camp).",
  },
  {
    question: "Do I need Anki to learn Japanese from anime for free?",
    answer:
      "Anki is free and excellent for long-term memory, but not required on day one. AnimeVocab includes built-in spaced repetition so beginners can skip Anki setup. Advanced learners still export or mine into Anki later.",
  },
  {
    question: "What free Chrome extension learns Japanese from anime?",
    answer:
      "Language Reactor (Netflix/YouTube), asbplayer (mining), Lexirise (Crunchyroll readers), and AnimeVocab (romaji + Listening Mode). See the free Japanese anime extension hub for AnimeVocab specifically.",
  },
  {
    question: "What beginner anime should I watch to learn Japanese free?",
    answer:
      "Shirokuma Cafe (Polar Bear Cafe), Studio Ghibli films like My Neighbor Totoro, and slice-of-life shows like Yuru Camp. Avoid starting with Attack on Titan or Jujutsu Kaisen — too much slang and shouting for month zero.",
  },
  {
    question: "Is Animelon still a good free option?",
    answer:
      "Animelon is a free site with interactive Japanese subtitles on a limited catalog. Useful for click-lookups. It is not a replacement for Crunchyroll simulcasts — combine it with a streaming extension for shows you already watch.",
  },
];

export default function LearnJapaneseWithAnimeFreePage() {
  const faqLd = faqJsonLd(faqs);
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to learn Japanese with anime for free",
    description:
      "Turn anime watching into free Japanese study with the right free tools and beginner shows.",
    totalTime: "PT15M",
    step: [
      {
        "@type": "HowToStep",
        name: "Pick a beginner-friendly show",
        text: "Start with Shirokuma Cafe, Ghibli, or Yuru Camp — clear everyday Japanese.",
        url: `${SITE_URL}/best-anime-to-learn-japanese`,
      },
      {
        "@type": "HowToStep",
        name: "Install a free tool that matches your level",
        text: "Language Reactor or asbplayer + Yomitan if you can read JP subs; AnimeVocab if you need romaji or Crunchyroll audio.",
        url: `${SITE_URL}/free-japanese-anime-extension`,
      },
      {
        "@type": "HowToStep",
        name: "Capture and review words",
        text: "Save a few words per episode and review with Anki or a built-in SRS the next day.",
      },
    ],
  };

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese with Anime Free (2026) — Tools, Anki & Beginner Shows"
        description="Learn Japanese with anime free using Language Reactor, asbplayer + Yomitan, Lexirise, Animelon, and AnimeVocab — plus beginner show picks."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Learn with anime" },
            { label: "Free" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Learn Japanese with anime free (2026)"
          lede={
            <>
              Yes — you can <strong>learn Japanese with anime free</strong>. Google’s usual answer is Language
              Reactor, asbplayer + Yomitan, Lexirise, and Animelon. That list is real. It also skips the
              beginner who cannot read kana yet and watches <strong>Crunchyroll without Japanese
              subtitles</strong>. That gap is <strong>AnimeVocab</strong> — free romaji-first cards + built-in
              SRS.
            </>
          }
          verdictTag="Free stack in one line"
          verdict={
            <>
              <strong>Can read JP subs:</strong> Language Reactor or asbplayer + Yomitan + Anki.{" "}
              <strong>Crunchyroll reader:</strong> Lexirise.{" "}
              <strong>Month-zero / no JP track:</strong>{" "}
              <Link href="/free-japanese-anime-extension">AnimeVocab free extension</Link>. Shows:{" "}
              <Link href="/best-anime-to-learn-japanese">best beginner anime</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>1. Free learning platforms and extensions</h2>
            <p>
              These are the free (or freemium) tools AI overviews and Reddit recommend — with an honest note on
              who each is for.
            </p>
            <ul>
              <li>
                <strong>Language Reactor</strong> — free Chrome dual subs + lookups on Netflix and YouTube.
                Needs readable Japanese text.{" "}
                <Link href="/vs-language-reactor">vs Language Reactor</Link>
              </li>
              <li>
                <strong>asbplayer + Yomitan</strong> — completely free power-user stack. Overlay/mine
                subtitles, hover dictionary, send cards to Anki. Setup-heavy.{" "}
                <Link href="/vs-asbplayer">vs asbplayer</Link> ·{" "}
                <Link href="/blog/yomitan-anime-alternative-video-immersion-2026">Yomitan for anime</Link>
              </li>
              <li>
                <strong>Lexirise</strong> — free-tier mining/lookups on Crunchyroll and more for readers who
                can click Japanese text.{" "}
                <Link href="/vs-lexirise">vs Lexirise</Link>
              </li>
              <li>
                <strong>Animelon</strong> — free site with interactive JP subs on a limited anime catalog.
                Good practice box; not your full Crunchyroll library.{" "}
                <Link href="/vs-animelon">vs Animelon</Link>
              </li>
              <li>
                <strong>AnimeVocab</strong> — free forever for romaji-first cards + local SRS on Crunchyroll,
                Netflix, and YouTube. Listening Mode works when JP subtitle text is missing. No Anki required
                to start. Price: {TIERS.free.priceLabel} core.
              </li>
            </ul>

            <h2>Free tools compared</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Free?</th>
                    <th scope="col">Best for</th>
                    <th scope="col">Crunchyroll</th>
                    <th scope="col">Needs JP reading?</th>
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
                    <td>Beginners · romaji · SRS</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Language Reactor</td>
                    <td>Freemium</td>
                    <td>Netflix/YouTube dual subs</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>asbplayer + Yomitan</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Anki mining</td>
                    <td>With fan .srt</td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>Lexirise</td>
                    <td>Freemium</td>
                    <td>CR readers · mining</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Yes</td>
                  </tr>
                  <tr>
                    <td>Animelon</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Limited catalog practice</td>
                    <td>Own site</td>
                    <td>Helps to have some</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>2. Connect learning to flashcards (Anki or built-in SRS)</h2>
            <p>
              Looking words up once does not stick. Free spaced repetition options:
            </p>
            <ul>
              <li>
                <strong>Anki</strong> — free, industry default. Export from asbplayer / Lexirise / many
                miners. Guide: <Link href="/blog/anki-anime-beginners-2026">Anki for anime beginners</Link>.
              </li>
              <li>
                <strong>AnimeVocab built-in SRS</strong> — free local reviews without AnkiConnect. Start here
                if templates scare you; graduate to Anki later.
              </li>
            </ul>

            <h2>3. Best beginner anime for free immersion</h2>
            <p>
              Match the AI Overview picks — clear, everyday Japanese — not shonen combat slang:
            </p>
            <ul>
              <li>
                <strong>Shirokuma Cafe (Polar Bear Cafe)</strong> — slow, casual phrases
              </li>
              <li>
                <strong>Studio Ghibli</strong> (e.g. Totoro, Arrietty) — clear pronunciation, visual context
              </li>
              <li>
                <strong>Yuru Camp / Laid-Back Camp</strong> — slice-of-life daily talk
              </li>
            </ul>
            <p>
              Full ranked list: <Link href="/best-anime-to-learn-japanese">best anime to learn Japanese</Link>
              . Shonen like AoT/JJK wait until later.
            </p>

            <h2>How to start tonight (15 minutes)</h2>
            <ol>
              <li>
                Open a beginner show on Crunchyroll or Netflix.
              </li>
              <li>
                Install{" "}
                <a href={installUrl()} rel="noopener noreferrer">
                  AnimeVocab free
                </a>{" "}
                (or Language Reactor if you already read JP on Netflix).
              </li>
              <li>Save 3–5 words. Review tomorrow.</li>
            </ol>
            <p>
              Deeper ranking: <Link href="/learn-japanese-with-anime">how to learn Japanese with anime</Link>
              . Free extension hub:{" "}
              <Link href="/free-japanese-anime-extension">free Japanese anime extension</Link>. Crunchyroll:{" "}
              <Link href="/learn-japanese-crunchyroll">learn Japanese on Crunchyroll</Link>.
            </p>

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
            <h2>Learn Japanese with anime — free, starting now.</h2>
            <p style={{ color: "var(--ink-2)", marginBottom: 18 }}>
              Romaji-first cards + SRS. Works on Crunchyroll when JP subs are missing.
            </p>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/learn-japanese-with-anime", label: "Full tool ranking" },
          { href: "/best-anime-to-learn-japanese", label: "Best beginner anime" },
          { href: "/migaku-free-alternative", label: "Migaku free alt" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
