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
    "Write unofficial fan endings for One Piece, Demon Slayer, Jujutsu Kaisen, and more. Pick a finale, get a free fan-art manga chapter — no drawing skills.",
  keywords: [
    "fan ending manga",
    "choose your ending manga",
    "ai fan manga",
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
      "Unofficial fan endings for famous manga. Pick a series, choose a finale, generate a free fan-art chapter.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Fan Ending Manga — AnimeVocab",
    description:
      "How would YOU end it? Free fan-art epilogues for famous manga — on your phone.",
  },
};

const faqs = [
  {
    question: "What is a fan ending manga?",
    answer:
      "A fan ending is an unofficial epilogue or alternate finale created by fans — the same energy as doujinshi and fandom finales. AnimeVocab lets you pick a series, choose a creative ending path, and generate a short fan-art manga chapter in your browser.",
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
      "Yes. You can invent endings and draft a chapter without an account. Anonymous users get limited daily generations; signing in (free) saves drafts and unlocks publishing to the gallery.",
  },
  {
    question: "How is this different from an AI fanfic generator?",
    answer:
      "Text fanfic tools return prose. AnimeVocab returns a paneled manga chapter with cast, dialogue bubbles, and art you can edit in Manga Studio — then share a link friends can open on any phone.",
  },
  {
    question: "Can I use this to learn Japanese?",
    answer:
      "Yes as output practice. After you draft a fan ending, edit dialogue in Studio and optionally weave target vocabulary. Pair it with the free Chrome extension for input from anime you already watch.",
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
  // Point ItemList URLs at the marketing hub's related product routes via /end
  const faqLd = faqJsonLd(faqs);
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to create a fan ending manga chapter",
    description:
      "Pick a famous manga, choose a fan ending, and generate a free fan-art epilogue chapter.",
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
        name: "Generate and edit",
        text: "Get a draft chapter, edit dialogue in Manga Studio, then share or publish to the gallery.",
        url: `${SITE_URL}/studio`,
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
            { href: "/studio", label: "Manga Studio" },
            { label: "Fan ending manga" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Fan ending manga — choose your ending with AI"
          lede={
            <>
              Famous series end. Fans keep going. <strong>AnimeVocab fan endings</strong> let you pick One
              Piece, Demon Slayer, Jujutsu Kaisen, and more — choose a creative finale — and get a free{" "}
              <strong>fan-art manga chapter</strong> in seconds. Unofficial. On your phone. No drawing tablet.
            </>
          }
          verdictTag="Fandom creative play"
          verdict={
            <>
              Same energy as doujinshi and fandom finales — not an official release. Match the characters, pick
              your ending, share the chapter. Then open{" "}
              <Link href="/studio">Manga Studio</Link> to edit panels, or type{" "}
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
                <strong>Generate the chapter</strong> — AI drafts cast, panels, and dialogue as a fan-art
                epilogue. Edit in Studio; publish to the <Link href="/gallery">gallery</Link> if you want.
              </li>
            </ol>

            <h2>Series you can end (fan art)</h2>
            <ul>
              {catalog
                .filter((m) => m.id !== "lantern-of-words")
                .map((m) => (
                  <li key={m.id}>
                    <Link href={`/end/${m.id}`}>
                      {m.title}
                    </Link>
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
                <strong>First win under a minute</strong> — pick ending → chapter draft, no signup required for
                the first try.
              </li>
              <li>
                <strong>Shareable identity</strong> — publish a link friends open on any phone.
              </li>
              <li>
                <strong>Editable manga, not locked pixels</strong> — dialogue lives in bubbles you can rewrite
                in Studio (same stack as the free AI manga maker).
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
              <Link href="/blog/fan-ending-manga-ai-generator-2026">fan ending AI deep dive</Link>,{" "}
              <Link href="/blog/one-piece-fan-ending-ai-manga-2026">One Piece fan ending</Link>,{" "}
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
          { href: "/end/custom", label: "Any title" },
          { href: "/studio", label: "Studio" },
          { href: "/ai-manga-maker", label: "AI manga maker" },
          { href: "/gallery", label: "Gallery" },
          { href: "/blog", label: "Blog" },
        ]}
      />
    </>
  );
}
