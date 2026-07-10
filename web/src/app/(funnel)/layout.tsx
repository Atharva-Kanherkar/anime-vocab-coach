import type { ReactNode } from "react";
import Link from "next/link";

// The Ending Funnel shell — deliberately NOT the Studio chrome and NOT the
// marketing site chrome. Visitors arrive from an Instagram reel; everything
// nonessential is gone. Always dark, always immersive, works from a 360px
// phone to a desktop monitor. Styles live in globals.css under "Ending
// Funnel" (.fnl-*). No server-side auth on these pages (they're outside the
// Clerk middleware allowlist — keep it that way; see middleware.ts).
export default function FunnelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fnl">
      <div className="fnl__bg" aria-hidden />
      <header className="fnl__top">
        <Link href="/" className="fnl__brand">
          AnimeVocab
        </Link>
        <span className="fnl__fanart">unofficial fan art</span>
      </header>
      <main id="main" className="fnl__main">
        {children}
      </main>
      <footer className="fnl__foot">
        <span>
          Fan-made endings, drawn by AI. Not affiliated with the original publishers or studios.
        </span>
        <span>
          <Link href="/privacy">Privacy</Link> · <a href="https://animevocab.com">animevocab.com</a>
        </span>
      </footer>
    </div>
  );
}
