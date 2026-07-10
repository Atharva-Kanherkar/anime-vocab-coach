import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FunnelTracker } from "@/components/funnel/funnel-track";
import { getEndingCreation } from "@/lib/ending-store";
import { SITE_URL } from "@/lib/site";

// Public share page for one generated ending. Every shared link is an ad:
// the reader sees a finished fan-art manga, then "Make YOUR ending" — which
// starts them at the top of the funnel on their own free credit.
//
// noindex: these are personal creations, not SEO surface.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const creation = await getEndingCreation(id.slice(0, 40));
  if (!creation) return { title: "Ending not found", robots: { index: false } };
  const title = `“${creation.title.en}” — a fan ending for ${creation.seriesTitle}`;
  const description = creation.logline || `A fan-made 5-panel manga ending for ${creation.seriesTitle}. How would YOU end it?`;
  const og = creation.done > 0 ? `${SITE_URL}/api/ending/${creation.id}/panel/0` : undefined;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/e/${creation.id}`,
      ...(og ? { images: [{ url: og, width: 1024, height: 1024 }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedEndingPage({ params }: Props) {
  const { id } = await params;
  const creation = await getEndingCreation(id.slice(0, 40));
  if (!creation || creation.done === 0) notFound();

  return (
    <div className="fnl-reader" style={{ ["--fnl-accent" as string]: creation.accent }}>
      <FunnelTracker event="share_view" />
      <header className="fnl-reader__title">
        <p className="fnl-reader__kicker">
          Fan ending · {creation.seriesTitle} <span className="fnl-badge">FAN ART</span>
        </p>
        <h1 className="fnl-reader__h2">{creation.title.en}</h1>
        {creation.title.sub && <p className="fnl-reader__sub">{creation.title.sub}</p>}
        {creation.logline && <p className="fnl-reader__logline">{creation.logline}</p>}
      </header>

      <ol className="fnl-reader__panels">
        {creation.panels.slice(0, creation.done).map((panel, i) => (
          <li key={i} className="fnl-reader__panelwrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="fnl-panel fnl-panel--art"
              src={`/api/ending/${creation.id}/panel/${i}`}
              alt={`Panel ${i + 1}: ${panel.scene.slice(0, 140)}`}
              loading={i > 0 ? "lazy" : "eager"}
            />
            {panel.lines.length > 0 && (
              <p className="fnl-panel__caption">
                {panel.lines
                  .map((l) => (l.speaker ? `${l.speaker}: “${l.text}”` : `“${l.text}”`))
                  .join("  ·  ")}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="fnl-endcard">
        <p className="fnl-endcard__fin">終 — THE END</p>
        <h2 className="fnl-endcard__h3">Someone ended {creation.seriesTitle} their way.</h2>
        <p className="fnl-endcard__sub">
          Now it’s your turn — pick a series, choose a finale, and watch your own 5-panel fan
          manga get drawn. The first one is free.
        </p>
        <div className="fnl-endcard__ctas">
          <Link className="fnl-btn fnl-btn--primary fnl-btn--big" href="/end">
            Make YOUR ending — free
          </Link>
        </div>
      </div>

      <p className="fnl-legal">
        Unofficial fan art / fan ending — fandom creative play. Not affiliated with the original
        publishers.
      </p>
    </div>
  );
}
