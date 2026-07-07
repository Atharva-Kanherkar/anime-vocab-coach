import type { Metadata } from "next";
import { StudioEditor } from "@/components/app/studio-editor";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manga Studio — write your own manga to learn Japanese",
  description:
    "Turn the words you're learning into your own manga. The AI drafts the panels in real Japanese; you edit any line, redraw any panel, or sketch it yourself and let the AI beautify it. Try it free — no account needed.",
  alternates: { canonical: `${SITE_URL}/studio` },
};

export default function StudioPage() {
  return (
    <main id="main" className="mx-auto mt-8 max-w-[900px] px-5 md:mt-10 md:px-8">
      <StudioEditor />
    </main>
  );
}
