import type { Metadata } from "next";
import Link from "next/link";
import { FxSlider } from "@/components/fx-slider";
import {
  PricingSection,
  PromoBar,
  SiteFooter,
  SiteHeader,
} from "@/components/site-chrome";
import { heroSlides } from "@/lib/slides";
import { GITHUB_URL, SITE_URL, getPromoState } from "@/lib/site";

export const metadata: Metadata = {
  title: "Learn Japanese from Anime | AnimeVocab Chrome Extension",
  description:
    "AnimeVocab is a free Chrome extension that teaches Japanese vocabulary while you watch anime. Romaji-first word cards, spaced repetition, and Listening Mode for Netflix, Crunchyroll, and YouTube.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Learn Japanese from Anime — AnimeVocab",
    description:
      "Free Chrome extension: word cards from what you watch, romaji-first for beginners, SRS built in.",
    url: SITE_URL,
  },
};

export default function HomePage() {
  const promo = getPromoState();

  return (
    <>
      <PromoBar initial={promo} />
      <SiteHeader />
      <main id="main">
        <FxSlider slides={heroSlides} />

        <section className="strip">
          <div className="wrap strip-inner reveal">
            <p>
              Built for immersion learners who want vocabulary from{" "}
              <strong>real shows</strong>, not textbook dialogues, without opening Anki
              mid-episode.
            </p>
          </div>
        </section>

        <section className="how" id="how">
          <div className="wrap">
            <header className="section-head reveal">
              <h2>How it works</h2>
              <p>Three steps. No separate study session.</p>
            </header>
            <ol className="flow reveal">
              <li>
                <span className="step-num">1</span>
                <h3>Watch normally</h3>
                <p>
                  English subtitles on. On YouTube we read the hidden Japanese track. On
                  Netflix and Crunchyroll, Listening Mode transcribes the audio.
                </p>
              </li>
              <li>
                <span className="step-num">2</span>
                <h3>Judge one word</h3>
                <p>
                  The player pauses on a single useful word: romaji, reading, gloss, and the
                  line it came from. Know it, learn it, or ignore it.
                </p>
              </li>
              <li>
                <span className="step-num">3</span>
                <h3>Reviews catch you later</h3>
                <p>
                  Words you&apos;re learning resurface in future episodes on a
                  spaced-repetition schedule, right before you&apos;d forget them.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="features" id="features">
          <div className="wrap">
            <header className="section-head reveal">
              <h2>Why learners pick AnimeVocab</h2>
            </header>
            <div className="feat-grid">
              <article className="feat reveal">
                <h3>Romaji-first cards</h3>
                <p>
                  Start from episode one. Every card leads with roman letters; kana and kanji
                  sit alongside as you grow into them.
                </p>
              </article>
              <article className="feat reveal">
                <h3>Any show, any site</h3>
                <p>
                  Listening Mode works from audio, not a subtitle library. New releases,
                  obscure titles, any streaming site.
                </p>
              </article>
              <article className="feat reveal">
                <h3>Smart word picking</h3>
                <p>
                  Frequency ranks and JLPT levels filter out particles and noise. One card per
                  line, with cooldowns so it never feels like a quiz show.
                </p>
              </article>
              <article className="feat reveal">
                <h3>Local progress dashboard</h3>
                <p>
                  Streaks, hours watched, vocabulary by level, review pipeline: all computed on
                  your device, not our servers.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="compare-teaser" id="compare">
          <div className="wrap">
            <header className="section-head reveal">
              <h2>How AnimeVocab compares</h2>
              <p>
                Most anime-Japanese tools assume you can already read the subtitles.
                AnimeVocab is built for the episode-one beginner.
              </p>
            </header>
            <div className="vs-grid reveal">
              <Link className="vs-card" href="/vs-language-reactor">
                <span className="vs-label">Comparison</span>
                <span className="vs-h">vs Language Reactor</span>
                <p>
                  The popular dual-subtitle reader. Where it wins, and where romaji-first
                  beats hovering.
                </p>
                <span className="vs-go">Read comparison →</span>
              </Link>
              <Link className="vs-card" href="/vs-migaku">
                <span className="vs-label">Comparison</span>
                <span className="vs-h">vs Migaku</span>
                <p>
                  The power-user Anki mining suite. When its depth is worth the setup, and
                  when it isn&apos;t.
                </p>
                <span className="vs-go">Read comparison →</span>
              </Link>
              <Link className="vs-card" href="/learn-japanese-with-anime">
                <span className="vs-label">Guide</span>
                <span className="vs-h">Every tool, ranked</span>
                <p>
                  A 2026 guide to learning Japanese from anime: subtitle readers, players,
                  and this.
                </p>
                <span className="vs-go">Read the guide →</span>
              </Link>
            </div>
          </div>
        </section>

        <PricingSection initialPromo={promo} />

        <section className="faq" id="faq">
          <div className="wrap narrow">
            <header className="section-head reveal">
              <h2>FAQ</h2>
            </header>
            <details className="reveal">
              <summary>Can I learn Japanese just by watching anime?</summary>
              <p>
                Only if you actively notice and remember words. AnimeVocab handles that: one
                word at a time, in context, with scheduled reviews.
              </p>
            </details>
            <details className="reveal">
              <summary>I can&apos;t read hiragana yet. Can I still use this?</summary>
              <p>
                Yes. That&apos;s the default setup. Cards show <em>taikutsu</em> before 退屈.
                Switch to kana-first or kanji-first when you&apos;re ready.
              </p>
            </details>
            <details className="reveal">
              <summary>How is this different from subtitle dictionary tools?</summary>
              <p>
                Most tools assume you can read Japanese subtitles and hover words yourself.
                AnimeVocab pushes one curated word to you in romaji and tracks SRS for you.
              </p>
            </details>
            <details className="reveal">
              <summary>Where is my data stored?</summary>
              <p>
                In your browser only. No accounts, no analytics. Source code is on GitHub under
                AGPL.
              </p>
            </details>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow reveal">
            <h2>Your next episode can teach you a word.</h2>
            <a className="btn btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
              Add to Chrome (free)
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
