import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EndingPageClient } from "@/components/app/ending-page-client";
import { DesktopChromeBanner } from "@/components/desktop-chrome-banner";
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
  const title = `Fan ending — ${manga.title}`;
  const description = `${manga.cliffhanger} Unofficial fan art epilogue. Pick your finale.`;
  return {
    title,
    description,
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

  return (
    <>
      <main id="main" className="mx-auto mt-6 w-full max-w-[720px] px-4 pb-28 md:mt-10 md:px-6">
        <EndingPageClient manga={manga} />
        <p className="mt-10 text-center text-[13px] text-ink3">
          <Link href="/end" className="font-extrabold text-accent underline">
            All series
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
