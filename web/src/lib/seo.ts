import { GITHUB_URL, SITE_URL } from "@/lib/site";

export const SITE_NAME = "AnimeVocab";
export const SITE_TAGLINE = "Learn Japanese from the anime you watch";
export const SITE_DESCRIPTION =
  "AnimeVocab is a free Chrome extension that teaches Japanese vocabulary while you watch anime. Romaji-first word cards, spaced repetition, and Listening Mode for Netflix, Crunchyroll, and YouTube.";
export const TWITTER_HANDLE = "@attharrva15";

export const SEO_KEYWORDS = [
  "learn Japanese from anime",
  "anime vocabulary",
  "Japanese flashcards",
  "romaji Japanese",
  "Netflix Japanese learning",
  "Crunchyroll vocabulary",
  "spaced repetition Japanese",
  "Language Reactor alternative",
  "Migaku alternative",
  "Japanese immersion",
  "Chrome extension Japanese",
  "Listening Mode Japanese",
];

export const defaultOpenGraph = {
  siteName: SITE_NAME,
  type: "website" as const,
  locale: "en_US",
  url: SITE_URL,
  title: `${SITE_TAGLINE} | ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  images: [
    {
      url: "/og.png",
      width: 1200,
      height: 630,
      alt: "AnimeVocab — 学ぶ emblem with Japanese night scene and golden kanji",
    },
  ],
};

export const defaultTwitter = {
  card: "summary_large_image" as const,
  site: TWITTER_HANDLE,
  creator: TWITTER_HANDLE,
  title: `${SITE_TAGLINE} | ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  images: ["/og.png"],
};

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
