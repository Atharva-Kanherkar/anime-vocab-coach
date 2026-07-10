import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SITE_URL } from "@/lib/site";
import {
  defaultOpenGraph,
  defaultTwitter,
  faqJsonLd,
  STUDIO_DESCRIPTION,
  studioJsonLd,
} from "@/lib/seo";

const path = "/ai-manga-maker";

export const metadata: Metadata = {
  title: "AI Manga Maker — Create Manga Online Free (2026)",
  description:
    "Free AI manga maker: type a premise, get a full chapter with cast and panel art. Edit dialogue, redraw panels, sketch and AI-beautify. No drawing skills. Try Manga Studio free.",
  keywords: [
    "ai manga maker",
    "ai manga generator",
    "create manga online free",
    "manga maker online",
    "make manga with AI",
    "manga creator online",
    "free manga generator",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AI Manga Maker — Create Manga Online Free",
    description: STUDIO_DESCRIPTION,
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AI Manga Maker — AnimeVocab Manga Studio",
    description: STUDIO_DESCRIPTION,
  },
};

const faqs = [
  {
    question: "Is this AI manga maker free?",
    answer:
      "Yes — you can draft and edit a manga in your browser without an account. Anonymous users get limited daily generations; signing in (free) saves your work and unlocks publishing to the public gallery.",
  },
  {
    question: "Do I need drawing skills?",
    answer:
      "No. Describe your story premise and the AI drafts the chapter — cast, panel beats, and dialogue. You can also hand-draw a rough sketch on any panel and have the AI redraw it in your chosen manga style.",
  },
  {
    question: "How is this different from other AI manga generators?",
    answer:
      "Most tools bake text into the image (garbled Japanese, no edits). Manga Studio renders dialogue as styled bubbles in the reader so you can rewrite any line. Each panel is a separate image so you can redraw panel 3 without regenerating the whole page.",
  },
  {
    question: "Can I publish my manga?",
    answer:
      "Yes. After signing in (free), publish to the public gallery at animevocab.com/gallery. Each manga gets a shareable link at /m/your-id.",
  },
  {
    question: "What art styles are available?",
    answer:
      "Multiple manga art styles — shounen, shoujo, slice-of-life, and more. Switch style per panel or regenerate individual panels until they match your vision.",
  },
];

export default function AiMangaMakerPage() {
  const jsonLd = studioJsonLd();
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/studio", label: "Manga Studio" },
            { label: "AI manga maker" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AI manga maker — create manga online free"
          lede={
            <>
              <strong>Manga Studio</strong> is a free web <strong>AI manga maker</strong>. Type a premise —
              genre, tone, setting — and get a full chapter: recurring cast, panel-by-panel art, and real manga
              dialogue (speech, thought, narration, SFX). Edit any line. Redraw any panel. Sketch rough and let
              the AI finish it. No Clip Studio, no drawing tablet, no credit card to try.
            </>
          }
          verdictTag="Why learners pick it"
          verdict={
            <>
              Unlike single-image <strong>AI manga generators</strong> that lock text inside the art, dialogue
              renders as editable bubbles — including Japanese. That makes it useful for{" "}
              <Link href="/learn-japanese-manga">learning Japanese by writing manga</Link>, not just posting
              pretty pictures.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>How the AI manga maker works</h2>
            <ol>
              <li>
                <strong>Compose</strong> — pick target vocabulary (optional), art style, and write your story
                beats in plain language.
              </li>
              <li>
                <strong>Draft</strong> — AI writes the chapter as structured JSON: cast descriptions, per-panel
                scene beats, and dialogue lines.
              </li>
              <li>
                <strong>Art</strong> — one image per panel (not one baked grid), so you can regenerate panel 4
                without touching panel 1.
              </li>
              <li>
                <strong>Edit</strong> — rewrite dialogue, reorder panels, or open the sketch pad and draw a rough
                — the AI redraws it in your style.
              </li>
              <li>
                <strong>Publish</strong> — share to the{" "}
                <Link href="/gallery">public gallery</Link> or keep private in your account.
              </li>
            </ol>

            <h2>AI manga maker comparison (2026)</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Editable dialogue</th>
                    <th scope="col">Per-panel redraw</th>
                    <th scope="col">Sketch input</th>
                    <th scope="col">Free to try</th>
                    <th scope="col">JP learning angle</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab Manga Studio</strong>
                    </td>
                    <td>Yes — bubbles in reader</td>
                    <td>Yes</td>
                    <td>Yes</td>
                    <td>Yes, no account</td>
                    <td>Vocab + word check XP</td>
                  </tr>
                  <tr>
                    <td>MangaMaker.com</td>
                    <td>Limited</td>
                    <td>Per panel</td>
                    <td>Photo upload</td>
                    <td>Yes</td>
                    <td>No</td>
                  </tr>
                  <tr>
                    <td>Manga AI</td>
                    <td>Prompt edit</td>
                    <td>Page redraw</td>
                    <td>No</td>
                    <td>Yes</td>
                    <td>No</td>
                  </tr>
                  <tr>
                    <td>Comicory</td>
                    <td>Canvas editor</td>
                    <td>Yes</td>
                    <td>Character refs</td>
                    <td>Trial</td>
                    <td>No</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>Who this AI manga generator is for</h2>
            <ul>
              <li>
                <strong>Storytellers who cannot draw</strong> — you write the plot; AI handles linework and
                panel layout.
              </li>
              <li>
                <strong>Anime fans learning Japanese</strong> — weave target vocab into dialogue and pass word
                checks for XP. See our{" "}
                <Link href="/learn-japanese-manga">learn Japanese with manga guide</Link>.
              </li>
              <li>
                <strong>Fandom creators</strong> — write an unofficial{" "}
                <Link href="/fan-ending-manga">fan ending</Link> for a series you love, then edit the chapter in
                Studio. Catalog: <Link href="/end">choose your ending</Link>.
              </li>
              <li>
                <strong>OC creators</strong> — build a cast with consistent looks across every panel, publish to
                the gallery, share at <code>/m/your-id</code>.
              </li>
            </ul>

            <h2>FAQ</h2>
            {faqs.map((f) => (
              <div key={f.question}>
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}

            <p>
              Also read:{" "}
              <Link href="/blog/ai-manga-maker-free-online-2026">AI manga maker deep dive</Link>,{" "}
              <Link href="/blog/ai-manga-generator-comparison-2026">generator comparison</Link>,{" "}
              <Link href="/learn-japanese-with-anime">learn Japanese from anime</Link>.
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Make your first manga chapter now.</h2>
            <p style={{ color: "var(--ink-2)", marginBottom: 18 }}>
              Free in the browser — no account required to draft. Sign in to save and publish.
            </p>
            <Link className="btn btn-accent" href="/studio">
              Open Manga Studio →
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/studio", label: "Studio" },
          { href: "/gallery", label: "Gallery" },
          { href: "/blog", label: "Blog" },
          { href: "/learn-japanese-manga", label: "Learn with manga" },
        ]}
      />
    </>
  );
}
