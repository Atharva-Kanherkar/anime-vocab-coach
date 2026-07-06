import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { CloudAutoSync } from "@/components/app/cloud-auto-sync";
import { CardStoryPage } from "@/components/app/card-story-page";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { getCardById } from "@/lib/cards";
import { getCardStory } from "@/lib/card-stories";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = getCardById(id);
  if (!card) return { title: "Card not found" };
  return {
    title: `${card.name} — ${card.epithet}`,
    description: `Origin story of ${card.name}, a Listener on the Luminara Thread.`,
  };
}

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = getCardById(id);
  const story = getCardStory(id);
  if (!card) notFound();

  const user = DEV_NO_CLERK ? null : await currentUser();
  const owner = DEV_NO_CLERK ? true : isOwnerEmail(user?.primaryEmailAddress?.emailAddress);

  return (
    <>
      <CloudAutoSync />
      <AppNav />
      <main id="main" className="mx-auto max-w-[720px] px-5 py-9 md:px-8">
        <CardStoryPage card={card} story={story} owner={owner} />
      </main>
    </>
  );
}
