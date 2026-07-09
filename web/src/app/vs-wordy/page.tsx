import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/vs-wordy";

export const metadata: Metadata = {
  title: "AnimeVocab vs Wordy (2026): Your Stream vs Curated Anime Clips",
  description:
    "Wordy offers curated Japanese anime clips with translations and SRS. AnimeVocab learns from the Crunchyroll, Netflix, and YouTube shows you already watch — romaji-first.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AnimeVocab vs Wordy (2026)",
    description:
      "Wordy is a curated clip library. AnimeVocab is a stream overlay for tonight's episode. Different products, honest comparison.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab vs Wordy (2026)",
    description: "Curated clips vs learn-from-your-stream — which anime Japanese path fits?",
  },
};

export default function VsWordyPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="AnimeVocab vs Wordy (2026): Your Stream vs Curated Anime Clips"
        description="Wordy offers curated Japanese anime clips with translations and SRS. AnimeVocab learns from the Crunchyroll, Netflix, and YouTube shows you already watch — romaji-first."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "vs Wordy" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AnimeVocab vs Wordy"
          lede={
            <>
              <strong>Wordy</strong> is a mobile-first library of curated Japanese clips with translations and
              review — you study their catalog. <strong>AnimeVocab</strong> is a Chrome extension that turns{" "}
              <strong>the episode you already opened</strong> on Crunchyroll, Netflix, or YouTube into
              romaji-first vocabulary cards with built-in SRS.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Want a ready clip library on your phone?</strong> Wordy.{" "}
              <strong>Want tonight&apos;s simulcast to teach you a word?</strong> AnimeVocab. Many learners use
              both — Wordy for structured minutes, AnimeVocab for immersion while bingeing.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">&nbsp;</th>
                    <th scope="col" className="us">
                      AnimeVocab
                    </th>
                    <th scope="col">Wordy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Content source</th>
                    <td className="us">Your Netflix / CR / YouTube</td>
                    <td>Curated clip library</td>
                  </tr>
                  <tr>
                    <th scope="row">Form factor</th>
                    <td className="us">Chrome extension</td>
                    <td>Mobile / web app</td>
                  </tr>
                  <tr>
                    <th scope="row">Romaji-first</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>Translations in-app</td>
                  </tr>
                  <tr>
                    <th scope="row">Crunchyroll simulcasts</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">catalog clips only</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Built-in SRS</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td>Free tier · paid plans</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="wrap prose" style={{ paddingInline: 0, marginTop: 24 }}>
              <h2>When Wordy wins</h2>
              <p>
                You want short, graded Japanese video practice without opening a streaming site. Wordy&apos;s
                library + SRS is a clean daily habit on mobile — especially if you do not have a Crunchyroll
                subscription tonight.
              </p>
              <h2>When AnimeVocab wins</h2>
              <p>
                Your motivation is <strong>the show you already love</strong>. Vocabulary sticks to scenes you
                care about. Listening Mode still works when JP subs are missing. Free install:{" "}
                <Link href="/free-japanese-anime-extension">free Japanese anime extension</Link>. Full ranking:{" "}
                <Link href="/blog/best-apps-learn-japanese-anime-2026">best apps 2026</Link>.
              </p>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Learn from the anime you already opened.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/best-apps-learn-japanese-anime-2026", label: "Best apps ranking" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
