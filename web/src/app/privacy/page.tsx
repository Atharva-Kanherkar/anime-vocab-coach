import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "AnimeVocab privacy policy: learning progress stays in your browser by default. Cloud sync is opt-in. Aggregate rating-prompt counters only — no ads, no selling of data.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    ...defaultOpenGraph,
    title: "Privacy Policy | AnimeVocab",
    description:
      "AnimeVocab privacy policy: learning progress stays in your browser by default. Cloud sync is opt-in. Aggregate rating-prompt counters only — no ads, no selling of data.",
    url: `${SITE_URL}/privacy`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Privacy Policy | AnimeVocab",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader compact />
      <main id="main">
        <section className="legal wrap narrow" style={{ paddingTop: 48 }}>
          <h1>Privacy Policy</h1>
          <p className="date" style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 40 }}>
            Last updated: July 17, 2026
          </p>

          <p>
            AnimeVocab is a browser extension that helps you learn Japanese vocabulary from
            videos you watch. This policy explains exactly what it does with data.
          </p>

          <h2>What stays on your device</h2>
          <ul>
            <li>
              <b>Your vocabulary progress, settings, and statistics</b> are stored locally in
              your browser. The extension never uploads them unless you opt into cloud sync.
            </li>
            <li>
              <b>Your OpenAI API key</b> (only if you use bring-your-own-key Listening Mode) is
              stored locally and sent only to OpenAI&apos;s API to transcribe audio.
            </li>
            <li>
              <b>Your Pro license key</b> (only if you subscribe) is stored locally and sent only
              to the AnimeVocab licensing server to verify your subscription and meter listening
              hours.
            </li>
          </ul>

          <h2>What leaves your device (Listening Mode)</h2>
          <ul>
            <li>
              The current tab&apos;s <b>audio</b> is streamed to OpenAI&apos;s transcription API
              solely to convert Japanese speech into text for vocabulary detection. Audio goes
              directly from your browser to OpenAI; it is not recorded or stored by AnimeVocab.
            </li>
            <li>
              With a Pro subscription, the extension additionally sends your <b>license key and
              listening minute counts</b> (numbers only) to the licensing server to enforce the
              monthly fair-use cap.
            </li>
            <li>Nothing is captured when Listening Mode is off.</li>
          </ul>

          <h2>Anonymous product counters</h2>
          <ul>
            <li>
              When the extension shows the in-product Chrome Web Store rating prompt (or you
              click Rate), it sends a tiny allowlisted event name such as{" "}
              <code>review_prompt_shown</code> plus the extension id to{" "}
              <code>animevocab.com</code>. These are aggregate counters only — no account id,
              vocabulary, or browsing history.
            </li>
            <li>
              There is no separate opt-out toggle for these counters; dismissing the prompt
              (&quot;No thanks&quot; / Rate) stops further prompts and thus further beacons.
              The endpoint rate-limits by IP and only accepts requests that present as our
              Chrome extension (a public id, not a secret).
            </li>
          </ul>

          <h2>What it never does</h2>
          <ul>
            <li>No advertising, no selling of data, and no profiles built from your vocab.</li>
            <li>
              Cloud sync and accounts are opt-in (sign in on animevocab.com); local-only use
              never creates an account.
            </li>
            <li>
              It reads only the video sites it supports, and only to find subtitle text and the
              video element.
            </li>
          </ul>

          <h2>Payments</h2>
          <p>
            Pro subscriptions are processed by <b>Dodo Payments</b>, our merchant of record. Your
            payment details go to them, not to us; their{" "}
            <a href="https://dodopayments.com/privacy" rel="noopener noreferrer">
              privacy policy
            </a>{" "}
            applies to checkout. We receive only the license key status needed to unlock Pro
            features.
          </p>

          <h2>Open source</h2>
          <p>
            The extension&apos;s complete source code is public at{" "}
            <a href={GITHUB_URL} rel="noopener noreferrer">
              github.com/Atharva-Kanherkar/anime-vocab-coach
            </a>
            , so every claim on this page can be verified.
          </p>

          <h2>Contact</h2>
          <p>
            Questions: open an issue on the{" "}
            <a href={GITHUB_URL} rel="noopener noreferrer">
              GitHub repository
            </a>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
