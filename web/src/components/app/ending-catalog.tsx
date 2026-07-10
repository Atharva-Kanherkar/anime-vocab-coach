"use client";

import Link from "next/link";
import { listEndingCatalog } from "@/lib/ending-hooks";

/** Minimal catalog of famous manga fan endings. */
export function EndingCatalog() {
  const items = listEndingCatalog();

  return (
    <div className="end-min">
      <header className="end-min__header">
        <p className="end-min__kicker">Fan endings · 同人</p>
        <h1 className="end-min__h1">How would you end it?</h1>
        <p className="end-min__sub">
          Pick a series. Choose a finale. Get a fan-art epilogue chapter — free, on your phone.
        </p>
        <Link href="/end/custom" className="end-min__ghost">
          Or type any manga →
        </Link>
      </header>

      <ul className="end-min__grid">
        {items.map((m) => (
          <li key={m.id}>
            <Link href={`/end/${m.id}`} className="end-min__card" style={{ ["--tile" as string]: m.accent }}>
              <span className="end-min__tag">{m.tag}</span>
              <span className="end-min__title">{m.title}</span>
              <span className="end-min__jp">{m.subtitle}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="end-min__legal">
        Unofficial fan art / fan endings for creative play. Not affiliated with the original publishers.
      </p>
    </div>
  );
}
