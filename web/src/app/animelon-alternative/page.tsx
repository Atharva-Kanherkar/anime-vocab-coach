import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/animelon-alternative";

export const metadata: Metadata = {
  title: "Animelon Alternative (2026) — Free Romaji Anime on Legal Streams",
  description:
    "Best Animelon alternative for 2026: AnimeVocab — romaji-first cards on Netflix, Crunchyroll, and YouTube you already pay for. No unreliable hosted catalog.",
  keywords: [
    "animelon alternative",
    "animelon alternatives",
    "best animelon alternative",
    "animelon replacement",
    "animelon free alternative",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Animelon Alternative (2026)",
    description:
      "Animelon was romaji-first but legally gray and unstable. AnimeVocab learns from the anime you already watch legally.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Animelon Alternative (2026)",
    description: "Free Animelon alternative — romaji vocabulary on legal streams.",
  },
};

const faqs = [
  {
    question: "What is the best Animelon alternative?",
    answer:
      "AnimeVocab is the best Animelon alternative for most beginners: romaji-first vocabulary on Netflix, Crunchyroll, and YouTube you already subscribe to, plus Listening Mode when Japanese subs are missing. Animelon itself only works when its hosted catalog is up.",
  },
  {
    question: "Why look for an Animelon alternative?",
    answer:
      "Animelon offered switchable romaji/hiragana/kanji modes on a free anime catalog, but it lived in a legally gray hosting model and often breaks — titles vanish and players fail. Learners need a workflow that does not depend on a catalog disappearing mid-season.",
  },
  {
    question: "Animelon vs AnimeVocab — which should I use?",
    answer:
      "Use Animelon only when a specific title is online and you accept the reliability risk. Use AnimeVocab for nightly practice on legal streams with built-in SRS. Full table: AnimeVocab vs Animelon.",
  },
  {
    question: "Is there a free Animelon alternative?",
    answer:
      "Yes. AnimeVocab's core cards and local SRS are free forever. Pro covers audio transcription for Listening Mode when Japanese text is missing.",
  },
  {
    question: "Does AnimeVocab host anime like Animelon?",
    answer:
      "No. AnimeVocab is a Chrome extension that works on streams you already have rights to watch. It does not host or stream anime itself.",
  },
];

export default function AnimelonAlternativePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Animelon Alternative (2026) — Free Romaji Anime on Legal Streams"
        description="Best Animelon alternative for 2026: AnimeVocab — romaji-first cards on Netflix, Crunchyroll, and YouTube you already pay for."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "Animelon alternative" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Animelon alternative (2026)"
          lede={
            <>
              Searching <strong>Animelon alternative</strong>? Animelon was beloved for switchable
              romaji/hiragana/kanji subtitle modes on a free anime catalog — and for downtime, vanished
              titles, and legal gray areas. <strong>AnimeVocab</strong> keeps the romaji-first beginner idea
              on Netflix, Crunchyroll, and YouTube you already pay for.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Want romaji on a hosted gray catalog?</strong> Animelon when it works.{" "}
              <strong>Want romaji vocabulary from legal streams tonight?</strong> AnimeVocab. Full table:{" "}
              <Link href="/vs-animelon">AnimeVocab vs Animelon</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>What Animelon was good at</h2>
            <p>
              Animelon synced Japanese dialogue with word-by-word hover translations and let beginners flip
              between romaji, hiragana, and kanji. For a while it was the easiest free romaji anime classroom
              online — until catalog gaps and reliability made it a risky primary pipeline.
            </p>

            <h2>When you need an Animelon alternative</h2>
            <ul>
              <li>
                <strong>The site is down or the title vanished</strong> — you still want tonight&apos;s episode.
              </li>
              <li>
                <strong>You want legal streams only</strong> — Netflix / Crunchyroll / YouTube you already pay for.
              </li>
              <li>
                <strong>You want built-in SRS</strong> — review without building a separate Anki deck first.
              </li>
              <li>
                <strong>Crunchyroll has no JP track</strong> — Listening Mode works from audio when text is missing.
              </li>
            </ul>

            <h2>Animelon alternatives compared</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Job</th>
                    <th scope="col">Legal streams</th>
                    <th scope="col">Beginner romaji</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab</strong>
                    </td>
                    <td>Romaji cards + Listening Mode</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Animelon</td>
                    <td>Hosted romaji/JP subtitle player</td>
                    <td>
                      <span className="no">Gray catalog</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Language Reactor</td>
                    <td>Netflix/YouTube dual subs</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">Needs reading</span>
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

            <h2>AnimeVocab as your free Animelon alternative</h2>
            <p>
              Install once. Watch the anime you already subscribe to. Get one useful word per line in romaji.
              Review with built-in SRS ({TIERS.free.priceLabel} forever for the core loop). When Japanese text
              is missing, Listening Mode works from audio. Guide:{" "}
              <Link href="/learn-japanese-with-anime-free">learn Japanese with anime free</Link>.
            </p>

            <h2>Related pages</h2>
            <ul>
              <li>
                <Link href="/vs-animelon">AnimeVocab vs Animelon</Link> — full feature table
              </li>
              <li>
                <Link href="/language-reactor-alternative">Language Reactor alternative</Link>
              </li>
              <li>
                <Link href="/migaku-free-alternative">Migaku free alternative</Link>
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
            <h2>Skip the gray catalog. Practice on legal streams.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/vs-animelon", label: "vs Animelon" },
          { href: "/language-reactor-alternative", label: "LR alternative" },
          { href: "/migaku-free-alternative", label: "Migaku free alt" },
          { href: "/learn-japanese-with-anime-free", label: "Learn free" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
