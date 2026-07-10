"use client";

// The /end catalog — the funnel's storefront. One decision per screen:
// which series do you care about enough to end yourself?

import { useEffect, useState } from "react";
import Link from "next/link";
import { listEndingCatalog } from "@/lib/ending-hooks";
import { recallEnding } from "./ending-experience";

export function FunnelCatalog() {
  const catalog = listEndingCatalog().filter((m) => m.id !== "lantern-of-words");
  const [last, setLast] = useState<{ id: string; title: string; seriesTitle: string } | null>(null);
  useEffect(() => {
    // Deferred a frame so the localStorage read happens after hydration —
    // the returning-visitor line pops in without a server/client mismatch.
    const t = window.requestAnimationFrame(() => setLast(recallEnding()));
    return () => window.cancelAnimationFrame(t);
  }, []);

  return (
    <div className="fnl-catalog">
      <header className="fnl-catalog__head">
        <p className="fnl-kicker">
          Choose your ending <span className="fnl-badge">FAN ART</span>
        </p>
        <h1 className="fnl-h1 fnl-h1--hero">
          How would <em>YOU</em> end it?
        </h1>
        <p className="fnl-lede">
          Pick a series. Choose a finale. Watch an AI mangaka draw your 5-panel fan ending —
          dialogue, speech bubbles, the works. First one’s free.
        </p>
      </header>

      {last && (
        <p className="fnl-catalog__last">
          Welcome back — <Link href={`/e/${last.id}`}>re-read your “{last.title}”</Link>
        </p>
      )}

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
        <li>
          <Link href="/end/custom" className="fnl-card fnl-card--custom">
            <span className="fnl-card__tag">Any title</span>
            <span className="fnl-card__title">Your series isn’t here?</span>
            <span className="fnl-card__cliff">Type any manga — the AI invents three endings for it.</span>
            <span className="fnl-card__go">Type a title →</span>
          </Link>
        </li>
      </ul>

      <p className="fnl-legal">
        Unofficial fan art / fan endings — fandom creative play, like doujinshi. Not affiliated
        with the original publishers.
      </p>
    </div>
  );
}
