import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { enJaHreflang } from "@/lib/ja-seo";
import { defaultOpenGraph, defaultTwitter, faqJsonLd } from "@/lib/seo";

const path = "/does-language-reactor-work-on-crunchyroll";

const LR_CRUNCHYROLL_FORUM =
  "https://forum.languagelearningwithnetflix.com/t/crunchyroll-support/10646";

export const metadata: Metadata = {
  title: "Does Language Reactor Work on Crunchyroll? (2026: No — Here's What Does)",
  description:
    "Does Language Reactor work on Crunchyroll? No — LR is Netflix and YouTube only. Honest answer, forum proof, and the tools that actually work for Japanese on Crunchyroll.",
  keywords: [
    "does language reactor work on crunchyroll",
    "language reactor crunchyroll",
    "language reactor on crunchyroll",
    "language reactor crunchyroll alternative",
    "language reactor anime crunchyroll",
  ],
  alternates: enJaHreflang(path, "/ja/language-reactor-crunchyroll"),
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "Does Language Reactor Work on Crunchyroll? (2026)",
    description:
      "Short answer: no. Language Reactor is Netflix/YouTube-first. Here is what works on Crunchyroll instead.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "Does Language Reactor Work on Crunchyroll?",
    description: "No — Netflix/YouTube only. What Crunchyroll Japanese learners should use instead.",
  },
};

const faqs = [
  {
    question: "Does Language Reactor work on Crunchyroll?",
    answer:
      "No. Language Reactor is built around Netflix and YouTube subtitle tracks. It does not support Crunchyroll as a first-class platform. Learners have asked for Crunchyroll support on the Language Reactor forum for years; there is still no official integration.",
  },
  {
    question: "Why doesn't Language Reactor support Crunchyroll?",
    answer:
      "Crunchyroll's player and subtitle licensing differ from Netflix. Outside Japan, most titles ship English subtitles only — no selectable Japanese track for dual-sub tools to latch onto. Forum discussions note that supporting Crunchyroll is technically and legally harder than Netflix.",
  },
  {
    question: "What should I use instead of Language Reactor on Crunchyroll?",
    answer:
      "If you cannot read kana yet, AnimeVocab Listening Mode works from audio when Japanese subs are missing. If you can already read Japanese text on screen, Lexirise or ManabiDojo are stronger click-to-translate readers. Advanced miners overlay fan .srt files with Substital or Jimaku + asbplayer.",
  },
  {
    question: "Should I keep Language Reactor if I also watch Netflix?",
    answer:
      "Yes. Language Reactor remains excellent for dual Japanese/English subtitles on Netflix and YouTube once you can read Japanese. Use LR on Netflix nights and a Crunchyroll-native tool for simulcasts — splitting platforms is normal in 2026.",
  },
  {
    question: "Is AnimeVocab a Language Reactor alternative for Crunchyroll?",
    answer:
      "For the Crunchyroll gap, yes. AnimeVocab does not clone dual-sub playback. It gives romaji-first word cards and Listening Mode from spoken audio, plus built-in spaced repetition — the jobs LR cannot do when there is no JP track.",
  },
];

