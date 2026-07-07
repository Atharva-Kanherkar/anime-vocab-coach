import type { Metadata } from "next";
import { StudioEditor } from "@/components/app/studio-editor";
import { studioJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manga Studio — create your own manga with AI",
  description:
    "Describe your story and pick a genre and art style — the AI storyboards a whole chapter with a cast, panels, and dialogue. Rewrite any line, add or reorder panels, redraw art, or sketch it yourself and let the AI finish it. Free to try, no account needed.",
  keywords: [
    "manga studio",
    "ai manga maker",
    "write manga online",
    "create manga free",
    "learn japanese manga",
  ],
  alternates: { canonical: `${SITE_URL}/studio` },
  openGraph: {
    title: "Manga Studio — AI Manga Maker | AnimeVocab",
    description:
      "Free AI manga maker. Draft a full chapter from your premise, edit dialogue, redraw panels, publish to the gallery.",
    url: `${SITE_URL}/studio`,
    siteName: "AnimeVocab",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "AnimeVocab Manga Studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Manga Studio — create your own manga",
    description: "Free AI manga maker with editable dialogue and per-panel redraw.",
    images: ["/og.png"],
  },
};

export default function StudioPage() {
  const jsonLd = studioJsonLd();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main id="main" className="mx-auto mt-8 max-w-[900px] px-5 md:mt-10 md:px-8">
        <StudioEditor />
      </main>
    </>
  );
}
