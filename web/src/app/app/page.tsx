import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { AppDashboard } from "@/components/app-dashboard";
import { AppTopNav } from "@/components/app-shell";
import { CloudSyncPanel } from "@/components/cloud-sync-panel";
import { SiteFooter } from "@/components/site-chrome";
import { CLERK_ENABLED } from "@/lib/flags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AnimeVocab Cloud App",
  description: "Signed-in AnimeVocab Cloud dashboard for sync, AI learning, notebooks, and challenges.",
};

export default async function AppPage() {
  const user = CLERK_ENABLED ? await currentUser() : null;
  const name = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress || "learner";

  return (
    <>
      <AppTopNav />
      <main id="main" className="app-shell">
        <section className="app-hero">
          <p className="eyebrow">{CLERK_ENABLED ? `Signed in as ${name}` : "Cloud app shell"}</p>
          <h1>Your anime vocabulary dashboard</h1>
          <p>
            Progress, reviews, notebooks, AI coach, and leaderboards live here when you want Cloud —
            but the free extension still runs locally by default until you import or sync.
          </p>
        </section>

        <AppDashboard />

        <div id="sync">
          {CLERK_ENABLED ? (
            <CloudSyncPanel />
          ) : (
            <section className="cloud-panel" aria-label="Cloud sync disabled">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Cloud sync disabled</p>
                  <h2>Enable Clerk before saving account progress.</h2>
                </div>
                <span className="status-pill status-disconnected">disabled</span>
              </div>
              <p className="sync-message">
                Set `NEXT_PUBLIC_CLERK_ENABLED=true` and Clerk keys for a private sync account.
              </p>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
