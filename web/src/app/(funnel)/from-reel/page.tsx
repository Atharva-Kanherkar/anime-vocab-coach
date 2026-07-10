import type { Metadata } from "next";
import Link from "next/link";
import { FunnelTracker } from "@/components/funnel/funnel-track";
import { listEndingCatalog } from "@/lib/ending-hooks";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

// The Instagram / Meta ad landing. One job: get the visitor from the reel
// into a series pick in a single tap. Immersive funnel shell, phone-first,
// but a real layout on tablet/desktop too (ads get plenty of both).

const path = "/from-reel";
const title = "How would YOU end it? | AnimeVocab";
const description =
  "Pick a series, choose a finale, and watch an AI mangaka draw your own 5-panel fan-art manga — dialogue and all. First ending free, right in your browser.";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: { ...defaultOpenGraph, title: "How would YOU end it?", description, url: `${SITE_URL}${path}` },
  twitter: { ...defaultTwitter, title: "How would YOU end it?", description },
};

export default function FromReelPage() {
  const catalog = listEndingCatalog().filter((m) => m.id !== "lantern-of-words").slice(0, 8);

  return (
    <div className="fnl-catalog">
      <FunnelTracker event="land_reel" />

      <header className="fnl-catalog__head">
        <p className="fnl-kicker">
          You saw the reel <span className="fnl-badge">FAN ART</span>
        </p>
        <h1 className="fnl-h1 fnl-h1--hero">
          How would <em>YOU</em> end it?
        </h1>
        <p className="fnl-lede">
          The finale you actually wanted — as a real manga. Pick a series, choose one of three fan
          endings (or add your own twist), and watch five panels get drawn in front of you, speech
          bubbles and all. <strong>Your first ending is free.</strong>
        </p>
        <div className="fnl-hero-ctas">
          <Link className="fnl-btn fnl-btn--primary fnl-btn--big" href="/end">
            Choose your ending →
          </Link>
          <Link className="fnl-btn fnl-btn--ghost" href="/end/custom">
            Type any manga
          </Link>
        </div>
      </header>

      <section className="fnl-steps" aria-label="How it works">
        <div className="fnl-steps__item">
          <span className="fnl-steps__num">1</span>
          <strong>Pick your series</strong>
          <span>One Piece, Demon Slayer, JJK, AoT…</span>
        </div>
        <div className="fnl-steps__item">
          <span className="fnl-steps__num">2</span>
          <strong>Choose the finale</strong>
          <span>Three fan endings + your twist</span>
        </div>
        <div className="fnl-steps__item">
          <span className="fnl-steps__num">3</span>
          <strong>Watch it get drawn</strong>
          <span>5 manga panels, dialogue lettered in</span>
        </div>
      </section>

      <ul className="fnl-grid">
        {catalog.map((m) => (
          <li key={m.id}>
            <Link
              href={`/end/${m.id}`}
              className="fnl-card"
              style={{ ["--fnl-accent" as string]: m.accent }}
            >
              <span className="fnl-card__tag">{m.tag}</span>
              <span className="fnl-card__title">{m.title}</span>
              <span className="fnl-card__jp">{m.subtitle}</span>
              <span className="fnl-card__cliff">{m.cliffhanger}</span>
              <span className="fnl-card__go">End it →</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="fnl-fine" style={{ textAlign: "center" }}>
        No app. No sign-up for the first one. Works on this phone, a tablet, or a laptop.
      </p>
      <p className="fnl-legal">
        Unofficial fan art / fan endings — fandom creative play, like doujinshi. Not affiliated
        with the original publishers.
      </p>
    </div>
  );
}
