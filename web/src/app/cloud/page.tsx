import type { Metadata } from "next";
import Link from "next/link";
import { AuthControls, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getPromoState, GITHUB_URL, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "AnimeVocab Cloud | Optional sync and AI for anime Japanese learning",
  description:
    "AnimeVocab Cloud is the optional hosted companion to the local-first Chrome extension: sync, AI scene explanations, notebooks, and social learning without making accounts mandatory.",
  alternates: { canonical: `${SITE_URL}/cloud` },
};

export default function CloudPage() {
  const promo = getPromoState();

  return (
    <>
      <SiteHeader />
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
                <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
                  Install free extension
                </a>
                <AuthControls />
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
                and keep the schema compatible with existing progress as you sync to your account.
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

        <section className="cloud-pro-band">
          <div className="wrap cloud-pro-grid">
            <div>
              <p className="eyebrow">AnimeVocab Pro</p>
              <h2>Cloud sync, AI coach, and social features — when you want them</h2>
              <p className="cloud-lede">
                Pro pays for hosted transcription and Cloud compute. The extension stays free forever;
                accounts are optional until sync or AI actually help you.
              </p>
            </div>
            <div className="cloud-pro-actions">
              {promo.checkoutConfigured ? (
                <a className="btn btn-accent" href={promo.checkoutUrl} rel="noopener noreferrer">
                  {promo.active ? "Get Pro at launch price" : "Get Pro"}
                </a>
              ) : (
                <span className="btn btn-accent" aria-disabled="true" style={{ opacity: 0.6, cursor: "default" }}>
                  Pro coming soon
                </span>
              )}
              <Link className="btn btn-line" href="/#pricing">
                Compare Free vs Pro
              </Link>
              <Link className="btn btn-line" href="/app">
                Open Cloud app
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
