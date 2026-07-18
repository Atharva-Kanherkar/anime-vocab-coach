import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/lingopie-alternative";

export const metadata: Metadata = {
  title: "Lingopie Alternative for Anime (2026): Learn on Streams You Already Pay For",
  description:
    "Best Lingopie alternative for anime fans: AnimeVocab on Netflix, Crunchyroll, and YouTube — romaji-first cards + Listening Mode. Honest comparison when Lingopie still wins.",
  keywords: [
    "lingopie alternative",
    "lingopie alternative anime",
    "lingopie japanese",
    "lingopie vs language reactor",
    "learn japanese anime streaming",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Lingopie Alternative for Anime (2026)",
    description:
      "Lingopie costs ~$12/mo with a curated library. AnimeVocab works on Netflix, Crunchyroll, and YouTube you already pay for.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Lingopie Alternative for Anime (2026)",
    description:
      "Free Lingopie alternative for anime — romaji cards on Netflix, Crunchyroll, and YouTube.",
  },
};

const faqs = [
  {
    question: "What is the best Lingopie alternative for anime?",
    answer:
      "If you already subscribe to Netflix, Crunchyroll, or YouTube and want romaji-first vocabulary from tonight's episode, AnimeVocab is the best Lingopie alternative. If you want a curated multi-language streaming library with built-in lessons, Lingopie still wins.",
  },
  {
    question: "Is Lingopie worth it for Japanese anime?",
    answer:
      "Lingopie is worth it if you want an all-in-one catalog and do not mind ~$12/month. For Japanese specifically, the anime selection is thinner than general marketing suggests — and you cannot use it on Crunchyroll simulcasts. See our honest review: /blog/is-lingopie-good-for-japanese-2026.",
  },
  {
    question: "Does AnimeVocab replace Lingopie?",
    answer:
      "No. AnimeVocab is not a streaming service. It is a Chrome extension that teaches vocabulary from streams you already watch — romaji-first cards, built-in SRS, and Listening Mode when Japanese subs are missing. Lingopie bundles content + lessons in one app.",
  },
  {
    question: "Lingopie vs AnimeVocab — which should I use?",
    answer:
      "Lingopie wins for learners who want a curated library, click-to-translate across languages, and do not already pay for Netflix/Crunchyroll. AnimeVocab wins for anime fans on existing subscriptions who need romaji on-ramp and Crunchyroll nights without JP subs.",
  },
  {
    question: "Is there a free Lingopie alternative?",
    answer:
      "Yes. AnimeVocab's core cards and local SRS are free forever on Netflix, Crunchyroll, and YouTube. Language Reactor's free tier is another option if you already read Japanese on Netflix/YouTube.",
  },
];

export default function LingopieAlternativePage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Lingopie Alternative for Anime (2026): Learn on Streams You Already Pay For"
        description="Best Lingopie alternative for anime fans: AnimeVocab on Netflix, Crunchyroll, and YouTube — romaji-first cards + Listening Mode."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "Lingopie alternative" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Lingopie alternative (2026)"
          lede={
            <>
              Searching <strong>lingopie alternative</strong>? Lingopie is a ~$12/mo language-learning
              streamer with a curated catalog — it markets anime, but most fans already pay for{" "}
              <strong>Netflix, Crunchyroll, or YouTube</strong>. <strong>AnimeVocab</strong> is the free
              alternative that meets you on those streams: romaji-first word cards + Listening Mode when JP
              subs are missing.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>Want a bundled library + multi-language lessons?</strong> Lingopie can still win.{" "}
              <strong>Already subscribed to anime streams / need romaji tonight?</strong> AnimeVocab. Deep
              dive:{" "}
              <Link href="/blog/is-lingopie-good-for-japanese-2026">Is Lingopie good for Japanese?</Link>
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>What Lingopie is good at</h2>
            <p>
              Lingopie bundles <strong>curated shows</strong> with click-to-translate, flashcards, and
              progress tracking across several languages — not just Japanese. If you want one app that ships
              content and lessons together, the subscription makes sense. It is also honest dual-language
              learning beyond JP: Spanish, Korean, and more live in the same product.
            </p>

            <h2>When you need a Lingopie alternative</h2>
            <ul>
              <li>
                <strong>You already pay for Crunchyroll or Netflix</strong> — paying twice for anime feels
                wasteful.
              </li>
              <li>
                <strong>You want tonight&apos;s simulcast</strong> — Lingopie&apos;s catalog does not track weekly CR
                releases.
              </li>
              <li>
                <strong>You cannot read Japanese subtitles yet</strong> — Lingopie assumes you can engage
                with on-screen text.
              </li>
              <li>
                <strong>Crunchyroll has no JP track</strong> — Listening Mode still works from audio;
                curated libraries stall.
              </li>
              <li>
                <strong>You want free built-in SRS</strong> — review without another subscription layer.
              </li>
            </ul>

            <h2>Lingopie alternatives compared</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Job</th>
                    <th scope="col">Monthly cost</th>
                    <th scope="col">Your Netflix/CR/YT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab</strong>
                    </td>
                    <td>Romaji cards + Listening Mode on your streams</td>
                    <td>
                      <span className="yes">{TIERS.free.priceLabel} core</span>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Lingopie</td>
                    <td>Curated library + click-to-translate lessons</td>
                    <td>~$12/mo</td>
                    <td>
                      <span className="no">Separate catalog</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Language Reactor</td>
                    <td>Netflix/YouTube dual-sub reader</td>
                    <td>
                      <span className="yes">Free tier</span>
                    </td>
                    <td>
                      <span className="yes">Netflix/YT</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Animelon</td>
                    <td>Free interactive JP subs (limited catalog)</td>
                    <td>
                      <span className="yes">Free</span>
                    </td>
                    <td>
                      <span className="no">Own site only</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>AnimeVocab as your Lingopie alternative for anime</h2>
            <p>
              Install once. Watch the anime you already subscribe to. Get one useful word per line in romaji.
              Review with built-in SRS ({TIERS.free.priceLabel} forever for the core loop). When Japanese
              subtitle text is missing — common on Crunchyroll — Listening Mode works from audio. Compare
              stacks:{" "}
              <Link href="/blog/language-reactor-vs-lingopie-2026">Language Reactor vs Lingopie</Link>.
            </p>

            <h2>Related pages</h2>
            <ul>
              <li>
                <Link href="/blog/is-lingopie-good-for-japanese-2026">Is Lingopie good for Japanese? (2026)</Link>
              </li>
              <li>
                <Link href="/language-reactor-alternative">Language Reactor alternative</Link>
              </li>
              <li>
                <Link href="/animelon-alternative">Animelon alternative</Link>
              </li>
              <li>
                <Link href="/learn-japanese-crunchyroll">Learn Japanese on Crunchyroll</Link>
              </li>
              <li>
                <Link href="/free-japanese-anime-extension">Free Japanese anime extension</Link>
              </li>
            </ul>

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
            <h2>Already paying for anime streams? Start there.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/language-reactor-alternative", label: "LR alternative" },
          { href: "/animelon-alternative", label: "Animelon alt" },
          { href: "/asbplayer-alternative", label: "asbplayer alt" },
          { href: "/learn-japanese-with-anime", label: "Compare hub" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
