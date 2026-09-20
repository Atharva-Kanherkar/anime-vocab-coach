"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

/**
 * Horizontal strip of feature demos below the hero (see the PR test
 * contract, revision 2): one full-width panel per feature, scroll-snapped
 * sideways, each pairing feature copy with a demo built from real HTML —
 * looped CSS animations plus light React state for interactivity. The text
 * is server-rendered, so the demos double as crawlable content. Copy here is
 * illustrative of the demo scene, not product claims.
 */

const COACH_QA = [
  {
    q: "What does 退屈 mean here?",
    a: "退屈 (taikutsu) — boredom. Resigned, not dramatic: the speaker expects nothing from tonight. 退屈な夜 = “a boring night”.",
  },
  {
    q: "退屈な夜 — what is な doing?",
    a: "な connects 退屈 to the noun 夜: 退屈 + な + 夜 = “a boring night”. Drop it and the sentence breaks.",
  },
  {
    q: "Is 退屈 casual?",
    a: "Neutral — fine in anime dialogue and everyday speech. A stiffer equivalent is 退屈さ, or the verb 飽きる (“to get tired of”).",
  },
];

const REVIEW_CARDS = [
  { word: "退屈", kana: "たいくつ", romaji: "taikutsu", gloss: "boredom", back: "こんな夜は、退屈でできている。", interval: "again · 1d" },
  { word: "眩しい", kana: "まぶしい", romaji: "mabushii", gloss: "dazzling", back: "星が眩しい。", interval: "1d · 3d" },
  { word: "ずっと", kana: "ずっと", romaji: "zutto", gloss: "the whole time", back: "ずっとこの夜の中にいる。", interval: "3d · 7d" },
];

function Panel({
  id,
  kicker,
  title,
  body,
  cta,
  href,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <article className="demo" id={`demo-${id}`}>
      <div className="demo__copy">
        <span className="demo__kicker">{kicker}</span>
        <h3 className="demo__title">{title}</h3>
        <p className="demo__body">{body}</p>
        <Link className="demo__cta" href={href}>
          {cta} <span aria-hidden="true">→</span>
        </Link>
      </div>
      {/* the stages contain real controls (play/pause, flip, chips), so they
          stay in the a11y tree; only individual decorative bits are hidden */}
      <div className="demo__stage">
        {children}
      </div>
    </article>
  );
}

function CaptureDemo() {
  const [round, setRound] = useState(0);
  return (
    <Panel
      id="capture"
      kicker="01 · capture"
      title="One word per line, pushed to you"
      body="No pausing, no hunting through dictionaries. The word you need slides in with its romaji, its meaning, and the exact line it was spoken in."
      cta="Add to Chrome"
      href="/free-japanese-anime-extension"
    >
      <div className="dmo-capture" key={round}>
        <div className="dmo-capture__queue">
          <span className="dmo-capture__queue-title">Review queue</span>
          <span className="dmo-capture__queue-item">
            <b>眩しい</b> <i>mabushii</i>
          </span>
          <span className="dmo-capture__queue-item">
            <b>ずっと</b> <i>zutto</i>
          </span>
        </div>
        <div className="dmo-capture__subs">
          <span className="dmo-capture__line" lang="ja">
            こんな夜は、<mark className="dmo-hl">退屈</mark>でできている。
          </span>
          <span className="dmo-capture__romaji">
            Konna yoru wa, <mark>taikutsu</mark> de dekite iru.
          </span>
        </div>
        <div className="dmo-capture__card">
          <span className="dmo-chip">New word · 12:04</span>
          <div className="dmo-capture__word-row">
            <span className="dmo-capture__word" lang="ja">退屈</span>
            <span className="dmo-speak">▸ hear</span>
          </div>
          <p className="dmo-capture__gloss">
            taikutsu — <strong>boredom</strong>
          </p>
          <div className="dmo-capture__foot" aria-hidden="true">
            <span className="dmo-know">Know it</span>
            <span className="dmo-ignore">Ignore</span>
            <span className="dmo-xp dmo-xp--fly">+1 XP</span>
          </div>
        </div>
        <button type="button" className="dmo-replay" data-live="true" onClick={() => setRound((r) => r + 1)}>
          Replay
        </button>
      </div>
    </Panel>
  );
}

