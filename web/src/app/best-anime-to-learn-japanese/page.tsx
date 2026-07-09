import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/best-anime-to-learn-japanese";

const faqs = [
  {
    question: "What is the best anime to learn Japanese for beginners?",
    answer:
      "Shirokuma Cafe (Polar Bear Cafe) is the most recommended beginner show — slow dialogue and everyday vocabulary. Non Non Biyori and Doraemon are strong alternatives.",
  },
  {
    question: "Can I learn Japanese from Attack on Titan or Jujutsu Kaisen?",
    answer:
      "Later, yes. As a first textbook, no — slang, shouting, and fantasy terms make listening practice harder than slice-of-life shows.",
  },
  {
    question: "Do I need Japanese subtitles to learn from anime?",
    answer:
      "Not at month zero. Romaji-first tools and Listening Mode work from audio when Japanese subtitle tracks are missing, which is common on Crunchyroll.",
  },
];


export const metadata: Metadata = {
  title: "Best Anime to Learn Japanese (2026): Beginner Rankings",
  description:
    "Best anime to learn Japanese for beginners — Shirokuma Cafe, Non Non Biyori, Doraemon, and shows to avoid. Ranked for slow dialogue and everyday vocabulary.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Best Anime to Learn Japanese for Beginners (2026)",
    description: "Ranked beginner anime for Japanese listening practice — slice-of-life picks and shonen to skip.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Best Anime to Learn Japanese (2026)",
    description: "Beginner-ranked anime for Japanese vocabulary and listening — plus study workflow.",
  },
};

