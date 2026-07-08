export type ArticleBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  keywords: string[];
  readingMinutes: number;
  /** Optional OG image path (under /public). Defaults to /og.png */
  ogImage?: string;
  blocks: ArticleBlock[];
};
