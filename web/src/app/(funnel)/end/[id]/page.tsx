import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EndingExperience } from "@/components/funnel/ending-experience";
import { FunnelTracker } from "@/components/funnel/funnel-track";
import { ENDING_CATALOG, getFeaturedEnding } from "@/lib/ending-hooks";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return ENDING_CATALOG.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const manga = getFeaturedEnding(id);
  if (!manga) return { title: "Ending not found" };
  const title = `How would YOU end ${manga.title}?`;
  const description = `${manga.cliffhanger} Pick a fan ending and watch a 5-panel fan-art manga draw itself — free.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/end/${manga.id}` },
    openGraph: { ...defaultOpenGraph, title, description, url: `${SITE_URL}/end/${manga.id}` },
    twitter: { ...defaultTwitter, title, description },
  };
}

export default async function EndMangaPage({ params }: Props) {
  const { id } = await params;
  const manga = getFeaturedEnding(id);
  if (!manga) notFound();

  return (
    <>
      <FunnelTracker event="land_series" />
      <EndingExperience manga={manga} />
    </>
  );
}
