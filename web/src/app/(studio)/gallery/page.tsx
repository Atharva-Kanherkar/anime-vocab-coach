import type { Metadata } from "next";
import Link from "next/link";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { listGallery } from "@/lib/studio-store";
import { studioStyleLabel } from "@/lib/studio";
import { SITE_URL } from "@/lib/site";

// The public gallery — every learner's published manga. Free forever, no login.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manga Gallery — read original AI manga free",
  description:
    "Read original manga created in AnimeVocab Manga Studio — AI-drawn panels, editable dialogue, free to read. Browse the public gallery, no account needed.",
  keywords: ["manga gallery", "read manga online free", "oc manga", "ai manga gallery"],
  alternates: { canonical: `${SITE_URL}/gallery` },
  openGraph: {
    title: "Manga Gallery | AnimeVocab",
    description: "Original manga from Manga Studio — free to read.",
    url: `${SITE_URL}/gallery`,
    siteName: "AnimeVocab",
    type: "website",
  },
};

function coverUrl(id: string, layout: "page" | "panels", cover: number): string {
  return layout === "panels" ? `/api/studio/${id}/panel/${cover}` : `/api/studio/${id}/image`;
}

export default async function GalleryPage() {
  const entries = await listGallery();

  return (
    <>
      <LandingJsonLd
        path="/gallery"
        title="Manga Gallery — read original AI manga free"
        description="Read original manga created in AnimeVocab Manga Studio — AI-drawn panels, editable dialogue, free to read. Browse the public gallery, no account needed."
      />
      <main id="main" className="mx-auto mt-8 max-w-[960px] px-5 md:mt-10 md:px-8">
      <header>
        <p className="av-eyebrow">Manga Gallery · 本棚</p>
        <h1 className="mt-2 font-jpround text-[clamp(26px,4vw,40px)] font-black leading-tight">
          Manga made in the Studio
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-ink2">
          Original chapters storyboarded, drawn, and published by people using AI. Free to read,
          always.{" "}
          <Link href="/studio" className="font-extrabold text-accent underline">
            Make your own →
          </Link>
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="av-card mt-10 p-8 text-center">
          <p className="text-[15px] font-bold">No published manga yet.</p>
          <p className="mt-1.5 text-[13.5px] text-ink2">Be the first to write one.</p>
          <Link href="/studio" className="av-btn av-btn-primary mt-4 inline-flex">
            Open the Studio →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid list-none grid-cols-2 gap-4 pl-0 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((e) => (
            <li key={e.id}>
              <Link
                href={`/m/${e.id}`}
                className="av-card block overflow-hidden p-0 transition hover:-translate-y-0.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- runtime-generated, KV-served */}
                <img
                  src={coverUrl(e.id, e.layout, e.cover)}
                  alt={e.title.en}
                  loading="lazy"
                  className="block aspect-square w-full border-b-2 border-ink object-cover"
                />
                <div className="p-3">
                  <p className="truncate font-jpround text-[14px] font-black leading-tight">{e.title.en}</p>
                  <p className="mt-1 truncate text-[11.5px] text-ink3">
                    {studioStyleLabel(e.styleKey)}
                    {e.genre ? ` · ${e.genre}` : ""}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink3">by {e.authorName}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
    </>
  );
}
