import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { CloudSyncPanel } from "@/components/cloud-sync-panel";
import { SiteFooter } from "@/components/site-chrome";
import { CLERK_ENABLED } from "@/lib/flags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AnimeVocab Cloud App",
  description: "Signed-in AnimeVocab Cloud dashboard for sync, AI learning, notebooks, and challenges.",
};

export default async function AppPage() {
  // When Clerk is off, skip currentUser() (it needs keys) and show a public shell.
  const user = CLERK_ENABLED ? await currentUser() : null;
  const name = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress || "learner";

  return (
    <>
      <header className="app-top">
        <Link className="logo" href="/" aria-label="AnimeVocab home">
          アニメ<b>Vocab</b>
        </Link>
        <nav aria-label="Cloud">
          <Link href="/cloud">Cloud</Link>
          <Link href="/#pricing">Pricing</Link>
        </nav>
        {CLERK_ENABLED && <UserButton />}
      </header>
      <main id="main" className="app-shell">
        <section className="app-hero">
          <p className="eyebrow">Signed in as {name}</p>
          <h1>AnimeVocab Cloud</h1>
          <p>
            This is the account-backed foundation for sync, AI coach features, notebooks,
            and social learning. Local extension data stays local until you import or sync it.
          </p>
        </section>

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

        <section className="app-grid" aria-label="Cloud feature roadmap">
          <article>
            <h2>AI coach</h2>
            <p>Explain a saved anime line, create memory hooks, and generate review prompts from scene context.</p>
            <span>Next: usage-capped Pro endpoint</span>
          </article>
          <article>
            <h2>Notebooks</h2>
            <p>Collect words, lines, and explanations by title, episode, JLPT level, and personal tags.</p>
            <span>Next: per-user persistence</span>
          </article>
          <article>
            <h2>Challenges</h2>
            <p>Weekly streaks and opt-in leaderboards reward reviews and real watch sessions, not noisy vanity points.</p>
            <span>Next: event schema</span>
          </article>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
