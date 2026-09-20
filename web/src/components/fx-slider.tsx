import Link from "next/link";
import { GITHUB_URL, installUrl } from "@/lib/site";
import type { HeroSlide } from "@/lib/slides";
import { FeatureMockup } from "@/components/feature-mockup";
import { PricingBlock } from "@/components/pricing-block";

/**
 * The whole homepage body: every slide stacks in normal document flow —
 * title + copy, then the product mockup below it, then the next feature.
 * No scroll-hijacking, no pinned stage: every section is real, crawlable
 * HTML from the first render (issue #115), and the first section's mockup
 * is visible above the fold with no scrolling (issue #117).
 */
export function FxSlider({ slides }: { slides: HeroSlide[] }) {
  return (
    <div className="feature-page">
      {slides.map((s, i) => {
        const Tag = i === 0 ? "h1" : "h2";
        if (s.kind === "pricing") {
          return (
            <section key={s.id} id={`slide-${s.id}`} className="feature-row feature-row--wide">
              <span className="feature-row__kicker">{s.kicker}</span>
              <Tag className="hero__title">{s.title}</Tag>
              <p className="hero__body">{s.body}</p>
              <PricingBlock />
              <p className="hero__fineprint">
                <Link href="/pricing">Full pricing, regional prices, and billing FAQ</Link>
              </p>
            </section>
          );
        }

        if (s.kind === "faq") {
          return (
            <section key={s.id} id={`slide-${s.id}`} className="feature-row feature-row--wide">
              <span className="feature-row__kicker">{s.kicker}</span>
              <Tag className="hero__title">{s.title}</Tag>
              <div className="hero__faq">
                <details>
                  <summary>Can I learn Japanese just by watching anime?</summary>
                  <p>
                    Only if you actively notice and remember words. AnimeVocab handles that: one
                    word at a time, in context, with scheduled reviews.
                  </p>
                </details>
                <details>
                  <summary>I can&apos;t read hiragana yet. Can I still use this?</summary>
                  <p>
                    Yes. That&apos;s the default setup. Cards show <em>taikutsu</em> before 退屈.
                    Switch to kana-first or kanji-first when you&apos;re ready.
                  </p>
                </details>
                <details>
                  <summary>How is this different from subtitle dictionary tools?</summary>
                  <p>
                    Most tools assume you can read Japanese subtitles and hover words yourself.
                    AnimeVocab pushes one curated word to you in romaji and tracks SRS for you.
                  </p>
                </details>
                <details>
                  <summary>Where is my data stored?</summary>
                  <p>
                    On your device by default — the extension works with no account. Create a
                    free account only if you want cloud backup, sync across devices, or the AI
                    coach. No ads, no tracking, and the source is on GitHub under AGPL.
                  </p>
                </details>
              </div>
              <p className="hero__fineprint">
                © AnimeVocab ·{" "}
                <a href={GITHUB_URL} rel="noopener noreferrer">
                  GitHub
                </a>{" "}
                · <a href="/learn-japanese-with-anime">Compare</a> ·{" "}
                <a href="/privacy">Privacy</a>
              </p>
            </section>
          );
        }

        return (
          <section
            key={s.id}
            id={`slide-${s.id}`}
            className={`feature-row${i === 0 ? " feature-row--first" : ""}`}
            style={{ background: s.tone }}
          >
            <div className="feature-row__copy">
              <span className="feature-row__kicker">{s.kicker}</span>
              <Tag className="hero__title">{s.title}</Tag>
              <p className="hero__body">{s.body}</p>
              {s.ctaLabel ? (
                <div className="hero__cta">
                  <a
                    className="btn btn-line hero__cta-btn"
                    href={s.ctaHref ?? installUrl()}
                    rel="noopener noreferrer"
                  >
                    {s.ctaLabel}
                  </a>
                </div>
              ) : null}
            </div>
            <FeatureMockup slide={s} />
          </section>
        );
      })}
    </div>
  );
}
