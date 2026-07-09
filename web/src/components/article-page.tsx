import type { Metadata } from "next";
import Link from "next/link";
import { ArticleBody } from "@/components/article-body";
import { Breadcrumbs } from "@/components/marketing";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import type { BlogPost } from "@/content/blog/types";
import { GITHUB_URL, SITE_URL, installUrl } from "@/lib/site";
import { articleJsonLd, defaultOpenGraph, defaultTwitter } from "@/lib/seo";

export function blogMetadata(post: BlogPost): Metadata {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const canonical = post.canonicalPath ? `${SITE_URL}${post.canonicalPath}` : url;
  const ogImage = post.ogImage ?? "/og.png";
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical },
    openGraph: {
      ...defaultOpenGraph,
      type: "article",
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      ...defaultTwitter,
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  };
}

export function ArticlePageShell({
  post,
  breadcrumbs,
  children,
}: {
  post: BlogPost;
  breadcrumbs: { href?: string; label: string }[];
  children?: React.ReactNode;
}) {
  const articleUrl = post.canonicalPath
    ? `${SITE_URL}${post.canonicalPath}`
    : `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = articleJsonLd({
    title: post.title,
    description: post.description,
    url: articleUrl,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs items={breadcrumbs} currentPath={`/blog/${post.slug}`} />
        <section className="cmp-hero">
          <div className="wrap">
            <p className="eyebrow">
              {new Date(post.publishedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              · {post.readingMinutes} min read
            </p>
            <h1>{post.title}</h1>
            <p className="lede">{post.description}</p>
          </div>
        </section>
        <section style={{ paddingTop: 0 }}>
          <div className="wrap">
            <ArticleBody blocks={post.blocks} />
            {children}
          </div>
        </section>
        <section className="closing">
          <div className="wrap narrow">
            <h2>Turn tonight&apos;s episode into vocabulary.</h2>
            <p style={{ color: "var(--ink-2)", marginBottom: 18 }}>
              AnimeVocab works on Crunchyroll, Netflix, and YouTube — romaji-first, one useful word per line.
            </p>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog", label: "Blog" },
          { href: "/learn-japanese-with-anime", label: "Compare tools" },
          { href: "/studio", label: "Manga Studio" },
          { href: "/ai-manga-maker", label: "AI manga maker" },
          { href: "/learn-japanese-manga", label: "Learn with manga" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll guide" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}

export function ArticlePage({ post, children }: { post: BlogPost; children?: React.ReactNode }) {
  return (
    <ArticlePageShell
      post={post}
      breadcrumbs={[
        { href: "/", label: "Home" },
        { href: "/blog", label: "Blog" },
        { label: post.title },
      ]}
    >
      {children}
    </ArticlePageShell>
  );
}

export function RelatedPosts({ posts }: { posts: BlogPost[] }) {
  if (posts.length === 0) return null;
  return (
    <aside className="related-posts" aria-label="Related articles">
      <h2>Keep reading</h2>
      <ul>
        {posts.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`}>{p.title}</Link>
            <span>{p.readingMinutes} min</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
