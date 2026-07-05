import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { AppWorkspace } from "@/components/app-workspace";
import { AppTopNav } from "@/components/app-shell";
import { SiteFooter } from "@/components/site-chrome";
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

  return (
    <>
      <AppTopNav />
      <main id="main" className="app-shell">
        <header className="app-hero app-hero--compact">
          <p className="eyebrow">AnimeVocab Cloud</p>
          <h1>Hey, {name}</h1>
          <p className="app-hero-lede">
            Words you pick up while watching anime — saved, reviewed, and explained in one place.
          </p>
        </header>

        <AppWorkspace />
      </main>
      <SiteFooter />
    </>
  );
}
