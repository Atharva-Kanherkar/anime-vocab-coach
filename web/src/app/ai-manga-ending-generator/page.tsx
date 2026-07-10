import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/ai-manga-ending-generator";

export const metadata: Metadata = {
  title: "AI Manga Ending Generator — Choose Your Ending Free (2026)",
  description:
    "Free AI manga ending generator: pick One Piece, Demon Slayer, JJK, or any title, choose a fan ending, and watch a 5-panel fan-art epilogue draw itself. Unofficial fan art.",
  keywords: [
    "ai manga ending generator",
    "ai manga ending",
    "manga ending generator",
    "ai epilogue manga",
    "choose your ending manga ai",
    "fan ending generator",
    "ai fan manga ending",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AI Manga Ending Generator — Free Fan Endings",
    description:
      "Choose your ending. Watch a 5-panel fan-art manga draw itself. Unofficial. Free first try.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AI Manga Ending Generator",
    description: "How would YOU end it? Free 5-panel fan-art epilogues — on your phone.",
  },
};

const faqs = [
  {
    question: "What is an AI manga ending generator?",
    answer:
      "It is a tool that turns a chosen fan ending into paneled manga art. AnimeVocab’s generator lets you pick a famous series (or type any title), choose one of three finales, and watch five fan-art panels draw with dialogue lettered in.",
  },
  {
    question: "Is the AI manga ending generator free?",
    answer:
      "Yes for your first ending. Open the catalog, pick a path, and generate without a credit card. Capacity resets daily.",
  },
  {
    question: "Is this official manga?",
    answer:
      "No. Output is unofficial fan art / fan endings for creative play — not affiliated with the original publishers.",
  },
  {
    question: "AI manga ending vs blank AI manga maker — what’s the difference?",
    answer:
      "An ending generator starts from a series cliffhanger and a choose-your-ending choice. A blank AI manga maker starts from your original premise in Manga Studio. Use endings for fandom hooks; Studio for OCs.",
  },
  {
    question: "Can I generate an ending for any manga?",
    answer:
      "Yes. Use a title in the catalog, or open the custom page, type any series name, and let AI invent three fan endings before drawing.",
  },
  {
    question: "How long does generation take?",
    answer:
      "Usually under a couple of minutes: script first, then five panels draw on the same page. Works on mobile.",
  },
];

export default function AiMangaEndingGeneratorPage() {
  const faqLd = faqJsonLd(faqs);
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to use the AI manga ending generator",
    description: "Generate a free 5-panel fan-art manga ending in your browser.",
    totalTime: "PT3M",
    step: [
      {
        "@type": "HowToStep",
        name: "Open the catalog",
        text: "Go to choose your ending and pick a series, or type any title.",
        url: `${SITE_URL}/end`,
      },
      {
        "@type": "HowToStep",
        name: "Choose a fan ending",
        text: "Pick one of three finales and optionally add a one-sentence twist.",
      },
      {
        "@type": "HowToStep",
        name: "Watch panels draw",
        text: "The AI writes dialogue and draws five fan-art panels. Share the finished chapter link.",
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/fan-ending-manga", label: "Fan endings" },
            { label: "AI manga ending generator" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AI manga ending generator — free choose-your-ending"
          lede={
            <>
              Searching <strong>AI manga ending generator</strong>? AnimeVocab turns a fan finale into a{" "}
              <strong>5-panel fan-art manga</strong> you watch draw on your phone — not a wall of prose, not a
              blank prompt box. Unofficial. First one free.
            </>
          }
          verdictTag="What you get"
          verdict={
            <>
              Pick One Piece, Demon Slayer, Jujutsu Kaisen, or{" "}
              <Link href="/end/custom">any title</Link> → choose an ending → panels draw with dialogue. Hub:{" "}
              <Link href="/fan-ending-manga">fan ending manga</Link>. Catalog: <Link href="/end">/end</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>How the AI manga ending generator works</h2>
            <ol>
              <li>
                <strong>Series</strong> — browse <Link href="/end">famous titles</Link> or type your own.
              </li>
              <li>
                <strong>Ending</strong> — three fan paths (heartfelt, comedic, bittersweet…).
              </li>
              <li>
                <strong>Draw</strong> — script + five panels with lettered dialogue on the same page.
              </li>
              <li>
                <strong>Share</strong> — send the chapter link; friends open it on any phone.
              </li>
            </ol>

            <h2>AI manga ending generator vs other tools (2026)</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool type</th>
                    <th scope="col">Output</th>
                    <th scope="col">Best for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab endings</strong>
                    </td>
                    <td>5-panel fan-art manga + choose-your-ending</td>
                    <td>Fandom finales for series you love</td>
                  </tr>
                  <tr>
                    <td>Blank AI manga makers</td>
                    <td>Original premise → pages</td>
                    <td>
                      OCs — see <Link href="/ai-manga-maker">AI manga maker</Link>
                    </td>
                  </tr>
                  <tr>
                    <td>AI fanfic / epilogue text tools</td>
                    <td>Prose only</td>
                    <td>Writers who do not need panels</td>
                  </tr>
                  <tr>
                    <td>AI doujinshi generators</td>
                    <td>Fan comics from long prompts</td>
                    <td>
                      Ships / AUs — see <Link href="/blog/ai-doujinshi-generator-free-2026">doujinshi guide</Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>Popular series to end</h2>
            <ul>
              <li>
                <Link href="/end/one-piece">One Piece fan ending</Link>
              </li>
              <li>
                <Link href="/end/demon-slayer">Demon Slayer fan ending</Link>
              </li>
              <li>
                <Link href="/end/jujutsu-kaisen">Jujutsu Kaisen fan ending</Link>
              </li>
              <li>
                <Link href="/end/attack-on-titan">Attack on Titan fan ending</Link>
              </li>
              <li>
                <Link href="/end/frieren">Frieren fan ending</Link>
              </li>
              <li>
                <Link href="/end/naruto">Naruto fan ending</Link>
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
            <h2>Generate your fan ending now.</h2>
            <Link className="btn btn-accent" href="/end">
              Open AI manga ending generator →
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/end", label: "Catalog" },
          { href: "/fan-ending-manga", label: "Fan ending hub" },
          { href: "/end/custom", label: "Any title" },
          { href: "/ai-manga-maker", label: "Blank AI manga maker" },
          { href: "/blog", label: "Blog" },
        ]}
      />
    </>
  );
}
