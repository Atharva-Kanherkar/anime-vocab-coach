import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { AppShell } from "@/components/app/app-shell";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AnimeVocab Cloud App",
  description: "Your anime vocabulary — words, reviews, AI coach, and progress.",
};

export default async function AppPage() {
  const user = DEV_NO_CLERK ? null : await currentUser();
  const name = DEV_NO_CLERK
    ? DEV_PROFILE.name
    : user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress || "there";

  return <AppShell name={name} />;
}
