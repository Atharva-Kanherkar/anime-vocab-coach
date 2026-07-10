"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FEATURED_ENDING } from "@/lib/ending-hooks";
import { installUrl, isStoreInstallAvailable, SITE_URL } from "@/lib/site";
import { trackMeta } from "@/lib/meta-pixel";

/**
 * Mobile-first Instagram / Meta ad landing. Normal document scroll — no FxSlider.
 * Primary job: get the visitor into Choose-Your-Ending or Studio in one tap.
 */
export function FromReelClient() {
  useEffect(() => {
    trackMeta("ViewContent", {
      content_name: "from_reel",
      content_category: "instagram_funnel",
    });
  }, []);

  const endHref = `/end/${FEATURED_ENDING.id}?utm_source=instagram&utm_medium=paid_social&utm_campaign=reel`;
  const studioHref = `/studio?utm_source=instagram&utm_medium=paid_social&utm_campaign=reel`;
  const galleryHref = `/gallery?utm_source=instagram&utm_medium=paid_social&utm_campaign=reel`;
  const chromeHref = installUrl();
  const store = isStoreInstallAvailable();

  return (
    <main id="main" className="from-reel">
      <section className="from-reel__hero">
        <p className="from-reel__eyebrow">AnimeVocab · free</p>
        <h1 className="from-reel__title">How would YOU end this manga?</h1>
        <p className="from-reel__lede">
          {FEATURED_ENDING.cliffhanger} Pick a creative finale, get your own chapter in seconds — no
          signup, works on your phone.
        </p>
        <div className="from-reel__ctas">
          <Link className="from-reel__btn from-reel__btn--primary" href={endHref}>
            Choose your ending →
          </Link>
          <Link className="from-reel__btn from-reel__btn--ghost" href={studioHref}>
            Make a manga from scratch
          </Link>
        </div>
        <p className="from-reel__fine">
          <Link href={galleryHref}>Browse free gallery</Link>
          {" · "}
          {store ? (
            <a href={chromeHref} rel="noopener noreferrer" target="_blank">
              On a computer? Add Chrome
            </a>
          ) : (
            <a href={chromeHref}>On a computer? Get the extension</a>
          )}
        </p>
      </section>

      <section className="from-reel__card">
        <p className="from-reel__card-kicker">Featured finished story</p>
        <h2 className="from-reel__card-title">{FEATURED_ENDING.title}</h2>
        <p className="from-reel__card-sub">{FEATURED_ENDING.subtitle}</p>
        <p className="from-reel__card-body">{FEATURED_ENDING.synopsis}</p>
        <ul className="from-reel__endings">
          {FEATURED_ENDING.endings.map((e) => (
            <li key={e.id}>
              <strong>{e.title}</strong>
              <span>{e.blurb}</span>
            </li>
          ))}
        </ul>
        <Link className="from-reel__btn from-reel__btn--primary from-reel__btn--block" href={endHref}>
          Pick an ending
        </Link>
      </section>

      <section className="from-reel__why">
        <h2>Why anime fans stick</h2>
        <ul>
          <li>
            <strong>Instant create</strong> — your ending, your chapter, under a minute
          </li>
          <li>
            <strong>Shareable</strong> — publish a link friends can open on any phone
          </li>
          <li>
            <strong>Learn later</strong> — on a laptop, the Chrome extension turns Crunchyroll into
            vocabulary
          </li>
        </ul>
      </section>

      <footer className="from-reel__foot">
        <a href={SITE_URL}>animevocab.com</a>
        {" · "}
        <Link href="/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
