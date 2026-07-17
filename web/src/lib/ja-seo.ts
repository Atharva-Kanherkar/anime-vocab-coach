import type { Metadata } from "next";
import { SITE_URL, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

/** BOFU cluster under /ja/ — Japanese-intent, ja→en learning direction. */
export const JA_CLUSTER_LASTMOD = "2026-07-18";

export const JA_SITEMAP_ROUTES = [
  { path: "/ja", priority: 0.95, changeFrequency: "weekly" as const },
  { path: "/ja/eigo-jimaku-kakucho", priority: 0.92, changeFrequency: "weekly" as const },
  { path: "/ja/netflix-eigo-jimaku-tango", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/ja/anime-eigo-listening", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/ja/crunchyroll-eigo-jimaku", priority: 0.88, changeFrequency: "weekly" as const },
  { path: "/ja/vs-language-reactor", priority: 0.86, changeFrequency: "monthly" as const },
  { path: "/ja/kakucho-nashi", priority: 0.6, changeFrequency: "monthly" as const },
] as const;

/** CTA into ja→en onboarding — pairs with issue #81 direction surfacing. */
export function jaEnOnboardUrl(): string {
  return `${SITE_URL}/app?direction=ja-en#help`;
}

/** Primary install CTA for Japanese BOFU pages. */
export function jaEnInstallUrl(): string {
  return installUrl();
}

export function jaArticleJsonLd(input: {
  path: string;
  title: string;
  description: string;
  publishedAt?: string;
}) {
  const publishedAt = input.publishedAt ?? `${JA_CLUSTER_LASTMOD}T00:00:00.000Z`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: `${SITE_URL}${input.path}`,
    datePublished: publishedAt,
    dateModified: publishedAt,
    inLanguage: "ja",
    author: {
      "@type": "Organization",
      name: "AnimeVocab",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "AnimeVocab",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-512.png`,
      },
    },
    mainEntityOfPage: `${SITE_URL}${input.path}`,
  };
}

export function jaPageMetadata(input: {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  /** English counterpart for hreflang when one exists. */
  enAlternate?: string;
}): Metadata {
  const canonical = `${SITE_URL}${input.path}`;
  const languages: Record<string, string> = {
    ja: canonical,
  };
  if (input.enAlternate) {
    languages["en"] = `${SITE_URL}${input.enAlternate}`;
    languages["x-default"] = `${SITE_URL}${input.enAlternate}`;
  } else {
    languages["x-default"] = `${SITE_URL}/`;
  }

  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      ...defaultOpenGraph,
      type: "article",
      locale: "ja_JP",
      title: input.title,
      description: input.description,
      url: canonical,
    },
    twitter: {
      ...defaultTwitter,
      title: input.title,
      description: input.description,
    },
  };
}
