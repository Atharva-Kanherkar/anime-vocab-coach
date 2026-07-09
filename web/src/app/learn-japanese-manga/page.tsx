import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { articleJsonLd, defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const FAQ = [
  {
    question: "Is writing manga better than reading manga for Japanese?",
    answer:
      "They train different skills. Reading builds recognition; writing forces retrieval. Use graded readers for input and short self-written chapters for output.",
  },
  {
    question: "Can beginners write manga before they know kanji?",
    answer:
      "Yes. Start with English drafts, romaji, or simple kana dialogue. Edit AI lines until they match words you are studying from anime.",
  },
  {
    question: "What is Word Manga vs Manga Studio?",
    answer:
      "Word Manga builds a 4-panel story around vocabulary you already saved. Manga Studio drafts longer chapters from a premise with editable dialogue and panel art.",
  },
  {
    question: "How do I combine anime watching with manga writing?",
    answer:
      "Capture one word per episode while watching, then spend a weekend putting those words into a short manga chapter and reviewing with spaced repetition.",
  },
];

const path = "/learn-japanese-manga";

const title = "Learn Japanese with Manga You Write (2026 Guide)";
const description =
  "Learn Japanese by writing your own manga — active recall beats passive reading. Use AI to draft panels, edit dialogue in Japanese, and review vocabulary with word checks.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "learn japanese with manga",
    "manga for japanese learning",
    "write manga learn japanese",
    "japanese vocabulary manga",
    "active recall japanese",
    "graded readers manga",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title,
    description,
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Learn Japanese with Manga You Write",
    description,
  },
};

export default function LearnJapaneseMangaPage() {
  const jsonLd = articleJsonLd({
    title,
    description,
    url: `${SITE_URL}${path}`,
    publishedAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  });
  const faqLd = faqJsonLd(FAQ);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Guides" },
            { label: "Learn with manga" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Learn Japanese with manga — by writing it"
          lede={
            <>
              Reading manga in Japanese is good input. <strong>Writing manga in Japanese</strong> is better
              practice — you must produce vocabulary, not just recognize it. Manga Studio lets anime learners
              draft short chapters around target words, edit dialogue until it sounds natural, and pass word
              checks that lock vocabulary into memory.
            </>
          }
          verdictTag="The science"
          verdict={
            <>
              SLA research consistently shows <strong>retrieval practice</strong> beats re-reading. Composing
              even a six-panel manga forces you to recall grammar and word choice. Pair that with{" "}
              <Link href="/blog/spaced-repetition-anime-vocabulary">spaced repetition from anime watching</Link>{" "}
              and you cover both input and output.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Why writing beats only reading manga</h2>
            <ul>
              <li>
                <strong>Active recall</strong> — choosing the right word for a speech bubble is harder than
                guessing from context while reading.
              </li>
              <li>
                <strong>Personal context</strong> — you remember lines you wrote about characters you invented.
              </li>
              <li>
                <strong>Graded difficulty</strong> — start with romaji or simple Japanese; add kanji as you
                progress (same path as{" "}
                <Link href="/romaji-japanese-learning">romaji-first learning</Link>).
              </li>
              <li>
                <strong>Motivation</strong> — finishing a chapter you wrote hits different from finishing a
                textbook drill.
              </li>
            </ul>

            <h2>A 30-minute learn-Japanese-with-manga session</h2>
            <ol>
              <li>
                Pick 3–5 words from last night&apos;s anime session (or use{" "}
                <Link href="/studio">Manga Studio</Link> starter vocab).
              </li>
              <li>
                Write a one-paragraph premise: who, where, conflict — keep it slice-of-life for beginner
                grammar.
              </li>
              <li>Let AI draft panels, then <strong>rewrite every dialogue line</strong> yourself before accepting.</li>
              <li>Read the finished chapter aloud — shadow your own lines.</li>
              <li>Pass the word check; publish to the <Link href="/gallery">gallery</Link> if you want feedback.</li>
            </ol>

            <h2>Word Manga — vocabulary in 4 panels</h2>
            <p>
              Inside the extension, <strong>Word Manga</strong> builds a mini-story around words you are
              already learning — every target word must appear in the Japanese dialogue, with romaji and a
              recall check after you read. Publish a share link when you are proud of it. Guide:{" "}
              <Link href="/blog/word-manga-vocabulary-practice-2026">Word Manga vocabulary practice</Link>.
            </p>

            <h2>Manga Studio vs reading graded readers</h2>
            <p>
              Graded readers (N5–N1) are excellent controlled input. Manga Studio is the output side: you set
              the difficulty by choosing words and editing AI drafts. Use both — watch anime with{" "}
              <Link href="/learn-japanese-with-anime">AnimeVocab</Link>, write a manga chapter on weekends,
              review with SRS during the week.
            </p>

            <h2>Beginner workflow (month zero)</h2>
            <ul>
              <li>Write dialogue in <strong>English first</strong>, then translate line-by-line with a dictionary.</li>
              <li>Or set dialogue language to Japanese and edit romaji readings in the reader toggle.</li>
              <li>Keep chapters to <strong>4–6 panels</strong> — one scene, one emotional beat.</li>
              <li>
                Pair with{" "}
                <Link href="/blog/best-anime-to-learn-japanese-beginners">beginner anime picks</Link> for
                listening input.
              </li>
            </ul>

            <h2>FAQ</h2>
            {FAQ.map((item) => (
              <div key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}

            <p>
              Deep dive:{" "}
              <Link href="/blog/learn-japanese-by-writing-manga">Learn Japanese by writing manga</Link>,{" "}
              <Link href="/blog/graded-readers-vs-writing-manga-2026">graded readers vs writing manga</Link>,{" "}
              <Link href="/ai-manga-maker">AI manga maker guide</Link>,{" "}
              <Link href="/blog/one-word-per-episode-method">one word per episode method</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Watch anime. Write manga. Remember words.</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <Link className="btn btn-accent" href="/studio">
                Open Manga Studio
              </Link>
              <a className="btn btn-line" href={GITHUB_URL} rel="noopener noreferrer">
                Add extension (free)
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/studio", label: "Manga Studio" },
          { href: "/gallery", label: "Gallery" },
          { href: "/blog/word-manga-vocabulary-practice-2026", label: "Word Manga guide" },
          { href: "/ai-manga-maker", label: "AI manga maker" },
          { href: "/blog", label: "Blog" },
          { href: "/learn-japanese-with-anime", label: "Anime guide" },
        ]}
      />
    </>
  );
}
