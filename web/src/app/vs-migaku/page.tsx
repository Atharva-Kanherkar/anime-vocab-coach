import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/vs-migaku";

export const metadata: Metadata = {
  title: "AnimeVocab vs Migaku (2026) — Free Alternative or Paid Mining Suite?",
  description:
    "AnimeVocab vs Migaku: free romaji-first beginner tool vs paid Anki mining suite. Pricing, Crunchyroll gap, and who each is for. Best free Migaku alternative for anime.",
  keywords: [
    "animevocab vs migaku",
    "migaku vs animevocab",
    "migaku alternative",
    "migaku free alternative",
    "is migaku worth it",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AnimeVocab vs Migaku (2026)",
    description:
      "Migaku is the power-user mining suite. AnimeVocab is the free, zero-setup, romaji-first beginner on-ramp.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab vs Migaku (2026)",
    description:
      "Migaku is the power-user mining suite. AnimeVocab is the free, zero-setup, romaji-first beginner on-ramp.",
  },
};

const faqs = [
  {
    question: "Is AnimeVocab a free Migaku alternative?",
    answer:
      "Yes for beginners learning from anime. AnimeVocab gives free romaji-first cards and built-in SRS without Migaku's subscription. It is not a 1:1 clone of Migaku's Anki mining depth — see the dedicated Migaku free alternative page for the full map.",
  },
  {
    question: "Is Migaku worth it in 2026?",
    answer:
      "Yes if you already mine daily, can read kana, and want deep Anki automation. No if you want a free month-zero habit on Crunchyroll tonight — start with AnimeVocab instead.",
  },
  {
    question: "Does Migaku work on Crunchyroll?",
    answer:
      "No. Migaku does not support Crunchyroll. AnimeVocab Listening Mode does. That alone is why many anime fans search for a Migaku alternative.",
  },
  {
    question: "AnimeVocab vs Migaku — which should beginners pick?",
    answer:
      "Beginners should pick AnimeVocab: install and go, romaji-first, free core SRS. Pick Migaku later if you outgrow built-in review and want a full mining suite.",
  },
];

