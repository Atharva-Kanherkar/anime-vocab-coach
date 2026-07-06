import type { Metadata } from "next";
import Link from "next/link";
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
      <main id="main" className="mx-auto w-[min(1080px,calc(100%-32px))] py-9 sm:py-14">
        <Link href="/app" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink2 hover:text-ink">
          ← Back to dashboard
        </Link>
        <NotebookDetail id={id} />
      </main>
    </>
  );
}
