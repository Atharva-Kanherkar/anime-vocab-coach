import type { Metadata } from "next";
import Link from "next/link";
import { FunnelCatalog } from "@/components/funnel/funnel-catalog";
import { FunnelTracker } from "@/components/funnel/funnel-track";
import { listEndingCatalog } from "@/lib/ending-hooks";
import { SITE_URL } from "@/lib/site";
import {
  defaultOpenGraph,
  defaultTwitter,
  endingCatalogJsonLd,
  faqJsonLd,
} from "@/lib/seo";

const title = "Choose your ending — fan art epilogues";
const description =
  "How would YOU end One Piece, Demon Slayer, Jujutsu Kaisen, and more? Pick a fan ending and watch an AI mangaka draw your own 5-panel manga — free.";

const faqs = [
  {
    question: "Are these official endings?",
    answer:
      "No. These are unofficial fan endings / fan art for creative play — not affiliated with the original publishers.",
  },
  {
    question: "Can I write an ending for any manga?",
    answer:
      "Yes. Use a series in this catalog, or open the custom page and type any title to invent three fan endings.",
  },
  {
    question: "Is it free?",
    answer:
      "Yes — your first fan ending is free. Watch a 5-panel fan-art manga draw itself on the page.",
  },
];

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "choose your ending manga",
    "fan ending manga",
    "fan art manga",
    "one piece fan ending",
    "demon slayer fan ending",
  ],
  alternates: { canonical: `${SITE_URL}/end` },
  openGraph: { ...defaultOpenGraph, title, description, url: `${SITE_URL}/end` },
  twitter: { ...defaultTwitter, title, description },
};

export default function EndCatalogPage() {
  const catalog = listEndingCatalog();
  const collectionLd = endingCatalogJsonLd(
    catalog.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.cliffhanger,
    }))
  );
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <FunnelTracker event="land_end" />
      <FunnelCatalog />
      <section className="fnl-seo-faq" aria-label="About fan endings">
        <h2 className="fnl-h1" style={{ fontSize: "1.15rem", marginTop: 28 }}>
          About these fan endings
        </h2>
        <p className="fnl-lede" style={{ marginTop: 8 }}>
          Unofficial fan art epilogues. Full guide:{" "}
          <Link href="/fan-ending-manga">fan ending manga hub</Link>
          {" · "}
          <Link href="/end/custom">type any title</Link>.
        </p>
        {faqs.map((f) => (
          <div key={f.question} style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{f.question}</h3>
            <p className="fnl-lede" style={{ marginTop: 4, fontSize: 13.5 }}>
              {f.answer}
            </p>
          </div>
        ))}
      </section>
    </>
  );
}
