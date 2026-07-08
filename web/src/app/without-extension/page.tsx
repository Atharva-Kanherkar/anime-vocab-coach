import type { Metadata } from "next";
import Link from "next/link";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const TITLE = "Using AnimeVocab without the extension";
const DESC =
  "What works in the AnimeVocab web app without installing the Chrome extension — notebooks, the AI coach, streaks, cards, the manga saga, and your synced progress.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE_URL}/without-extension` },
  openGraph: { ...defaultOpenGraph, title: `${TITLE} | AnimeVocab`, description: DESC, url: `${SITE_URL}/without-extension` },
  twitter: { ...defaultTwitter, title: `${TITLE} | AnimeVocab` },
};

export default function WithoutExtensionPage() {
  return (
    <>
      <LandingJsonLd path="/without-extension" title={TITLE} description={DESC} />
      <SiteHeader compact />
      <main id="main">
        <section className="legal wrap narrow" style={{ paddingTop: 48 }}>
          <h1>Using AnimeVocab without the extension</h1>
          <p>
            The Chrome extension is the best way to learn — it watches alongside you and turns
            spoken lines into vocabulary. But you don&apos;t need it to get value from AnimeVocab.
            The <Link href="/app">Cloud app</Link> works on its own.
          </p>

          <h2>Waiting on the Chrome Web Store?</h2>
          <p>
            Chrome reviews every extension and update, which can take days. If the listing isn&apos;t
            live yet, or an update is pending review, nothing about your learning is blocked — sign
            in to the Cloud app and use everything below in the meantime. Your progress will be
            waiting for the extension once it&apos;s approved.
          </p>

          <h2>What works right now, no install</h2>
          <ul>
            <li><strong>Bring your words in.</strong> Export your progress from the extension (Settings → export), import the JSON in the Cloud app, and click <em>Sync to cloud</em>. Your dashboard and stats read from your synced data.</li>
            <li><strong>Track your progress.</strong> Your dashboard shows words learned, reviews due, and minutes studied from your synced history.</li>
            <li><strong>Notebooks.</strong> Save words, lines, and scenes into notebooks, organize them, and export them any time — this works from scratch, no import needed.</li>
            <li><strong>AI review summaries.</strong> Turn a notebook into weak-spots and review prompts.</li>
            <li><strong>See your streak, challenges &amp; the weekly leaderboard.</strong> View where you stand from your synced history.</li>
          </ul>

          <h2>What needs the extension</h2>
          <p>
            The extension is what <em>logs practice</em> — running your daily reviews and tracking
            minutes watched — so your streak, challenge progress, and leaderboard standing only move
            when you learn through it. It&apos;s also the only way to do live, in-video learning:
            pausing on words worth learning as you watch, and Listening Mode transcribing spoken
            Japanese on YouTube, Netflix, and Crunchyroll. Those capture what&apos;s on screen and in
            the audio, so they run in your browser via the extension.
          </p>

          <p style={{ marginTop: 32 }}>
            <Link className="btn btn-accent" href="/app">Open the Cloud app</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
