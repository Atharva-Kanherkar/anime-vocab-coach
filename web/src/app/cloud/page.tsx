import type { Metadata } from "next";
import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "AnimeVocab Cloud | Optional sync and AI for anime Japanese learning",
  description:
    "AnimeVocab Cloud is the optional hosted companion to the local-first Chrome extension: sync, AI scene explanations, notebooks, and social learning without making accounts mandatory.",
  alternates: { canonical: `${SITE_URL}/cloud` },
};

export default function CloudPage() {
  return (
    <>
      <SiteHeader compact />
      <main id="main" className="cloud-page">
        <section className="cloud-hero">
          <div className="wrap cloud-hero-grid">
            <div>
              <p className="eyebrow">Optional hosted companion</p>
              <h1>Local-first by default. Cloud when it actually helps.</h1>
              <p className="cloud-lede">
                AnimeVocab Cloud adds account-backed sync, AI explanations from anime scenes,
                notebooks, streaks, and leaderboards without taking away the free extension.
              </p>
              <div className="hero-cta">
                <Show when="signed-out">
                  <SignUpButton mode="modal">
                    <button className="btn btn-accent" type="button">Create Cloud account</button>
                  </SignUpButton>
                  <SignInButton mode="modal">
                    <button className="btn btn-line" type="button">Sign in</button>
                  </SignInButton>
                </Show>
                <Show when="signed-in">
                  <Link className="btn btn-accent" href="/app" prefetch={false}>
                    Open Cloud app
                  </Link>
                  <UserButton />
                </Show>
                <a className="btn btn-line" href={GITHUB_URL} rel="noopener noreferrer">
                  Install free extension
                </a>
              </div>
            </div>
            <div className="cloud-proof">
              <span>Why hosted exists</span>
              <ul>
                <li>Chrome review should not be the only distribution path.</li>
                <li>AI usage needs account-level caps and cost controls.</li>
                <li>Notebooks and leaderboards need identity and sync.</li>
                <li>Local progress should remain exportable and user-owned.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="cloud-band">
          <div className="wrap cloud-feature-grid">
            <article>
              <span className="jp-mark" aria-hidden="true">同期</span>
              <h2>Sync that starts with export</h2>
              <p>
                Import your local extension JSON, normalize it into a versioned Cloud snapshot,
                and keep the schema compatible with existing progress before durable persistence lands.
              </p>
            </article>
            <article>
              <span className="jp-mark" aria-hidden="true">説明</span>
              <h2>AI from the scene</h2>
              <p>
                Explanations should attach to the exact word, line, and anime moment: memory hooks,
                tone notes, and review sentences, not generic chatbot practice.
              </p>
            </article>
            <article>
              <span className="jp-mark" aria-hidden="true">連続</span>
              <h2>Streaks and challenges</h2>
              <p>
                Weekly anime challenges, streaks, and opt-in leaderboards give learners momentum
                while preserving private local-only mode.
              </p>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
