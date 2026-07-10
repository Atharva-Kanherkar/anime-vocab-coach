import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listEndingCatalog } from "@/lib/ending-hooks";
import { SITE_URL } from "@/lib/site";
import {
  defaultOpenGraph,
  defaultTwitter,
  endingCatalogJsonLd,
  faqJsonLd,
} from "@/lib/seo";

const path = "/fan-ending-manga";

export const metadata: Metadata = {
  title: "Fan Ending Manga — Choose Your Ending with AI (2026)",
  description:
    "Write unofficial fan endings for One Piece, Demon Slayer, Jujutsu Kaisen, and more. Pick a finale and watch a free 5-panel fan-art manga draw itself — on your phone.",
  keywords: [
    "fan ending manga",
    "choose your ending manga",
    "ai fan manga",
    "ai manga ending",
    "ai doujinshi generator",
    "fan art manga generator",
    "one piece fan ending",
    "demon slayer fan ending",
    "create fan ending online",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Fan Ending Manga — Choose Your Ending with AI",
    description:
      "Unofficial fan endings for famous manga. Pick a series, choose a finale, watch a 5-panel fan-art chapter draw itself.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Fan Ending Manga — AnimeVocab",
    description:
      "How would YOU end it? Free 5-panel fan-art epilogues for famous manga — on your phone.",
  },
};

const faqs = [
  {
    question: "What is a fan ending manga?",
    answer:
      "A fan ending is an unofficial epilogue or alternate finale created by fans — the same energy as doujinshi and fandom finales. AnimeVocab lets you pick a series, choose a creative ending path, and watch a 5-panel fan-art manga draw itself in your browser.",
  },
  {
    question: "Is this official or affiliated with the publishers?",
    answer:
      "No. Every ending is framed as unofficial fan art / fan ending for creative play. It is not affiliated with the original publishers or creators.",
  },
  {
    question: "Which series can I write a fan ending for?",
    answer:
      "The catalog includes One Piece, Naruto, Demon Slayer, Jujutsu Kaisen, Attack on Titan, Spy x Family, Frieren, Chainsaw Man, Death Note, Haikyuu, Bleach, and more. You can also type any manga title on the custom ending page.",
  },
  {
    question: "Is the fan ending generator free?",
    answer:
      "Yes — your first fan ending is free. Pick a finale and watch five panels draw on the page. No drawing tablet required.",
  },
  {
    question: "How is this different from an AI fanfic generator?",
    answer:
      "Text fanfic tools return prose. AnimeVocab returns a paneled fan-art manga with dialogue lettered into the art — then a shareable link friends can open on any phone.",
  },
  {
    question: "How is this different from a blank AI manga maker?",
    answer:
      "Blank AI manga makers start from an original premise. Fan endings start from a series you already love — choose-your-ending hooks, then a 5-panel epilogue. For blank stories use Manga Studio.",
  },
];

