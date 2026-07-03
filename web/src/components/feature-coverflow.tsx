"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CFItem = { kanji: string; title: string; body: string; tone: string };

/* Grainy gradient blobs (noise added via .cf__noise overlay) — dark-mode toned. */
const ITEMS: CFItem[] = [
  {
    kanji: "音",
    title: "Any show, any site",
    body: "Listening Mode works from audio, not a subtitle library — new releases, obscure titles, any streaming site.",
    tone: "radial-gradient(130% 110% at 12% 16%, #f5c85c 0%, #d98a35 34%, transparent 68%), radial-gradient(120% 100% at 88% 88%, #6b2d12 0%, transparent 55%), #16100a",
  },
  {
    kanji: "初",
    title: "Romaji-first cards",
    body: "Start from episode one. Every card leads with roman letters; kana and kanji sit alongside as you grow.",
    tone: "radial-gradient(130% 110% at 85% 14%, #a78bfa 0%, #6d4fc2 36%, transparent 70%), radial-gradient(120% 100% at 12% 90%, #241448 0%, transparent 58%), #100b1c",
  },
  {
    kanji: "選",
    title: "Smart word picking",
    body: "Frequency ranks and JLPT levels filter out particles and noise. One card per line, with cooldowns.",
    tone: "radial-gradient(130% 110% at 14% 82%, #f28cae 0%, #c2497a 36%, transparent 70%), radial-gradient(120% 100% at 86% 12%, #451530 0%, transparent 56%), #170a12",
  },
  {
    kanji: "私",
    title: "Yours, locally",
    body: "Streaks, hours watched, vocabulary by level — computed on your device, not our servers. No account, ever.",
    tone: "radial-gradient(130% 110% at 82% 80%, #63b3e8 0%, #2f6cab 36%, transparent 70%), radial-gradient(120% 100% at 14% 14%, #0e2547 0%, transparent 58%), #090e18",
  },
];

export function FeatureCoverflow() {
  const [active, setActive] = useState(0);
  const n = ITEMS.length;
  const go = useCallback((i: number) => setActive(((i % n) + n) % n), [n]);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setActive((a) => (a - 1 + n) % n);
      if (e.key === "ArrowRight") setActive((a) => (a + 1) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);

  return (
    <div
      className="cf"
      onPointerDown={(e) => {
        startX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (startX.current == null) return;
        const dx = e.clientX - startX.current;
        if (dx > 44) setActive((a) => (a - 1 + n) % n);
        else if (dx < -44) setActive((a) => (a + 1) % n);
        startX.current = null;
      }}
    >
      <div className="cf__stage">
        {ITEMS.map((it, i) => {
          let offset = i - active;
          if (offset > n / 2) offset -= n;
          if (offset < -n / 2) offset += n;
          const abs = Math.abs(offset);
          const hidden = abs > 2;
          return (
            <button
              key={it.title}
              type="button"
              className={`cf__card${offset === 0 ? " is-active" : ""}`}
              aria-hidden={hidden}
              tabIndex={offset === 0 ? 0 : -1}
              onClick={() => {
                if (offset !== 0) go(i);
              }}
              style={{
                transform: `translate(-50%, -50%) translateX(${offset * 52}%) translateZ(${-abs * 130}px) rotateY(${offset * -34}deg) scale(${offset === 0 ? 1 : 0.86})`,
                opacity: hidden ? 0 : 1 - abs * 0.26,
                zIndex: 20 - abs,
                pointerEvents: hidden ? "none" : "auto",
              }}
            >
              <div className="cf__img" style={{ background: it.tone }} />
              <div className="cf__noise" />
              <div className="cf__scrim" />
              <span className="cf__kanji" aria-hidden="true">
                {it.kanji}
              </span>
              <div className="cf__content">
                <h3>{it.title}</h3>
                <p>{it.body}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="cf__dots" role="tablist" aria-label="Features">
        {ITEMS.map((it, i) => (
          <button
            key={it.title}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={it.title}
            className={i === active ? "is-active" : ""}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}