function ListeningDemo() {
  const [playing, setPlaying] = useState(true);
  return (
    <Panel
      id="listening"
      kicker="02 · listening"
      title="Works when there are no Japanese subtitles"
      body="Listening Mode transcribes the audio itself on Netflix, Crunchyroll, and YouTube — while the English subs stay on. Free tier includes 10 hours a month."
      cta="See pricing"
      href="/pricing"
    >
      <div className={`dmo-listen${playing ? "" : " is-paused"}`}>
        <div className="dmo-listen__bar">
          <span className="dmo-chip dmo-chip--live">● Listening Mode</span>
          <button
            type="button"
            className="dmo-toggle"
            data-live="true"
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "Pause" : "Play"}
          </button>
        </div>
        <div className="dmo-listen__wave">
          {Array.from({ length: 26 }, (_, i) => (
            <span key={i} style={{ ["--i" as string]: i }} />
          ))}
        </div>
        <ol className="dmo-listen__transcript">
          <li style={{ ["--n" as string]: 0 }}>
            <span lang="ja">こんな夜は、退屈でできている。</span>
            <i>Konna yoru wa, taikutsu de dekite iru.</i>
          </li>
          <li style={{ ["--n" as string]: 1 }}>
            <span lang="ja">星が眩しい。</span>
            <i>Hoshi ga mabushii.</i>
          </li>
          <li style={{ ["--n" as string]: 2 }}>
            <span lang="ja">それでも、ずっとここにいた。</span>
            <i>Soredemo, zutto koko ni ita.</i>
          </li>
        </ol>
      </div>
    </Panel>
  );
}

