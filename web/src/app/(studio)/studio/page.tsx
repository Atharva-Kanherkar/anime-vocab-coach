import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { StudioEditor } from "@/components/app/studio-editor";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { SITE_URL } from "@/lib/site";
import {
  defaultOpenGraph,
  defaultTwitter,
  STUDIO_DESCRIPTION,
  studioJsonLd,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manga Studio — create your own manga with AI",
  description:
    "Draw or generate every panel of your own manga chapter. AI augments your art — enhance a rough sketch into your style, suggest scenes and dialogue — you stay the author. Free to try, no account needed.",
  alternates: { canonical: `${SITE_URL}/studio` },
  openGraph: {
    ...defaultOpenGraph,
    title: "Manga Studio — create your own manga with AI",
    description: STUDIO_DESCRIPTION,
    url: `${SITE_URL}/studio`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab Manga Studio",
    description: STUDIO_DESCRIPTION,
  },
};

export default async function StudioPage() {
  const signedIn = DEV_NO_CLERK ? true : !!(await currentUser());
  const jsonLd = studioJsonLd();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main id="main" className="mx-auto mt-6 w-full max-w-[1400px] px-4 md:mt-8 md:px-6">
        <StudioEditor signedIn={signedIn} />
      </main>
    </>
  );
}
