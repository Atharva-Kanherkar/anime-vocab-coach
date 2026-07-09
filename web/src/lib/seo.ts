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
  "Animelon alternative",
  "Trancy alternative",
  "Lingoku alternative",
  "SubMiner Japanese",
  "SubMiner vs asbplayer",
  "mpv sentence mining anime",
  "YumeGo alternative",
  "Uplang Netflix",
  "Kitsunekko subtitles",
  "kitsunekko anime japanese subs",
  "asbplayer vs animevocab",
  "best apps learn japanese anime",
  "yomitan anime alternative",
  "free chrome extension learn japanese",
  "free japanese anime extension",
  "Wordy alternative",
  "animevocab vs wordy",
  "learn japanese disney plus",
  "substital crunchyroll",
  "migaku crunchyroll alternative",
  "learn japanese prime video",
  "shirokuma cafe learn japanese",
  "polar bear cafe japanese",
  "Japanese immersion",
  "Chrome extension Japanese",
  "Listening Mode Japanese",
  "learn Japanese Netflix anime",
  "learn Japanese YouTube anime",
  "romaji Japanese learning",
  "anime spaced repetition",
  "Japanese shadowing anime",
  "passive anime watching Japanese",
  "ai manga maker",
  "ai manga generator",
  "create manga online free",
  "manga maker online",
  "make manga with AI",
  "learn Japanese with manga",
  "manga studio",
  "write your own manga",
  "Japanese vocabulary from anime",
  "anime subtitle extension",
  "asbplayer alternative",
  "jimaku player crunchyroll",
  "substital crunchyroll",
  "kitsunekko subtitles",
  "best chrome extension learn japanese",
  "chrome extension japanese anime",
  "learn japanese netflix extension",
  "asbplayer alternative",
  "sentence mining japanese",
  "HASHIGO Netflix",
  "Yomitan anime",
  "Netflix Japanese subtitles furigana",
];

export const STUDIO_DESCRIPTION =
  "Free AI manga maker — write a premise, get a full chapter with cast and dialogue. Edit every line, redraw any panel, sketch and AI-beautify. Publish to the gallery. No drawing skills needed.";
export const STUDIO_TAGLINE = "AI Manga Maker — write your own manga online free";

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
    description: "Guides for learning Japanese from anime and manga — Crunchyroll, Netflix, spaced repetition, Manga Studio, and tool comparisons.",
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: p.url,
      datePublished: p.publishedAt,
    })),
  };
}

export const HOME_FAQ = [
  {
    question: "Can I learn Japanese just by watching anime?",
    answer:
      "Only if you actively notice and remember words. AnimeVocab handles that: one word at a time, in context, with scheduled reviews.",
  },
  {
    question: "I can't read hiragana yet. Can I still use this?",
    answer:
      "Yes. That's the default setup. Cards show romaji before kana. Switch to kana-first or kanji-first when you're ready.",
  },
  {
    question: "How is this different from subtitle dictionary tools?",
    answer:
      "Most tools assume you can read Japanese subtitles and hover words yourself. AnimeVocab pushes one curated word to you in romaji and tracks SRS for you.",
  },
  {
    question: "Is AnimeVocab free?",
    answer:
      "Yes. The core learning loop is free with no account required. Pro is optional for hosted Listening Mode transcription without bringing your own API key.",
  },
  {
    question: "Does it work on Crunchyroll without Japanese subtitles?",
    answer:
      "Yes. Listening Mode can work from spoken audio when Japanese subtitle text is missing — the common case on Crunchyroll outside Japan.",
  },
  {
    question: "Where is my data stored?",
    answer:
      "On your device by default — the extension works with no account. Create a free account only if you want cloud backup, sync across devices, or the AI coach. No ads, no tracking.",
  },
] as const;

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function mangaCreativeWorkJsonLd(input: {
  id: string;
  title: string;
  description: string;
  authorName?: string;
  genre?: string;
  createdAt: string;
  /** Share URL prefix — studio chapters use /m/, word-manga uses /wm/. */
  pathPrefix?: "m" | "wm";
  /** OG/social image path, e.g. /api/word-manga/:id/image */
  imagePath?: string;
}) {
  const prefix = input.pathPrefix ?? "m";
  const url = `${SITE_URL}/${prefix}/${input.id}`;
  const image = input.imagePath
    ? `${SITE_URL}${input.imagePath}`
    : prefix === "wm"
      ? `${SITE_URL}/api/word-manga/${input.id}/image`
      : `${SITE_URL}/api/studio/${input.id}/panel/0`;
  return {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: input.title,
    description: input.description,
    url,
    image,
    dateCreated: input.createdAt,
    artform: "manga",
    genre: input.genre || "manga",
    inLanguage: "en",
    isAccessibleForFree: true,
    creator: {
      "@type": "Person",
      name: input.authorName?.trim() || "Anonymous",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function galleryCollectionJsonLd(
  entries: { id: string; title: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AnimeVocab Manga Gallery",
    description: "Original manga chapters created in AnimeVocab Manga Studio — free to read.",
    url: `${SITE_URL}/gallery`,
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: entries.length,
      itemListElement: entries.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: entry.title,
        url: `${SITE_URL}/m/${entry.id}`,
      })),
    },
  };
}

export function webApplicationJsonLd(input: {
  id: string;
  name: string;
  description: string;
  url: string;
  applicationCategory?: string;
  operatingSystem?: string;
  featureList: string[];
  downloadUrl?: string;
}) {
  return {
    "@type": "WebApplication",
    "@id": input.id,
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: input.applicationCategory ?? "EducationalApplication",
    operatingSystem: input.operatingSystem ?? "Web browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: input.featureList,
    ...(input.downloadUrl ? { downloadUrl: input.downloadUrl } : {}),
  };
}

export function studioJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      webApplicationJsonLd({
        id: `${SITE_URL}/studio#app`,
        name: "AnimeVocab Manga Studio",
        description: STUDIO_DESCRIPTION,
        url: `${SITE_URL}/studio`,
        featureList: [
          "AI-drafted manga chapters from a text premise",
          "Per-panel art generation and redraw",
          "Sketch-to-manga AI beautify",
          "Editable dialogue with speech, thought, narration, and SFX",
          "Public manga gallery",
          "Free to try without an account",
        ],
      }),
      {
        "@type": "CreativeWork",
        name: "Manga Gallery",
        url: `${SITE_URL}/gallery`,
        description: "Original manga created and published in AnimeVocab Manga Studio.",
        isAccessibleForFree: true,
      },
    ],
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
      webApplicationJsonLd({
        id: `${SITE_URL}/#extension`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        operatingSystem: "Chrome",
        applicationCategory: "EducationalApplication",
        downloadUrl: GITHUB_URL,
        featureList: [
          "Romaji-first vocabulary cards",
          "Spaced repetition while watching",
          "Listening Mode for Netflix and Crunchyroll",
          "Local-first privacy",
        ],
      }),
      webApplicationJsonLd({
        id: `${SITE_URL}/studio#app`,
        name: "AnimeVocab Manga Studio",
        description: STUDIO_DESCRIPTION,
        url: `${SITE_URL}/studio`,
        featureList: [
          "AI manga maker with editable chapters",
          "Per-panel redraw and sketch beautify",
          "Public gallery publishing",
        ],
      }),
    ],
  };
}
