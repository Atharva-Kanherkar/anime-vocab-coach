import { GITHUB_URL, SITE_URL } from "@/lib/site";

export const SITE_NAME = "AnimeVocab";
export const SITE_TAGLINE = "Learn Japanese from the anime you watch";
/** ≤160 chars for Google SERP snippets */
export const SITE_DESCRIPTION =
  "Free Chrome extension to learn Japanese from anime. Romaji-first word cards, spaced repetition, and Listening Mode for Netflix and Crunchyroll.";
export const SITE_OG_DESCRIPTION =
  "Romaji-first word cards while you watch. Spaced repetition built in. Add to Chrome free.";
export const TWITTER_HANDLE = "@attharrva15";

export const SEO_KEYWORDS = [
  "learn Japanese from anime",
  "anime vocabulary",
  "Japanese flashcards",
  "romaji Japanese",
  "Netflix Japanese learning",
  "Crunchyroll vocabulary",
  "learn Japanese Crunchyroll",
  "best anime to learn Japanese",
  "spaced repetition Japanese",
  "Language Reactor alternative",
  "Migaku alternative",
  "Lexirise alternative",
  "Japanese immersion",
  "Chrome extension Japanese",
  "Listening Mode Japanese",
  "learn Japanese Netflix anime",
  "romaji Japanese learning",
  "anime spaced repetition",
  "Japanese shadowing anime",
  "passive anime watching Japanese",
];

export const defaultOpenGraph = {
  siteName: SITE_NAME,
  type: "website" as const,
  locale: "en_US",
  url: SITE_URL,
  title: `${SITE_TAGLINE} | ${SITE_NAME}`,
  description: SITE_OG_DESCRIPTION,
  images: [
    {
      url: "/og.png",
      width: 1200,
      height: 630,
      alt: "AnimeVocab landing page preview: learn Japanese from anime with an Add to Chrome free button",
      type: "image/png",
    },
  ],
};

export const defaultTwitter = {
  card: "summary_large_image" as const,
  site: TWITTER_HANDLE,
  creator: TWITTER_HANDLE,
  title: `${SITE_TAGLINE} | ${SITE_NAME}`,
  description: SITE_OG_DESCRIPTION,
  images: ["/og.png"],
};

export function articleJsonLd(input: {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  updatedAt: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: input.url,
    datePublished: input.publishedAt,
    dateModified: input.updatedAt,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-512.png`,
      },
    },
    mainEntityOfPage: input.url,
    inLanguage: "en-US",
  };
}

export function blogJsonLd(posts: { title: string; url: string; publishedAt: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${SITE_NAME} Blog`,
    url: `${SITE_URL}/blog`,
    description: "Guides for learning Japanese from anime — Crunchyroll, Netflix, spaced repetition, and tool comparisons.",
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: p.url,
      datePublished: p.publishedAt,
    })),
  };
}

export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en-US",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon-512.png`,
          width: 512,
          height: 512,
        },
        sameAs: [GITHUB_URL, "https://x.com/attharrva15"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Chrome",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        downloadUrl: GITHUB_URL,
        featureList: [
          "Romaji-first vocabulary cards",
          "Spaced repetition while watching",
          "Listening Mode for Netflix and Crunchyroll",
          "Local-first privacy",
        ],
      },
    ],
  };
}