export default function VsMigakuPage() {
  const faqLd = faqJsonLd(faqs);

  return (
    <>
      <LandingJsonLd
        path={path}
        title="AnimeVocab vs Migaku (2026) — Free Alternative or Paid Mining Suite?"
        description="AnimeVocab vs Migaku: free romaji-first beginner tool vs paid Anki mining suite. Pricing, Crunchyroll gap, and who each is for."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "vs Migaku" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AnimeVocab vs Migaku"
          lede={
            <>
              These aren&apos;t really the same category of tool. Migaku is a{" "}
              <strong>power-user immersion suite</strong>, the most capable browser-based sentence-mining
              setup in 2026. AnimeVocab is a <strong>free Migaku alternative</strong> for someone who just
              started and can&apos;t read kana yet — zero setup, romaji-first, built-in SRS.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>AnimeVocab is the one most people will actually keep open.</strong> Migaku goes deeper
              if you want to build and drill a custom Anki deck and will spend an afternoon wiring it up. If
              you just want to learn from tonight&apos;s episode (no setup, no subscription, no kana course
              first), that&apos;s AnimeVocab. Dedicated guide:{" "}
              <Link href="/migaku-free-alternative">Migaku free alternative</Link>.
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
                    <th scope="col">Migaku</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Best for</th>
                    <td className="us">Beginners; low-friction daily watching</td>
                    <td>Committed learners building Anki decks</td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">Free · Pro {TIERS.pro.priceLabel}</td>
                    <td>~$9/mo or $87/yr · $399 lifetime</td>
                  </tr>
                  <tr>
                    <th scope="row">Free tier</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                      <span className="cell-note">Core cards + SRS free forever</span>
                    </td>
                    <td>Trial, then subscription</td>
                  </tr>
                  <tr>
                    <th scope="row">Setup effort</th>
                    <td className="us">
                      <span className="yes">Install and go</span>
                    </td>
                    <td>Higher (extension + Anki + config)</td>
                  </tr>
                  <tr>
                    <th scope="row">Romaji-first for total beginners</th>
                    <td className="us">
                      <span className="yes">Yes</span> (default)
                    </td>
                    <td>Furigana available; aimed past pure beginners</td>
                  </tr>
                  <tr>
                    <th scope="row">Works from audio on Netflix &amp; Crunchyroll</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                      <span className="cell-note">Listening Mode transcribes audio</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">
                        AI subs cover YouTube/podcasts, not Netflix; no Crunchyroll
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Anki mining depth</th>
                    <td className="us">Built-in SRS, no Anki needed</td>
                    <td>
                      <span className="yes">Deep</span> (its core strength)
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Grammar / sentence study</th>
                    <td className="us">Vocabulary-focused</td>
                    <td>
                      <span className="yes">Broader</span> (grammar, sentences)
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Maturity</th>
                    <td className="us">New (2026)</td>
                    <td>
                      <span className="yes">Established</span>, years of iteration
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Languages</th>
                    <td className="us">Japanese only</td>
                    <td>Japanese + several others</td>
                  </tr>
                  <tr>
                    <th scope="row">Open source · data local</th>
                    <td className="us">
                      <span className="yes">Yes</span> · <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span> · account-based
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>Who Migaku is actually for</h2>
            <p>
              Migaku is a serious piece of machinery, and for one specific person it&apos;s the best there
              is: the committed learner who wants to mine sentences into Anki, tune card templates, and run
              immersion as a system. If that&apos;s genuinely you, the depth pays off.
            </p>
            <p>
              But that&apos;s a narrow crowd. Most people who want to learn Japanese from anime aren&apos;t looking
              to take up flashcard database management as a second hobby. They want to watch the show and
              come away knowing words. Migaku asks that person to pay a subscription and sit through setup
              for power they&apos;ll never open.
            </p>

            <h2>Why AnimeVocab is the better free Migaku alternative</h2>
            <p>
              AnimeVocab makes the opposite bet: everything works the second you install it, and the things
              a beginner actually needs are the defaults, not the advanced settings.
            </p>
            <ul>
              <li>
                <strong>No setup.</strong> No Anki install, no card templates, no config. Add to Chrome, press
                play, judge a word.
              </li>
              <li>
                <strong>Free to actually learn.</strong> The word cards and spaced repetition are free
                forever. You only pay if you want hands-off audio transcription.
              </li>
              <li>
                <strong>Doesn&apos;t assume you can read.</strong> Romaji-first means episode one is day one, not
                &quot;after you finish a kana course.&quot;
              </li>
              <li>
                <strong>Works from audio on the anime sites.</strong> Migaku added audio transcription, but
                only for YouTube and podcasts, not Netflix, and it doesn&apos;t support Crunchyroll at all.
                AnimeVocab transcribes the audio on Netflix and Crunchyroll too, which is where most anime
                actually gets watched.
              </li>
              <li>
                <strong>Open and private.</strong> AGPL source, no account, data stays on your device.
              </li>
            </ul>

            <h2>Which should you use?</h2>
            <div className="pick">
              <div className="card mine">
                <h3>Pick AnimeVocab if…</h3>
                <p>
                  You&apos;re early, you want to press install and go, you&apos;re not ready to pay, or you watch
                  content with no Japanese subs.
                </p>
              </div>
              <div className="card">
                <h3>Pick Migaku if…</h3>
                <p>
                  You&apos;re committed, you want serious Anki mining and grammar tooling, and setup plus a
                  subscription are worth it to you.
                </p>
              </div>
            </div>
            <p style={{ marginTop: 20 }}>
              Plenty of people never need more than this. If you do eventually want a full sentence-mining
              rig, Migaku will be there, but &quot;eventually&quot; is carrying a lot of weight in that sentence.
              Watching Crunchyroll? Migaku does not support it — see{" "}
              <Link href="/blog/migaku-crunchyroll-alternative-2026">Migaku Crunchyroll alternatives</Link>.
              Also: <Link href="/manabidojo-alternative">ManabiDojo alternative</Link> for fan-sub overlays.
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
            <h2>Skip the setup. Start this episode.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/migaku-free-alternative", label: "Migaku free alternative" },
          { href: "/blog/is-migaku-worth-it-2026", label: "Is Migaku worth it?" },
          { href: "/blog/migaku-crunchyroll-alternative-2026", label: "Migaku Crunchyroll alt" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/learn-japanese-with-anime", label: "Compare" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
