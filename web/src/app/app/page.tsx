import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { AppDashboard } from "@/components/app-dashboard";
import { AppTopNav } from "@/components/app-shell";
import { CloudSyncPanel } from "@/components/cloud-sync-panel";
import { ExtensionConnector } from "@/components/extension-connector";
import { SiteFooter } from "@/components/site-chrome";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AnimeVocab Cloud App",
  description: "Signed-in AnimeVocab Cloud dashboard for sync, AI learning, notebooks, and challenges.",
};

export default async function AppPage() {
  const user = DEV_NO_CLERK ? null : await currentUser();
  const name = DEV_NO_CLERK
    ? DEV_PROFILE.name
    : user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress || "learner";

  return (
    <>
      <AppTopNav />
      <main id="main" className="app-shell">
        <section className="app-hero">
          <p className="eyebrow">{`Signed in as ${name}`}</p>
          <h1>Your anime vocabulary dashboard</h1>
          <p>
            Progress, reviews, notebooks, AI coach, and leaderboards live here when you want Cloud —
            but the free extension still runs locally by default until you import or sync.
          </p>
        </section>

        <AppDashboard />

        <div id="sync">
          <CloudSyncPanel />
          <ExtensionConnector />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
