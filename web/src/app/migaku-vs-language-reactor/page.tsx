import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/migaku-vs-language-reactor";

export const metadata: Metadata = {
  title: "Is Migaku Better Than Language Reactor? (2026 Honest Compare)",
  description:
    "Is Migaku better than Language Reactor? Migaku wins for paid Anki mining depth. Language Reactor wins as a free Netflix/YouTube dual-sub reader. AnimeVocab covers beginners + Crunchyroll.",
  keywords: [
    "is migaku better than language reactor",
    "migaku vs language reactor",
    "language reactor vs migaku",
    "migaku or language reactor",
    "language reactor free alternative to migaku",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Migaku vs Language Reactor (2026)",
    description: "Paid mining suite vs free dual-sub reader — who each tool is for.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Migaku vs Language Reactor",
    description: "Which is better depends on reading level and whether you want Anki mining.",
  },
};

const faqs = [
  {
    question: "Is Migaku better than Language Reactor?",
    answer:
      "For power users who want deep Anki sentence mining and will pay, Migaku is better. For a free dual-subtitle companion on Netflix and YouTube when you can already read Japanese, Language Reactor is better. For beginners who need romaji or Crunchyroll without JP subs, AnimeVocab is better than both.",
  },
  {
    question: "Can Language Reactor replace Migaku?",
    answer:
      "For watching and looking up words on Netflix/YouTube, often yes. For Migaku’s full mining/SRS pipeline, no — you would add Anki (and often asbplayer/Yomitan) yourself.",
  },
  {
    question: "Is Language Reactor a free Migaku alternative?",
    answer:
      "Yes for the dual-sub immersion loop on supported sites. It is not a free Migaku alternative for Crunchyroll or for learners who cannot read Japanese subtitles yet.",
  },
];

export default function MigakuVsLanguageReactorPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Is Migaku Better Than Language Reactor? (2026 Honest Compare)"
        description="Migaku vs Language Reactor: paid Anki mining vs free dual-sub reader. When AnimeVocab is the better third option."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/migaku-free-alternative", label: "Migaku free alternative" },
            { label: "Migaku vs Language Reactor" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Is Migaku better than Language Reactor?"
          lede={
            <>
              Short answer: <strong>not for everyone</strong>. Migaku is the deeper paid mining suite. Language
              Reactor is the free dual-subtitle reader most people should try first on Netflix and YouTube. If
              you cannot read kana yet — or you watch Crunchyroll — start with{" "}
              <Link href="/migaku-free-alternative">AnimeVocab as a free Migaku alternative</Link> instead.
            </>
          }
          verdictTag="2026 pick"
          verdict={
            <>
              <strong>Readers on Netflix/YouTube:</strong> Language Reactor free tier.{" "}
              <strong>Anki miners who will pay:</strong> Migaku.{" "}
              <strong>Anime beginners / no JP track:</strong> AnimeVocab ({TIERS.free.priceLabel} core).
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
                    <th scope="col">Migaku</th>
                    <th scope="col">Language Reactor</th>
                    <th scope="col" className="us">
                      AnimeVocab
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Price</th>
                    <td>Trial → paid</td>
                    <td>Strong free · Pro extras</td>
                    <td className="us">Free core forever</td>
                  </tr>
                  <tr>
                    <th scope="row">Best job</th>
                    <td>Anki mining suite</td>
                    <td>Dual-sub reader</td>
                    <td className="us">Romaji + anime SRS</td>
                  </tr>
                  <tr>
                    <th scope="row">Netflix / YouTube</th>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Crunchyroll</th>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Needs JP reading?</th>
                    <td>Mostly yes</td>
                    <td>Yes for dual subs</td>
                    <td className="us">
                      <span className="no">No</span> (romaji-first)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>When Language Reactor wins</h2>
            <p>
              You can read Japanese (or are close), you live on Netflix/YouTube, and you want clickable dual
              subs without paying Migaku. See{" "}
              <Link href="/vs-language-reactor">AnimeVocab vs Language Reactor</Link>.
            </p>

            <h2>When Migaku wins</h2>
            <p>
              You already run Anki daily and want mining automation worth a subscription.{" "}
              <Link href="/blog/is-migaku-worth-it-2026">Is Migaku worth it?</Link> ·{" "}
              <Link href="/vs-migaku">vs Migaku</Link>.
            </p>

            <h2>When AnimeVocab wins</h2>
            <p>
              Month-zero Japanese, romaji-first cards, or Crunchyroll without a Japanese subtitle track — the
              gap both Migaku and Language Reactor leave open.
            </p>

            <h2>FAQ</h2>
            {faqs.map((f) => (
              <div key={f.question}>
                <h3>{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Not sure? Start free.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/migaku-free-alternative", label: "Migaku free alt" },
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: "/vs-migaku", label: "vs Migaku" },
          { href: "/anki-vs-migaku", label: "Anki vs Migaku" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