export default function DoesLanguageReactorWorkOnCrunchyrollPage() {
  const faqLd = faqJsonLd(faqs);
  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to learn Japanese on Crunchyroll without Language Reactor",
    description:
      "Switch from Language Reactor expectations to a Crunchyroll-native Japanese study workflow.",
    totalTime: "PT20M",
    step: [
      {
        "@type": "HowToStep",
        name: "Accept that Language Reactor does not run on Crunchyroll",
        text: "Keep Language Reactor for Netflix and YouTube. Do not plan Crunchyroll study around dual-sub features that need a Japanese subtitle track.",
      },
      {
        "@type": "HowToStep",
        name: "Pick a tool that matches your reading level",
        text: "Use AnimeVocab Listening Mode if you need romaji from audio. Use Lexirise or ManabiDojo if Japanese text is already on screen.",
        url: `${SITE_URL}/learn-japanese-crunchyroll`,
      },
      {
        "@type": "HowToStep",
        name: "Capture one word per line and review tomorrow",
        text: "Save spoken vocabulary with context, then run a short spaced-repetition session before the next episode.",
        url: `${SITE_URL}/anime-spaced-repetition`,
      },
    ],
  };

  return (
    <>
      <LandingJsonLd
        path={path}
        title="Does Language Reactor Work on Crunchyroll? (2026: No — Here's What Does)"
        description="Does Language Reactor work on Crunchyroll? No — LR is Netflix and YouTube only. Honest answer and tools that work for Japanese on Crunchyroll."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/language-reactor-alternative", label: "Language Reactor" },
            { label: "On Crunchyroll?" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="Does Language Reactor work on Crunchyroll?"
          lede={
            <>
              <strong>No.</strong> Language Reactor does not work on Crunchyroll. It is a{" "}
              <strong>Netflix and YouTube</strong> dual-subtitle tool. If you came here hoping to click Japanese
              words on tonight&apos;s simulcast, that workflow does not exist in LR — and the community has been
              asking for it for years.
            </>
          }
          verdictTag="Direct answer"
          verdict={
            <>
              Keep Language Reactor where it wins (Netflix/YouTube dual subs). For Crunchyroll, use{" "}
              <strong>AnimeVocab</strong> when you need romaji or audio capture, or a reader tool when Japanese
              text is actually on screen. Full hub:{" "}
              <Link href="/learn-japanese-crunchyroll">learn Japanese on Crunchyroll</Link>.
            </>
          }
        />

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>The short evidence trail</h2>
            <p>
              Language Reactor&apos;s product surface is built around platforms that expose reliable subtitle
              tracks — primarily <strong>Netflix</strong> and <strong>YouTube</strong>. Crunchyroll is not on that
              list. Learners have filed the request openly on the Language Learning with Netflix / Language Reactor
              forum (
              <a href={LR_CRUNCHYROLL_FORUM} rel="noopener noreferrer" target="_blank">
                Crunchyroll Support thread
              </a>
              ). Replies there note that Crunchyroll handles subtitles differently from Netflix, which makes a
              dual-sub integration harder. Years later, there is still no first-class Crunchyroll mode.
            </p>
            <p>
              Separately, most Crunchyroll titles outside Japan ship with{" "}
              <strong>English subtitles only</strong>. Even a hypothetical LR port would hit a wall when there is no
              Japanese text track to dual-sub against. That is a licensing reality, not a secret setting you missed
              in the player.
            </p>

            <h2>Where Language Reactor still wins</h2>
            <p>
              Honesty first: if you already read kana and you live on Netflix anime or Japanese YouTube,{" "}
              <strong>Language Reactor is often the right free tool</strong>. Dual Japanese/English subtitles,
              dictionary popups, and playback controls are mature. Do not uninstall it because Crunchyroll is a
              gap — uninstalling a good Netflix tool solves nothing. Compare the full feature split on{" "}
              <Link href="/vs-language-reactor">AnimeVocab vs Language Reactor</Link> and the head-to-head with
              Migaku on <Link href="/migaku-vs-language-reactor">Migaku vs Language Reactor</Link>.
            </p>
            <p>
              Language Reactor also wins on habit friction: once dual subs are working, looking up a word is one
              click away from the line you just heard. AnimeVocab deliberately does a different job — one curated
              romaji-first card and spaced repetition — so intermediate readers on Netflix should not treat this
              page as a reason to abandon LR. The conversion story that actually helps learners is{" "}
              <em>right tool per platform</em>, not a single extension that pretends every streamer is Netflix.
            </p>

            <h2>Common mistakes after the &quot;no&quot; answer</h2>
            <ul>
              <li>
                <strong>Installing random &quot;dual subtitle&quot; extensions</strong> that scrape English burn-ins
                and call that Japanese study. English text is a plot aid, not a reading curriculum.
              </li>
              <li>
                <strong>Paying for Migaku hoping it covers Crunchyroll</strong> — it does not. Same platform wall,
                different brand.
              </li>
              <li>
                <strong>Chasing fan .srt overlays before you can read kana</strong>. File hunting is an advanced
                reader workflow; beginners burn evenings on offsets instead of vocabulary.
              </li>
              <li>
                <strong>Bingeing with English subs and zero capture</strong>. Passive hours feel productive; recall
                the next day proves otherwise.
              </li>
            </ul>

            <h2>What actually works on Crunchyroll</h2>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Crunchyroll?</th>
                    <th scope="col">Needs JP subs?</th>
                    <th scope="col">Best for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>AnimeVocab</strong>
                    </td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>
                      <span className="no">No</span> (Listening Mode)
                    </td>
                    <td>Beginners · romaji · built-in SRS</td>
                  </tr>
                  <tr>
                    <td>Language Reactor</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Yes (dual-sub model)</td>
                    <td>Netflix / YouTube readers</td>
                  </tr>
                  <tr>
                    <td>Lexirise</td>
                    <td>
                      <span className="yes">Yes</span>
                    </td>
                    <td>Uses on-screen text when present</td>
                    <td>Readers · click-to-translate</td>
                  </tr>
                  <tr>
                    <td>ManabiDojo</td>
                    <td>
                      <span className="yes">Partial</span>
                    </td>
                    <td>Often fan JP subs</td>
                    <td>Integrated quizzes + fan tracks</td>
                  </tr>
                  <tr>
                    <td>Migaku</td>
                    <td>
                      <span className="no">No</span>
                    </td>
                    <td>Yes on supported sites</td>
                    <td>Paid Anki mining (not CR)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Migaku has the same Crunchyroll dead end — see{" "}
              <Link href="/does-migaku-work-on-crunchyroll">does Migaku work on Crunchyroll?</Link>. If your
              question was really about Japanese subtitle tracks themselves, jump to{" "}
              <Link href="/crunchyroll-japanese-subtitles">Crunchyroll Japanese subtitles</Link>.
            </p>

            <h2>A practical 20-minute Crunchyroll session (no LR)</h2>
            <ol className="article-ol">
              <li>
                Open a slow show from our{" "}
                <Link href="/best-anime-to-learn-japanese">best anime for beginners</Link> list — Japanese audio,
                English subs OK for plot.
              </li>
              <li>
                Install{" "}
                <Link href="/free-japanese-anime-extension">AnimeVocab</Link> ({TIERS.free.priceLabel} core) and
                enable Listening Mode when there is no Japanese subtitle track.
              </li>
              <li>Save one spoken word per line in romaji — not a dump of every unknown noun.</li>
              <li>
                Review for five minutes tomorrow before the next episode (
                <Link href="/anime-spaced-repetition">spaced repetition</Link>).
              </li>
            </ol>
            <p>
              When you can read Japanese overlays, graduate toward Lexirise/ManabiDojo or fan-file workflows. Until
              then, forcing dual-sub tools onto a platform without JP text only creates frustration. Deeper
              Crunchyroll-specific Language Reactor alternative write-up:{" "}
              <Link href="/language-reactor-alternative-crunchyroll">
                Language Reactor alternative for Crunchyroll
              </Link>
              .
            </p>

            <h2>Related pages in this cluster</h2>
            <ul>
              <li>
                <Link href="/does-migaku-work-on-crunchyroll">Does Migaku work on Crunchyroll?</Link>
              </li>
              <li>
                <Link href="/crunchyroll-japanese-subtitles">Crunchyroll Japanese subtitles how-to</Link>
              </li>
              <li>
                <Link href="/migaku-vs-language-reactor">Migaku vs Language Reactor</Link>
              </li>
              <li>
                <Link href="/language-reactor-alternative">Language Reactor alternative (hub)</Link>
              </li>
              <li>
                <Link href="/learn-japanese-crunchyroll">Learn Japanese on Crunchyroll</Link>
              </li>
              <li>
                <Link href="/blog/language-reactor-crunchyroll-2026">Blog deep dive: LR × Crunchyroll</Link>
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
            <h2>Crunchyroll tonight — skip the dead end.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/does-migaku-work-on-crunchyroll", label: "Migaku on CR?" },
          { href: "/crunchyroll-japanese-subtitles", label: "JP subtitles" },
          { href: "/language-reactor-alternative-crunchyroll", label: "LR alt for CR" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll hub" },
          { href: "/vs-language-reactor", label: "vs Language Reactor" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