export default function BestAnimePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Best Anime to Learn Japanese (2026): Beginner Rankings"
        description="Best anime to learn Japanese for beginners — Shirokuma Cafe, Non Non Biyori, Doraemon, and shows to avoid. Ranked for slow dialogue and everyday vocabulary."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/blog", label: "Blog" },
            { label: "Best anime" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Best anime to learn Japanese"
          lede={
            <>
              The <strong>best anime to learn Japanese</strong> is not your favorite shonen — it is the show
              with slow, clear, everyday speech you will rewatch. This page ranks beginner-friendly titles
              the immersion community actually recommends, plus a short list of shows to save for later.
            </>
          }
          verdictTag="Tier 1 picks"
          verdict={
            <>
              Start with <strong>Shirokuma Cafe</strong>, <strong>Non Non Biyori</strong>, or{" "}
              <strong>Doraemon</strong>. Pair any of them with one-word-per-episode capture and daily review —
              not passive English-sub bingeing.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Tier 1 — start here</h2>
            <ul>
              <li>
                <strong>Shirokuma Cafe</strong> — slow dialogue, daily-life vocabulary, community favorite on
                r/LearnJapanese. Deep dive:{" "}
                <Link href="/blog/shirokuma-cafe-learn-japanese-2026">Shirokuma Cafe study guide</Link>.
              </li>
              <li>
                <strong>Non Non Biyori</strong> — rural slice-of-life, long pauses, perfect for shadowing.{" "}
                <Link href="/blog/non-non-biyori-learn-japanese-2026">Study guide →</Link>
              </li>
              <li>
                <strong>Doraemon / Sazae-san</strong> — repetitive family Japanese; classic beginner immersion
                picks. <Link href="/blog/doraemon-learn-japanese-2026">Doraemon</Link> ·{" "}
                <Link href="/blog/sazae-san-learn-japanese-2026">Sazae-san study guide →</Link>
              </li>
            </ul>

            <h2>Tier 2 — after a month</h2>
            <ul>
              <li>
                <strong>K-On!</strong> — school speech and music vocab; still mostly standard Japanese.{" "}
                <Link href="/blog/k-on-learn-japanese-2026">K-On! study guide →</Link>
              </li>
              <li>
                <strong>Chiikawa</strong> — tiny episodes, low stress, great for daily streaks.{" "}
                <Link href="/blog/chiikawa-learn-japanese-2026">Chiikawa study guide →</Link>
              </li>
              <li>
                <strong>Spy x Family</strong> — mine family/school talk, skip dense spy jargon at first.{" "}
                <Link href="/blog/spy-x-family-learn-japanese-2026">Spy x Family guide →</Link>
              </li>
              <li>
                <strong>Horimiya</strong> — school romance with reusable everyday lines.{" "}
                <Link href="/blog/horimiya-learn-japanese-2026">Horimiya guide →</Link>
              </li>
              <li>
                <strong>Pokémon</strong> — repetitive, kid-clear speech if you ignore creature-name dumps.{" "}
                <Link href="/blog/pokemon-learn-japanese-beginners-2026">Pokémon guide →</Link>
              </li>
              <li>
                <strong>Kaguya-sama</strong> — advanced comedy speed; mine short lines only.{" "}
                <Link href="/blog/kaguya-sama-learn-japanese-2026">Kaguya guide →</Link>
              </li>
              <li>
                <strong>Laid-Back Camp / Yuru Camp</strong> — calm pacing for anxious beginners.{" "}
                <Link href="/blog/laid-back-camp-learn-japanese-2026">Yuru Camp guide →</Link>
              </li>
              <li>
                <strong>Bocchi the Rock!</strong> — mine school/friend talk, not every band term.{" "}
                <Link href="/blog/bocchi-the-rock-learn-japanese-2026">Bocchi guide →</Link>
              </li>
              <li>
                <strong>Barakamon</strong> — warm comedy; watch dialect carefully.{" "}
                <Link href="/blog/barakamon-learn-japanese-2026">Barakamon guide →</Link>
              </li>
              <li>
                <strong>Studio Ghibli films</strong> — short runtime, emotional lines worth replaying in
                clip-based study.{" "}
                <Link href="/blog/ghibli-movies-learn-japanese-2026">Ghibli study guide →</Link>
              </li>
            </ul>

            <h2>Save for later</h2>
            <ul>
              <li>
                <strong>Natsume / Mushishi</strong> — calm fantasy; Natsume first, Mushishi when ready.{" "}
                <Link href="/blog/natsume-yuujinchou-learn-japanese-2026">Natsume</Link> ·{" "}
                <Link href="/blog/mushishi-learn-japanese-2026">Mushishi →</Link>
              </li>
              <li>
                <strong>Frieren</strong> — beautiful pacing; better once basics stick.{" "}
                <Link href="/blog/frieren-learn-japanese-2026">Honest Frieren take →</Link>
              </li>
              <li>
                <strong>Haikyuu!! / Vinland Saga (farm arc)</strong> — mine human talk, not sports/war noise.{" "}
                <Link href="/blog/haikyuu-learn-japanese-2026">Haikyuu</Link> ·{" "}
                <Link href="/blog/vinland-saga-learn-japanese-2026">Vinland →</Link>
              </li>
              <li>
                <strong>Attack on Titan, Jujutsu Kaisen, Demon Slayer, Chainsaw Man</strong> — great shows,
                bad first textbooks (slang, shouting, fantasy terms).{" "}
                <Link href="/blog/attack-on-titan-learn-japanese-beginners-2026">AOT</Link> ·{" "}
                <Link href="/blog/jujutsu-kaisen-learn-japanese-2026">JJK</Link> ·{" "}
                <Link href="/blog/demon-slayer-learn-japanese-beginners-2026">Demon Slayer</Link> ·{" "}
                <Link href="/blog/chainsaw-man-learn-japanese-2026">Chainsaw Man →</Link>
              </li>
              <li>
                <strong>Heavy dialect comedy</strong> — fun once you hear standard Tokyo pitch reliably.
              </li>
            </ul>

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

            <p>
              Full write-up with ranking criteria:{" "}
              <Link href="/blog/best-anime-to-learn-japanese-beginners">
                Best anime to learn Japanese for beginners (2026 ranked)
              </Link>
              . Workflow: <Link href="/blog/one-word-per-episode-method">one word per episode</Link>,{" "}
              <Link href="/anime-spaced-repetition">spaced repetition</Link>,{" "}
              <Link href="/free-japanese-anime-extension">free extension</Link>, tools on{" "}
              <Link href="/learn-japanese-crunchyroll">Crunchyroll</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Pick a show. Learn one word tonight.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Install AnimeVocab (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/shirokuma-cafe-learn-japanese-2026", label: "Shirokuma Cafe guide" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/learn-japanese-with-anime", label: "Compare tools" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
