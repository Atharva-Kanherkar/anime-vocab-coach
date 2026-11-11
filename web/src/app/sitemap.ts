import type { MetadataRoute } from "next";
import { blogPosts } from "@/content/blog/posts";
import { JA_CLUSTER_LASTMOD, JA_SITEMAP_ROUTES } from "@/lib/ja-seo";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Per-route lastmod when we ship meaningful SEO/content changes to that URL. */
const staticRoutes = [
  { path: "", priority: 1, changeFrequency: "weekly" as const, lastModified: "2026-07-18" },
  { path: "/anime-vocabulary", priority: 0.96, changeFrequency: "weekly" as const, lastModified: "2026-07-18" },
  { path: "/pricing", priority: 0.9, changeFrequency: "weekly" as const, lastModified: "2026-09-09" },
  { path: "/blog", priority: 0.85, changeFrequency: "weekly" as const, lastModified: "2026-07-14" },
  { path: "/learn-japanese-with-anime", priority: 0.9, changeFrequency: "monthly" as const, lastModified: "2026-07-14" },
  { path: "/learn-japanese-with-anime-free", priority: 0.95, changeFrequency: "weekly" as const, lastModified: "2026-07-11" },
  { path: "/free-japanese-anime-extension", priority: 0.9, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/migaku-free-alternative", priority: 0.95, changeFrequency: "daily" as const, lastModified: "2026-07-11" },
  { path: "/migaku-vs-language-reactor", priority: 0.92, changeFrequency: "weekly" as const, lastModified: "2026-07-17" },
  { path: "/anki-vs-migaku", priority: 0.88, changeFrequency: "weekly" as const, lastModified: "2026-07-11" },
  { path: "/manabidojo-alternative", priority: 0.9, changeFrequency: "weekly" as const, lastModified: "2026-07-11" },
  { path: "/animelon-alternative", priority: 0.9, changeFrequency: "weekly" as const, lastModified: "2026-07-11" },
  { path: "/language-reactor-alternative", priority: 0.9, changeFrequency: "weekly" as const, lastModified: "2026-07-17" },
  { path: "/language-reactor-alternative-crunchyroll", priority: 0.92, changeFrequency: "weekly" as const, lastModified: "2026-07-17" },
  { path: "/does-language-reactor-work-on-crunchyroll", priority: 0.93, changeFrequency: "weekly" as const, lastModified: "2026-07-17" },
  { path: "/does-migaku-work-on-crunchyroll", priority: 0.93, changeFrequency: "weekly" as const, lastModified: "2026-07-17" },
  { path: "/crunchyroll-japanese-subtitles", priority: 0.92, changeFrequency: "weekly" as const, lastModified: "2026-07-17" },
  { path: "/asbplayer-alternative", priority: 0.88, changeFrequency: "weekly" as const, lastModified: "2026-07-11" },
  { path: "/lingopie-alternative", priority: 0.9, changeFrequency: "weekly" as const, lastModified: "2026-07-14" },
  { path: "/rikaikun-alternative", priority: 0.88, changeFrequency: "weekly" as const, lastModified: "2026-07-14" },
  { path: "/japanese-subtitles-anime", priority: 0.88, changeFrequency: "weekly" as const, lastModified: "2026-07-14" },
  { path: "/learn-japanese-crunchyroll", priority: 0.9, changeFrequency: "weekly" as const, lastModified: "2026-07-17" },
  { path: "/best-anime-to-learn-japanese", priority: 0.88, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/learn-japanese-netflix-anime", priority: 0.86, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/learn-japanese-youtube-anime", priority: 0.84, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/learn-japanese-disney-plus", priority: 0.82, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/learn-japanese-prime-video", priority: 0.8, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/learn-japanese-hidive", priority: 0.8, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/learn-japanese-hulu", priority: 0.8, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/romaji-japanese-learning", priority: 0.85, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/anime-spaced-repetition", priority: 0.84, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/vs-trancy", priority: 0.78, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/vs-language-reactor", priority: 0.8, changeFrequency: "monthly" as const, lastModified: "2026-07-14" },
  { path: "/vs-migaku", priority: 0.88, changeFrequency: "weekly" as const, lastModified: "2026-07-14" },
  { path: "/vs-lexirise", priority: 0.8, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/vs-animelon", priority: 0.77, changeFrequency: "monthly" as const, lastModified: "2026-07-14" },
  { path: "/vs-lingoku", priority: 0.78, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/vs-yumego", priority: 0.76, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/vs-asbplayer", priority: 0.77, changeFrequency: "monthly" as const, lastModified: "2026-07-14" },
  { path: "/vs-wordy", priority: 0.75, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/vs-manabidojo", priority: 0.86, changeFrequency: "weekly" as const, lastModified: "2026-07-14" },
  { path: "/cloud", priority: 0.7, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/without-extension", priority: 0.6, changeFrequency: "monthly" as const, lastModified: "2026-07-11" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const, lastModified: "2026-07-04" },
  // /feed.xml is an RSS feed, not an HTML landing — omit from sitemap
  ...JA_SITEMAP_ROUTES.map((route) => ({
    path: route.path,
    priority: route.priority,
    changeFrequency: route.changeFrequency,
    lastModified: JA_CLUSTER_LASTMOD,
  })),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only list self-canonical blog URLs. Posts with canonicalPath already
  // consolidate to another URL — listing them here splits crawl budget.
  const blogEntries = blogPosts
    .filter((post) => !post.canonicalPath)
    .map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    }));

  const pages = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  return [...pages, ...blogEntries];
}
