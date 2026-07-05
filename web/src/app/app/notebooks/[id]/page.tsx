import type { Metadata } from "next";
import { AppTopNav } from "@/components/app-shell";
import { NotebookDetail } from "@/components/notebook-detail";
import { SiteFooter } from "@/components/site-chrome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notebook",
  description: "An AnimeVocab learning notebook — saved words, lines, and scenes with AI review summaries.",
};

export default async function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppTopNav />
      <main id="main" className="app-shell">
        <NotebookDetail id={id} />
      </main>
      <SiteFooter />
    </>
  );
}