function CoachDemo() {
  const [qa, setQa] = useState(0);
  const current = COACH_QA[qa];
  return (
    <Panel
      id="coach"
      kicker="03 · ai coach"
      title="An AI coach that knows the scene"
      body="Ask what any word means in the exact line it was spoken, or about grammar and nuance. Built in — no API key, no copy-paste."
      cta="Meet the coach"
      href="/learn-japanese-with-anime"
    >
      <div className="dmo-coach">
        <div className="dmo-coach__chips">
          {COACH_QA.map((item, i) => (
            <button
              key={item.q}
              type="button"
              className={`dmo-chip-btn${i === qa ? " is-active" : ""}`}
              data-live="true"
              onClick={() => setQa(i)}
            >
              {item.q}
            </button>
          ))}
        </div>
        <div className="dmo-coach__log" key={qa}>
          <p className="dmo-msg dmo-msg--user">
            <span className="dmo-type">{current.q}</span>
          </p>
          <p className="dmo-msg dmo-msg--ai">
            {current.a.split(" ").map((w, i) => (
              <span key={i}>
                <span className="dmo-stream" style={{ ["--i" as string]: i }}>
                  {w}
                </span>{" "}
              </span>
            ))}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function ReviewDemo() {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = REVIEW_CARDS[i];
  return (
    <Panel
      id="reviews"
      kicker="04 · memory"
      title="Reviews find you in the next episode"
      body="Spaced repetition resurfaces words right before you would forget them — inside the episode you're already watching, not in a separate Anki session."
      cta="Compare tools"
      href="/vs-migaku"
    >
      <div className="dmo-review">
        <div className="dmo-review__meta">
          <span className="dmo-chip">Due now · {card.interval}</span>
          <span className="dmo-review__count">
            {i + 1} / {REVIEW_CARDS.length}
          </span>
        </div>
        <button
          type="button"
          className={`dmo-card${flipped ? " is-flipped" : ""}`}
          data-live="true"
          onClick={() => setFlipped((f) => !f)}
          aria-pressed={flipped}
        >
          <span className="dmo-card__face dmo-card__front">
            <span className="dmo-card__word" lang="ja">{card.word}</span>
            <span className="dmo-card__kana" lang="ja">{card.kana}</span>
            <span className="dmo-card__hint">{card.romaji} · tap to reveal</span>
          </span>
          <span className="dmo-card__face dmo-card__back">
            <span className="dmo-card__gloss">{card.gloss}</span>
            <span className="dmo-card__ctx" lang="ja">{card.back}</span>
          </span>
        </button>
        <div className="dmo-review__foot">
          <button type="button" className="dmo-btn" data-live="true" onClick={() => setFlipped(false)}>
            Again · 10m
          </button>
          <button
            type="button"
            className="dmo-btn dmo-btn--accent"
            data-live="true"
            onClick={() => {
              setFlipped(false);
              setI((n) => (n + 1) % REVIEW_CARDS.length);
            }}
          >
            Know it → next
          </button>
        </div>
      </div>
    </Panel>
  );
}

function CollectDemo() {
  const [round, setRound] = useState(0);
  return (
    <Panel
      id="collect"
      kicker="05 · collect"
      title="Every word you learn is XP"
      body="Level up to unlock 66 hand-illustrated original character cards across 15 anime art styles — plus a 12-chapter manga saga."
      cta="Start collecting"
      href="/free-japanese-anime-extension"
    >
      <div className="dmo-collect" key={round}>
        <div className="dmo-collect__level">
          <span className="dmo-collect__lvl dmo-collect__lvl--old">Lv 3</span>
          <span className="dmo-collect__lvl dmo-collect__lvl--new">Lv 4</span>
        </div>
        <div className="dmo-collect__bar">
          <span className="dmo-collect__fill" />
        </div>
        <div className="dmo-collect__pack">
          <span className="dmo-collect__hint">card unlocked</span>
          <span className="dmo-collect__flip">
            <span className="dmo-collect__face dmo-collect__back-face">
              <span lang="ja">灯</span>
              <i>Saga One · style 07</i>
            </span>
            <span className="dmo-collect__face dmo-collect__card-face">
              <span className="dmo-collect__card-top"> Kotoba no Hi </span>
              <span className="dmo-collect__kanji" lang="ja">灯</span>
              <i>flame · the keeper&apos;s kanji</i>
            </span>
          </span>
        </div>
        <button
          type="button"
          className="dmo-btn dmo-btn--accent"
          data-live="true"
          onClick={() => setRound((r) => r + 1)}
        >
          Collect
        </button>
      </div>
    </Panel>
  );
}

export function DemoStrip() {
  const railRef = useRef<HTMLDivElement>(null);
  const scrollByPanel = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const panel = rail.querySelector<HTMLElement>(".demo");
    rail.scrollBy({ left: dir * (panel?.offsetWidth ?? 600), behavior: "smooth" });
  };

  return (
    <section id="demo" className="demo-strip" aria-label="See AnimeVocab work">
      <header className="demo-strip__head">
        <h2 className="demo-strip__title">See it work</h2>
        <p className="demo-strip__sub">
          Five features, five live demos — the interface itself, rebuilt in HTML. Scroll sideways.
        </p>
      </header>
      <div className="demo-strip__rail" ref={railRef}>
        <CaptureDemo />
        <ListeningDemo />
        <CoachDemo />
        <ReviewDemo />
        <CollectDemo />
      </div>
      <div className="demo-strip__nav">
        <button type="button" data-live="true" aria-label="Previous demo" onClick={() => scrollByPanel(-1)}>
          ←
        </button>
        <button type="button" data-live="true" aria-label="Next demo" onClick={() => scrollByPanel(1)}>
          →
        </button>
      </div>
    </section>
  );
}
