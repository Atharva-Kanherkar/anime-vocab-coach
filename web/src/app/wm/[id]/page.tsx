import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioReaderView } from "@/components/app/word-manga-reader";
import { getCreation } from "@/lib/word-manga-store";
import { SITE_URL } from "@/lib/site";

// Public, shareable page for a Manga Studio creation. Only creations the
// owner explicitly made public resolve here — everything else 404s, so the
// unguessable id stays private-by-default.

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const meta = await getCreation(id);
  if (!meta?.isPublic) return { title: "Manga not found" };
  const title = `${meta.title.en} — a learner-made manga`;
  const description = `A 4-panel manga written to practice ${meta.words
    .map((w) => w.base)
    .join("、")} — made in AnimeVocab Manga Studio.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/wm/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/wm/${id}`,
      images: [{ url: `/api/word-manga/${id}/image`, width: 1024, height: 1536 }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedMangaPage({ params }: Params) {
  const { id } = await params;
  const meta = await getCreation(id);
  if (!meta?.isPublic) notFound();

  return (
    <main id="main" className="mx-auto max-w-[720px] px-5 py-9 md:px-8">
      <StudioReaderView
        meta={meta}
        imageUrl={`/api/word-manga/${id}/image`}
        footer={
          <div className="av-card p-5 text-center">
            <p className="av-eyebrow">Manga Studio · 創作</p>
            <p className="mt-2 text-[15px] font-bold">
              This manga was written by a learner to practice{" "}
              <span className="font-jp text-accent">{meta.words.map((w) => w.base).join("、")}</span>
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">
              Pick the Japanese words you&apos;re learning, and AnimeVocab writes and draws a manga
              that teaches them to you. Free — no extension needed.
            </p>
            <Link href="/app#word-manga" className="av-btn av-btn-primary mt-4 inline-flex">
              Write your own manga →
            </Link>
          </div>
        }
      />
    </main>
  );
}
