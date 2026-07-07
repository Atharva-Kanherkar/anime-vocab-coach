import type { Metadata } from "next";
import { StudioEditor } from "@/components/app/studio-editor";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manga Studio — create your own manga with AI",
  description:
    "Describe your story and pick a genre and art style — the AI storyboards a whole chapter with a cast, panels, and dialogue. Rewrite any line, add or reorder panels, redraw art, or sketch it yourself and let the AI finish it. Free to try, no account needed.",
  alternates: { canonical: `${SITE_URL}/studio` },
};

export default function StudioPage() {
  return (
    <main id="main" className="mx-auto mt-8 max-w-[900px] px-5 md:mt-10 md:px-8">
      <StudioEditor />
    </main>
  );
}
