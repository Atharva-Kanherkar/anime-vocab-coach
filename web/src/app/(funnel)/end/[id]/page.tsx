import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EndingExperience } from "@/components/funnel/ending-experience";
import { FunnelTracker } from "@/components/funnel/funnel-track";
import { ENDING_CATALOG, getFeaturedEnding } from "@/lib/ending-hooks";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return ENDING_CATALOG.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const manga = getFeaturedEnding(id);
  if (!manga) return { title: "Ending not found" };
  const title = `${manga.title} fan ending — choose your epilogue`;
  const description = `${manga.cliffhanger} Unofficial fan art for ${manga.title}. Pick a finale and watch a 5-panel manga draw itself — free.`;
  return {
    title,
    description,
    keywords: [
      `${manga.title} fan ending`,
      `${manga.title} fan manga`,
      "fan ending manga",
      "choose your ending",
    ],
    alternates: { canonical: `${SITE_URL}/end/${manga.id}` },
    openGraph: {
      ...defaultOpenGraph,
      title,
      description,
      url: `${SITE_URL}/end/${manga.id}`,
    },
    twitter: { ...defaultTwitter, title, description },
  };
}

export default async function EndMangaPage({ params }: Props) {
  const { id } = await params;
  const manga = getFeaturedEnding(id);
  if (!manga) notFound();

  const faqLd = faqJsonLd([
    {
      question: `Is this an official ${manga.title} ending?`,
      answer: `No. This is an unofficial fan ending / fan art epilogue for creative play — not affiliated with the original ${manga.title} publishers.`,
    },
    {
      question: `How do I make a ${manga.title} fan ending manga?`,
      answer:
        "Pick one of the three fan finales, optionally add a twist, and watch a 5-panel fan-art manga draw itself on the page.",
    },
    {
      question: "Can I try a different series?",
      answer:
        "Yes. Browse the full endings catalog or type any manga title on the custom ending page.",
    },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <FunnelTracker event="land_series" />
      <EndingExperience manga={manga} />
    </>
  );
}
