import type { MetadataRoute } from "next";
import { blogPosts } from "@/content/blog/posts";
import { SITE_URL } from "@/lib/site";

const staticRoutes = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/blog", priority: 0.85, changeFrequency: "weekly" as const },
  { path: "/learn-japanese-with-anime", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/studio", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/gallery", priority: 0.85, changeFrequency: "daily" as const },
  { path: "/learn-japanese-crunchyroll", priority: 0.88, changeFrequency: "monthly" as const },
  { path: "/best-anime-to-learn-japanese", priority: 0.88, changeFrequency: "monthly" as const },
  { path: "/learn-japanese-netflix-anime", priority: 0.86, changeFrequency: "monthly" as const },
  { path: "/romaji-japanese-learning", priority: 0.85, changeFrequency: "monthly" as const },
  { path: "/learn-japanese-youtube-anime", priority: 0.84, changeFrequency: "monthly" as const },
  { path: "/vs-trancy", priority: 0.78, changeFrequency: "monthly" as const },
  { path: "/vs-language-reactor", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/vs-migaku", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/vs-lexirise", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/cloud", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/without-extension", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-05");
  const blogEntries = blogPosts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  const pages = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  return [...pages, ...blogEntries];
}
