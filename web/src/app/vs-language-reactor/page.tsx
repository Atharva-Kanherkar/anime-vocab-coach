import type { Metadata } from "next";
import { Breadcrumbs, CompareHero } from "@/components/marketing";
import { LandingJsonLd } from "@/components/landing-json-ld";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { GITHUB_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/vs-language-reactor";

export const metadata: Metadata = {
  title:
    "AnimeVocab vs Language Reactor (2026): Which Is Better for Learning Japanese from Anime?",
  description:
    "AnimeVocab vs Language Reactor: dual-subtitle reader vs romaji-first beginner tool with audio when Japanese subs are missing.",
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    type: "article",
    title: "AnimeVocab vs Language Reactor (2026)",
    description:
      "Language Reactor is the best dual-subtitle reader. AnimeVocab is for beginners who can't read kana and works from audio. An honest comparison.",
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab vs Language Reactor (2026)",
    description:
      "Language Reactor is the best dual-subtitle reader. AnimeVocab is for beginners who can't read kana.",
  },
};

export default function VsLanguageReactorPage() {
  return (
    <>
      <LandingJsonLd
        path={path}
        title="AnimeVocab vs Language Reactor (2026): Which Is Better for Learning Japanese from Anime?"
        description="AnimeVocab vs Language Reactor: dual-subtitle reader vs romaji-first beginner tool with audio when Japanese subs are missing."
      />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/learn-japanese-with-anime", label: "Compare" },
            { label: "vs Language Reactor" },
          ]}
          currentPath={path}
        />

        <CompareHero
          title="AnimeVocab vs Language Reactor"
          lede={
            <>
              Both live in your browser and both turn shows into Japanese practice. They assume
              different learners. Language Reactor is the best{" "}
              <strong>dual-subtitle reader</strong> out there. AnimeVocab is for the person who{" "}
              <strong>can&apos;t read the subtitles yet</strong>, and for shows where there&apos;s no
              Japanese subtitle track to read.
            </>
          }
          verdictTag="Short version"
          verdict={
            <>
              <strong>If you can&apos;t comfortably read Japanese subtitles yet, this isn&apos;t close.</strong>{" "}
              AnimeVocab is built for you and Language Reactor isn&apos;t. Language Reactor is a fine
              dual-subtitle reader once you&apos;ve got the script down and want to study across several
              languages, but it needs an existing subtitle track and hands you subtitles to read rather
              than teaching you a word. Start with AnimeVocab; add Language Reactor later if you also want a reader.
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
                    <th scope="col">Language Reactor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Best for</th>
                    <td className="us">Beginners who can&apos;t read kana yet</td>
                    <td>Intermediate readers using dual subs</td>
                  </tr>
                  <tr>
                    <th scope="row">Price</th>
                    <td className="us">
                      Free · Pro {TIERS.pro.priceLabel}
                      <span className="cell-note">Pro covers audio transcription</span>
                    </td>
                    <td>Free · Pro ~$5/mo (≈$28/yr)</td>
                  </tr>
                  <tr>
                    <th scope="row">Works without a Japanese subtitle track</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                      <span className="cell-note">Listening Mode transcribes the audio</span>
                    </td>
                    <td>
                      <span className="no">No</span>
                      <span className="cell-note">Needs an existing subtitle track</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Romaji-first for total beginners</th>
                    <td className="us">
                      <span className="yes">Yes</span> (default)
                    </td>
                    <td>Optional display; UX is built around reading subs</td>
                  </tr>
                  <tr>
                    <th scope="row">Pushes one curated word per line</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                      <span className="cell-note">Frequency-filtered</span>
                    </td>
                    <td>
                      <span className="no">No</span> (you hover and save words yourself)
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Built-in spaced repetition</th>
                    <td className="us">
                      <span className="yes">Yes</span>
                    </td>
                    <td>Saved-words review; real SRS via Anki export</td>
                  </tr>
                  <tr>
                    <th scope="row">Anki export</th>
                    <td className="us">
                      <span className="no">Not yet</span> (JSON export)
                    </td>
                    <td>
                      <span className="yes">Yes</span> (Pro)
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Dictionary depth</th>
                    <td className="us">Focused JMdict glosses</td>
                    <td>
                      <span className="yes">Deeper</span> + AI dictionary
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Languages</th>
                    <td className="us">Japanese only</td>
                    <td>
                      <span className="yes">30+ languages</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Platforms</th>
                    <td className="us">YouTube, Netflix, Crunchyroll</td>
                    <td>Netflix, YouTube</td>
                  </tr>
                  <tr>
                    <th scope="row">Open source</th>
                    <td className="us">
                      <span className="yes">Yes</span> (AGPL)
                    </td>
                    <td>
                      <span className="no">No</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Data stays on your device</th>
                    <td className="us">
                      <span className="yes">Yes</span>, no account
                    </td>
                    <td>Account-based</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section style={{ paddingTop: 0 }}>
          <div className="wrap prose">
            <h2>What Language Reactor is good at</h2>
            <p>
              Two things about it are genuinely strong, both on the assumption that you can already read
              the script:
            </p>
            <ul>
              <li>
                <strong>A deep dictionary.</strong> Its lookups go well past a one-line gloss, which helps
                once you can already read the word you&apos;re looking up.
              </li>
              <li>
                <strong>Many languages.</strong> If you&apos;re studying Korean or Spanish too, one tool
                covers them.
              </li>
            </ul>
            <p>
              Neither of those does anything for you on day one, because both start from text you can read.
              That&apos;s exactly the gap AnimeVocab fills:
            </p>

            <h2>Where AnimeVocab wins</h2>
            <p>
              The two things Language Reactor structurally can&apos;t do are the two things a beginner needs
              most:
            </p>
            <ul>
              <li>
                <strong>You don&apos;t need to read Japanese.</strong> Cards lead with romaji, so you can
                start on episode one instead of grinding kana first.
              </li>
              <li>
                <strong>It works from audio.</strong> Language Reactor needs a subtitle track to read. On
                Netflix and Crunchyroll, where you can&apos;t mine subs, AnimeVocab&apos;s Listening Mode
                transcribes the spoken Japanese while your English subtitles stay on.
              </li>
              <li>
                <strong>It decides for you.</strong> Instead of hovering and choosing what to save,
                AnimeVocab surfaces one useful word per line, filtered by how common the word is. Lower
                effort, fewer decisions mid-episode.
              </li>
              <li>
                <strong>Private and open.</strong> No account, data stays in your browser, and the source is
                on GitHub under AGPL.
              </li>
            </ul>

            <h2>Which should you use?</h2>
            <div className="pick">
              <div className="card mine">
                <h3>Pick AnimeVocab if…</h3>
                <p>
                  You can&apos;t comfortably read kana yet, you watch on Netflix/Crunchyroll, or you&apos;d
                  rather be handed one word than mine your own.
                </p>
              </div>
              <div className="card">
                <h3>Pick Language Reactor if…</h3>
                <p>
                  You already read Japanese subtitles, want the deepest dictionary, learn several languages,
                  or live inside an Anki mining workflow.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Start before you can read a single kana.</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/blog/language-reactor-free-alternative-2026", label: "LR free alternative" },
          { href: "/free-japanese-anime-extension", label: "Free extension" },
          { href: "/learn-japanese-netflix-anime", label: "Netflix guide" },
          { href: "/learn-japanese-with-anime", label: "Compare" },
          { href: "/blog", label: "Blog" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
