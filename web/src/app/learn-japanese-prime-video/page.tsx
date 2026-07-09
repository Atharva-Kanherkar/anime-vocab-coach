import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/learn-japanese-prime-video";

export const metadata: Metadata = {
  title: "Learn Japanese on Prime Video Anime (2026): Tools & Workflow",
  description:
    "Learn Japanese on Amazon Prime Video anime — subtitle reality, Lexirise support, dual-sub options, and when romaji-first tools beat mining stacks.",
  keywords: [
    "learn japanese prime video",
    "amazon prime japanese anime",
    "prime video japanese subtitles",
    "lexirise prime video",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Learn Japanese on Prime Video Anime (2026)",
    description: "Prime Video anime Japanese learning — tools that work and beginner paths.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese on Prime Video Anime",
    description: "Subtitles, Lexirise, and beginner workflows for Prime Video anime.",
  },
};

const faqs = [
  {
    question: "Can I learn Japanese on Amazon Prime Video anime?",
    answer:
      "Yes if the title has Japanese audio and you have a vocabulary loop. Japanese subtitle availability varies by title and region — always check the subtitle menu.",
  },
  {
    question: "Which extension works on Prime Video for Japanese?",
    answer:
      "Lexirise lists Prime Video among supported platforms for click-to-translate when Japanese text is on screen. AnimeVocab focuses on Crunchyroll, Netflix, and YouTube for romaji-first beginners.",
  },
];

export default function LearnJapanesePrimeVideoPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Learn Japanese on Prime Video Anime (2026): Tools & Workflow"
        description="Learn Japanese on Amazon Prime Video anime — subtitle reality, Lexirise support, dual-sub options, and when romaji-first tools beat mining stacks."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Prime Video" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Learn Japanese on Prime Video anime"
          lede={
            <>
              Amazon <strong>Prime Video</strong> carries anime catalogs that differ by country. Some titles
              include Japanese audio and Japanese subtitles; others are English-only. Tooling is thinner than
              Netflix — plan around <strong>what the player actually exposes</strong>.
            </>
          }
          verdictTag="Practical pick"
          verdict={
            <>
              If Japanese subtitle text is on screen and you can read it, try{" "}
              <Link href="/vs-lexirise">Lexirise</Link>. If you are month-zero or live on Crunchyroll
              simulcasts, start with{" "}
              <Link href="/free-japanese-anime-extension">AnimeVocab</Link> and treat Prime as secondary
              immersion.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Platform reality check</h2>
            <ul>
              <li>
                <strong>Confirm Japanese audio + JP subs</strong> before installing a reader stack.
              </li>
              <li>
                <strong>Lexirise</strong> markets Prime Video support for click-to-translate mining.
              </li>
              <li>
                <strong>Migaku / Language Reactor</strong> are Netflix/YouTube-first — do not assume Prime
                parity.
              </li>
              <li>
                <strong>Fan-sub overlays</strong> (Substital) can work on some players but break often — see{" "}
                <Link href="/blog/substital-crunchyroll-japanese-subtitles-2026">Substital guide</Link>.
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
              Compare platforms: <Link href="/learn-japanese-crunchyroll">Crunchyroll</Link>,{" "}
              <Link href="/learn-japanese-netflix-anime">Netflix</Link>,{" "}
              <Link href="/learn-japanese-disney-plus">Disney+</Link>,{" "}
              <Link href="/learn-japanese-hidive">HIDIVE</Link>,{" "}
              <Link href="/learn-japanese-hulu">Hulu</Link>,{" "}
              <Link href="/blog/best-apps-learn-japanese-anime-2026">best apps 2026</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Start where you actually watch.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/vs-lexirise", label: "vs Lexirise" },
          { href: "/learn-japanese-disney-plus", label: "Disney+" },
          { href: "/learn-japanese-netflix-anime", label: "Netflix" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
