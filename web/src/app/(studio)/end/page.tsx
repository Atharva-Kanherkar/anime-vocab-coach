import type { Metadata } from "next";
import Link from "next/link";
import { EndingCatalog } from "@/components/app/ending-catalog";
import { DesktopChromeBanner } from "@/components/desktop-chrome-banner";
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
  "How would YOU end One Piece, Demon Slayer, Jujutsu Kaisen, and more? Pick a fan ending, get a free fan-art manga chapter on your phone.";

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
      "Yes for your first daily tries. Sign in free to save, publish, and keep creating.",
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
      <main id="main" className="mx-auto mt-6 w-full max-w-[720px] px-4 pb-28 md:mt-10 md:px-6">
        <EndingCatalog />
        <section className="end-min" style={{ marginTop: "2.5rem" }} aria-label="About fan endings">
          <h2 className="end-min__h1" style={{ fontSize: "1.25rem" }}>
            About these fan endings
          </h2>
          <p className="end-min__sub">
            Unofficial fan art epilogues. Full guide:{" "}
            <Link href="/fan-ending-manga" className="end-min__ghost" style={{ marginTop: 0 }}>
              fan ending manga hub
            </Link>
            . Or{" "}
            <Link href="/end/custom" className="end-min__ghost" style={{ marginTop: 0 }}>
              type any title
            </Link>
            .
          </p>
          {faqs.map((f) => (
            <div key={f.question} style={{ marginTop: "1.25rem" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 800, margin: 0 }}>{f.question}</h3>
              <p className="end-min__sub" style={{ marginTop: "0.35rem" }}>
                {f.answer}
              </p>
            </div>
          ))}
        </section>
      </main>
      <DesktopChromeBanner />
    </>
  );
}
