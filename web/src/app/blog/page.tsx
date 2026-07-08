import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { blogPosts } from "@/content/blog/posts";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { blogJsonLd, defaultOpenGraph, defaultTwitter } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Blog · Learn Japanese from Anime & Manga",
  description:
    "Guides on learning Japanese with anime — Crunchyroll without JP subs, best beginner shows, spaced repetition, AI manga maker, shadowing, and tool comparisons.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    ...defaultOpenGraph,
    title: "AnimeVocab Blog · Learn Japanese from Anime",
    description:
      "Research-backed guides: Crunchyroll, Netflix, SRS, romaji-first learning, Manga Studio, and immersion workflows.",
    url: `${SITE_URL}/blog`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab Blog",
    description: "Learn Japanese from anime and manga — guides, comparisons, and study workflows.",
  },
};

export default function BlogIndexPage() {
  const jsonLd = blogJsonLd(
    blogPosts.map((p) => ({
      title: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      publishedAt: p.publishedAt,
    }))
  );

  const sorted = [...blogPosts].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader compact />
      <main id="main">
        <section className="cmp-hero">
          <div className="wrap">
            <p className="eyebrow">Guides & research</p>
            <h1>Learn Japanese from anime — for real</h1>
            <p className="lede">
              Practical posts on Crunchyroll, Netflix, spaced repetition, Manga Studio, and tools — written for
              learners who want listening gains, not binge guilt.
            </p>
          </div>
        </section>

        <section style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="blog-grid">
              {sorted.map((post) => (
                <article key={post.slug} className="blog-card">
                  <p className="eyebrow">
                    {new Date(post.publishedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {post.readingMinutes} min
                  </p>
                  <h2>
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  <p>{post.description}</p>
                  <Link className="dash-cta" href={`/blog/${post.slug}`}>
                    Read article →
                  </Link>
                </article>
              ))}
            </div>

            <aside className="blog-hub-links">
              <h2>Tool comparisons & guides</h2>
              <ul>
                <li>
                  <Link href="/vs-lingoku">AnimeVocab vs Lingoku</Link>
                </li>
                <li>
                  <Link href="/blog/subminer-vs-asbplayer-anime-mining-2026">
                    SubMiner vs asbplayer mining
                  </Link>
                </li>
                <li>
                  <Link href="/blog/lingoku-alternative-anime-japanese-2026">
                    Lingoku vs AnimeVocab (2026)
                  </Link>
                </li>
                <li>
                  <Link href="/blog/hashigo-yomitan-netflix-japanese-anime-2026">
                    HASHIGO, Yomitan & Netflix subs
                  </Link>
                </li>
                <li>
                  <Link href="/blog/asbplayer-alternative-beginners-anime-japanese">
                    asbplayer vs beginner tools
                  </Link>
                </li>
                <li>
                  <Link href="/blog/best-chrome-extensions-learn-japanese-anime-2026">
                    Best Chrome extensions for anime Japanese (2026)
                  </Link>
                </li>
                <li>
                  <Link href="/learn-japanese-with-anime">How to learn Japanese with anime (2026)</Link>
                </li>
                <li>
                  <Link href="/ai-manga-maker">AI manga maker — create manga online free</Link>
                </li>
                <li>
                  <Link href="/learn-japanese-manga">Learn Japanese by writing manga</Link>
                </li>
                <li>
                  <Link href="/learn-japanese-crunchyroll">Learn Japanese on Crunchyroll</Link>
                </li>
                <li>
                  <Link href="/blog/jimaku-crunchyroll-subtitles-vs-listening-mode">
                    Jimaku vs Listening Mode (Crunchyroll)
                  </Link>
                </li>
                <li>
                  <Link href="/best-anime-to-learn-japanese">Best anime for beginners</Link>
                </li>
                <li>
                  <Link href="/learn-japanese-youtube-anime">Learn Japanese on YouTube anime</Link>
                </li>
                <li>
                  <Link href="/romaji-japanese-learning">Romaji-first learning</Link>
                </li>
                <li>
                  <Link href="/anime-spaced-repetition">Spaced repetition for anime</Link>
                </li>
                <li>
                  <Link href="/learn-japanese-netflix-anime">Learn Japanese on Netflix</Link>
                </li>
                <li>
                  <Link href="/cloud">AnimeVocab Cloud</Link>
                </li>
                <li>
                  <Link href="/vs-lexirise">AnimeVocab vs Lexirise</Link>
                </li>
                <li>
                  <Link href="/vs-animelon">AnimeVocab vs Animelon</Link>
                </li>
                <li>
                  <Link href="/vs-manabidojo">AnimeVocab vs ManabiDojo</Link>
                </li>
                <li>
                  <Link href="/vs-language-reactor">AnimeVocab vs Language Reactor</Link>
                </li>
                <li>
                  <Link href="/vs-migaku">AnimeVocab vs Migaku</Link>
                </li>
                <li>
                  <Link href="/vs-trancy">AnimeVocab vs Trancy</Link>
                </li>
              </ul>
            </aside>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Ready to learn from tonight&apos;s episode?</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/learn-japanese-with-anime", label: "Compare" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/privacy", label: "Privacy" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
