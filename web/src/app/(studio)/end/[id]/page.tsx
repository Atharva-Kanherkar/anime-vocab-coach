import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EndingPageClient } from "@/components/app/ending-page-client";
import { DesktopChromeBanner } from "@/components/desktop-chrome-banner";
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
  const description = `${manga.cliffhanger} Unofficial fan art epilogue for ${manga.title}. Pick your finale free.`;
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
        "Pick one of the three fan finales below, optionally add a twist, and generate a short chapter. Then edit dialogue in Manga Studio.",
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
      <main id="main" className="mx-auto mt-6 w-full max-w-[720px] px-4 pb-28 md:mt-10 md:px-6">
        <EndingPageClient manga={manga} />
        <p className="mt-10 text-center text-[13px] text-ink3">
          <Link href="/end" className="font-extrabold text-accent underline">
            All series
          </Link>
          {" · "}
          <Link href="/fan-ending-manga" className="font-extrabold text-accent underline">
            Fan ending guide
          </Link>
          {" · "}
          <Link href="/end/custom" className="font-extrabold text-accent underline">
            Any title
          </Link>
          {" · "}
          <Link href="/studio" className="font-extrabold text-accent underline">
            Studio
          </Link>
        </p>
      </main>
      <DesktopChromeBanner />
    </>
  );
}
