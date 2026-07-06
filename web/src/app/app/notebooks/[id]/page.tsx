import type { Metadata } from "next";
import { AppNav } from "@/components/app/app-nav";
import { NotebookDetail } from "@/components/notebook-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notebook",
  description: "An AnimeVocab learning notebook — saved words, lines, and scenes with AI review summaries.",
};

export default async function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppNav />
      <main id="main" className="mx-auto max-w-[960px] px-5 py-9 md:px-8">
        <NotebookDetail id={id} />
      </main>
    </>
  );
}
