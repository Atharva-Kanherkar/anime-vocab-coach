import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EndingPageClient } from "@/components/app/ending-page-client";
import { DesktopChromeBanner } from "@/components/desktop-chrome-banner";
import { getFeaturedEnding } from "@/lib/ending-hooks";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const manga = getFeaturedEnding(id);
  if (!manga) return { title: "Ending not found" };
  const title = `Choose your ending — ${manga.title}`;
  const description = manga.cliffhanger;
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
          Want a blank canvas?{" "}
          <Link href="/studio" className="font-extrabold text-accent underline">
            Open Manga Studio
          </Link>
          {" · "}
          <Link href="/gallery" className="font-extrabold text-accent underline">
            Gallery
          </Link>
        </p>
      </main>
      <DesktopChromeBanner />
    </>
  );
}