export default function FanEndingMangaPage() {
  const catalog = listEndingCatalog();
  const collectionLd = endingCatalogJsonLd(
    catalog.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.cliffhanger,
    }))
  );
  const faqLd = faqJsonLd(faqs);
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to create a fan ending manga with AI",
    description:
      "Pick a famous manga, choose a fan ending, and watch a free 5-panel fan-art epilogue draw itself.",
    totalTime: "PT2M",
    step: [
      {
        "@type": "HowToStep",
        name: "Pick a series",
        text: "Open the endings catalog and choose a manga, or type any title on the custom page.",
        url: `${SITE_URL}/end`,
      },
      {
        "@type": "HowToStep",
        name: "Choose your ending",
        text: "Select one of three fan finales (or invent options for a custom title) and optionally add a one-sentence twist.",
      },
      {
        "@type": "HowToStep",
        name: "Watch it draw",
        text: "AI writes the script and draws five fan-art panels with dialogue on the page. Share the link when it finishes.",
        url: `${SITE_URL}/end`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/end", label: "Endings" },
            { label: "Fan ending manga" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Fan ending manga — choose your ending with AI"
          lede={
            <>
              Famous series end. Fans keep going. <strong>AnimeVocab fan endings</strong> let you pick One
              Piece, Demon Slayer, Jujutsu Kaisen, and more — choose a creative finale — and{" "}
              <strong>watch a 5-panel fan-art manga draw itself</strong>. Unofficial. On your phone. No drawing
              tablet.
            </>
          }
          verdictTag="Fandom creative play"
          verdict={
            <>
              Same energy as doujinshi and fandom finales — not an official release. Match the characters, pick
              your ending, share the chapter. Generator deep dive:{" "}
              <Link href="/ai-manga-ending-generator">AI manga ending generator</Link>. Or type{" "}
              <Link href="/end/custom">any manga title</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>How fan ending manga works</h2>
            <ol>
              <li>
                <strong>Browse the catalog</strong> — open{" "}
                <Link href="/end">choose your ending</Link> and tap a series you love.
              </li>
              <li>
                <strong>Pick a finale</strong> — three fan paths (heartfelt, comedic, bittersweet, and more).
                Add an optional one-sentence twist.
              </li>
              <li>
                <strong>Watch it draw</strong> — AI scripts five panels and draws fan-art pages with dialogue
                lettered in. Share the link when it finishes.
              </li>
            </ol>

            <h2>Series you can end (fan art)</h2>
            <ul>
              {catalog
                .filter((m) => m.id !== "lantern-of-words")
                .map((m) => (
                  <li key={m.id}>
                    <Link href={`/end/${m.id}`}>{m.title}</Link>
                    {" — "}
                    {m.cliffhanger}
                  </li>
                ))}
            </ul>
            <p>
              Missing your favorite?{" "}
              <Link href="/end/custom">Type any manga title</Link> and invent three fan endings on the fly.
            </p>

            <h2>Fan ending vs blank AI manga maker</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Need</th>
                    <th scope="col">Best start</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Instant hook for a series you already love</td>
                    <td>
                      <Link href="/end">Fan endings catalog</Link>
                    </td>
                  </tr>
                  <tr>
                    <td>Original story from a blank premise</td>
                    <td>
                      <Link href="/ai-manga-maker">AI manga maker</Link> →{" "}
                      <Link href="/studio">Studio</Link>
                    </td>
                  </tr>
                  <tr>
                    <td>Any title not in the catalog</td>
                    <td>
                      <Link href="/end/custom">Custom fan ending</Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>Why anime fans use this</h2>
            <ul>
              <li>
                <strong>First win under a minute</strong> — pick ending → watch panels draw, free first try.
              </li>
              <li>
                <strong>Shareable identity</strong> — a link friends open on any phone.
              </li>
              <li>
                <strong>Real manga panels</strong> — not just prose fanfic; dialogue is lettered into the art.
              </li>
            </ul>

            <h2>FAQ</h2>
            {faqs.map((f) => (
              <div key={f.question}>
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}

            <p>
              Also read:{" "}
              <Link href="/ai-manga-ending-generator">AI manga ending generator</Link>,{" "}
              <Link href="/blog/one-piece-fan-ending-ai-manga-2026">One Piece fan ending</Link>,{" "}
              <Link href="/blog/jujutsu-kaisen-fan-ending-manga-2026">Jujutsu Kaisen fan ending</Link>,{" "}
              <Link href="/blog/ai-doujinshi-generator-free-2026">AI doujinshi generator</Link>,{" "}
              <Link href="/ai-manga-maker">AI manga maker hub</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>How would YOU end it?</h2>
            <p style={{ color: "var(--ink-2)", marginBottom: 18 }}>
              Unofficial fan art. Free to try. Works on your phone.
            </p>
            <Link className="btn btn-accent" href="/end">
              Browse fan endings →
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/end", label: "Endings" },
          { href: "/ai-manga-ending-generator", label: "AI ending generator" },
          { href: "/end/custom", label: "Any title" },
          { href: "/studio", label: "Studio" },
          { href: "/ai-manga-maker", label: "AI manga maker" },
          { href: "/blog", label: "Blog" },
        ]}
      />
    </>
  );
}
