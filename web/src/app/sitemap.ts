import type { MetadataRoute } from "next";
import { blogPosts } from "@/content/blog/posts";
import { listGallery } from "@/lib/studio-store";
import { listGallery as listWordMangaGallery } from "@/lib/word-manga-store";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const staticRoutes = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/blog", priority: 0.85, changeFrequency: "weekly" as const },
  { path: "/learn-japanese-with-anime", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/free-japanese-anime-extension", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/studio", priority: 0.92, changeFrequency: "weekly" as const },
  { path: "/ai-manga-maker", priority: 0.91, changeFrequency: "weekly" as const },
  { path: "/fan-ending-manga", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/learn-japanese-manga", priority: 0.88, changeFrequency: "monthly" as const },
  { path: "/gallery", priority: 0.85, changeFrequency: "daily" as const },
  { path: "/learn-japanese-crunchyroll", priority: 0.88, changeFrequency: "monthly" as const },
  { path: "/best-anime-to-learn-japanese", priority: 0.88, changeFrequency: "monthly" as const },
  { path: "/learn-japanese-netflix-anime", priority: 0.86, changeFrequency: "monthly" as const },
  { path: "/learn-japanese-youtube-anime", priority: 0.84, changeFrequency: "monthly" as const },
  { path: "/learn-japanese-disney-plus", priority: 0.82, changeFrequency: "monthly" as const },
  { path: "/learn-japanese-prime-video", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/learn-japanese-hidive", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/learn-japanese-hulu", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/from-reel", priority: 0.5, changeFrequency: "weekly" as const },
  { path: "/end", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/end/custom", priority: 0.85, changeFrequency: "weekly" as const },
  { path: "/end/lantern-of-words", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/end/one-piece", priority: 0.88, changeFrequency: "weekly" as const },
  { path: "/end/naruto", priority: 0.86, changeFrequency: "weekly" as const },
  { path: "/end/demon-slayer", priority: 0.86, changeFrequency: "weekly" as const },
  { path: "/end/jujutsu-kaisen", priority: 0.86, changeFrequency: "weekly" as const },
  { path: "/end/attack-on-titan", priority: 0.84, changeFrequency: "weekly" as const },
  { path: "/end/spy-x-family", priority: 0.84, changeFrequency: "weekly" as const },
  { path: "/end/frieren", priority: 0.84, changeFrequency: "weekly" as const },
  { path: "/end/chainsaw-man", priority: 0.82, changeFrequency: "weekly" as const },
  { path: "/end/death-note", priority: 0.82, changeFrequency: "weekly" as const },
  { path: "/end/haikyuu", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/end/horimiya", priority: 0.78, changeFrequency: "weekly" as const },
  { path: "/end/spirited-away", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/end/your-name", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/end/mob-psycho", priority: 0.78, changeFrequency: "weekly" as const },
  { path: "/end/bleach", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/end/fruits-basket", priority: 0.78, changeFrequency: "weekly" as const },
  { path: "/romaji-japanese-learning", priority: 0.85, changeFrequency: "monthly" as const },
  { path: "/anime-spaced-repetition", priority: 0.84, changeFrequency: "monthly" as const },
  { path: "/vs-trancy", priority: 0.78, changeFrequency: "monthly" as const },
  { path: "/vs-language-reactor", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/vs-migaku", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/vs-lexirise", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/vs-animelon", priority: 0.77, changeFrequency: "monthly" as const },
  { path: "/vs-lingoku", priority: 0.78, changeFrequency: "monthly" as const },
  { path: "/vs-yumego", priority: 0.76, changeFrequency: "monthly" as const },
  { path: "/vs-asbplayer", priority: 0.77, changeFrequency: "monthly" as const },
  { path: "/vs-wordy", priority: 0.75, changeFrequency: "monthly" as const },
  { path: "/vs-manabidojo", priority: 0.78, changeFrequency: "monthly" as const },
  { path: "/cloud", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/without-extension", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/feed.xml", priority: 0.5, changeFrequency: "daily" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date("2026-07-10");
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

  let galleryEntries: MetadataRoute.Sitemap = [];
  let wordMangaEntries: MetadataRoute.Sitemap = [];
  try {
    const gallery = await listGallery();
    galleryEntries = gallery.map((entry) => ({
      url: `${SITE_URL}/m/${entry.id}`,
      lastModified: new Date(entry.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // KV unavailable at build/preview time — static + blog URLs still ship.
  }

  try {
    const wordManga = await listWordMangaGallery();
    wordMangaEntries = wordManga.map((entry) => ({
      url: `${SITE_URL}/wm/${entry.id}`,
      lastModified: new Date(entry.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.55,
    }));
  } catch {
    // Same KV caveat as studio gallery.
  }

  return [...pages, ...blogEntries, ...galleryEntries, ...wordMangaEntries];
}
