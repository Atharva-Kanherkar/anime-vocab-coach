"use client";

import { useEffect } from "react";
import Link from "next/link";
import { listEndingCatalog } from "@/lib/ending-hooks";
import { installUrl, isStoreInstallAvailable, SITE_URL } from "@/lib/site";
import { trackMeta } from "@/lib/meta-pixel";

/**
 * Mobile-first Instagram / Meta ad landing. Normal document scroll — no FxSlider.
 * Primary job: get the visitor into the fan-ending catalog in one tap.
 */
export function FromReelClient() {
  useEffect(() => {
    trackMeta("ViewContent", {
      content_name: "from_reel",
      content_category: "instagram_funnel",
    });
  }, []);

  const catalog = listEndingCatalog().filter((m) => m.id !== "lantern-of-words").slice(0, 6);
  const endHref = `/end?utm_source=instagram&utm_medium=paid_social&utm_campaign=reel`;
  const customHref = `/end/custom?utm_source=instagram&utm_medium=paid_social&utm_campaign=reel`;
  const studioHref = `/studio?utm_source=instagram&utm_medium=paid_social&utm_campaign=reel`;
  const galleryHref = `/gallery?utm_source=instagram&utm_medium=paid_social&utm_campaign=reel`;
  const chromeHref = installUrl();
  const store = isStoreInstallAvailable();

  return (
    <main id="main" className="from-reel">
      <section className="from-reel__hero">
        <p className="from-reel__eyebrow">AnimeVocab · fan endings</p>
        <h1 className="from-reel__title">How would YOU end it?</h1>
        <p className="from-reel__lede">
          One Piece. Demon Slayer. Jujutsu Kaisen. Pick a series, choose a fan ending, get your own
          fan-art chapter in seconds — free, on your phone.
        </p>
        <div className="from-reel__ctas">
          <Link className="from-reel__btn from-reel__btn--primary" href={endHref}>
            Browse series →
          </Link>
          <Link className="from-reel__btn from-reel__btn--ghost" href={customHref}>
            Type any manga
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
        <p className="from-reel__card-kicker">Fan art · 同人 endings</p>
        <h2 className="from-reel__card-title">Famous series, your finale</h2>
        <p className="from-reel__card-body">
          Unofficial fan endings — same energy as fandom finales and fan art. Match the characters.
          Share your chapter.
        </p>
        <ul className="from-reel__endings">
          {catalog.map((m) => (
            <li key={m.id}>
              <strong>{m.title}</strong>
              <span>{m.cliffhanger}</span>
            </li>
          ))}
        </ul>
        <Link className="from-reel__btn from-reel__btn--primary from-reel__btn--block" href={endHref}>
          Choose your ending
        </Link>
        <p className="from-reel__fine" style={{ marginTop: 12 }}>
          <Link href={studioHref}>Or make a manga from scratch</Link>
        </p>
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
        <br />
        Unofficial fan art. Not affiliated with original publishers.
      </footer>
    </main>
  );
}
