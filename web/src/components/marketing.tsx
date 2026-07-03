import type { ReactNode } from "react";
import Link from "next/link";

export function CompareHero({
  title,
  lede,
  verdictTag,
  verdict,
}: {
  title: string;
  lede: ReactNode;
  verdictTag: string;
  verdict: ReactNode;
}) {
  return (
    <section className="cmp-hero">
      <div className="wrap">
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        <div className="cmp-verdict">
          <span className="vtag">{verdictTag}</span>
          <p>{verdict}</p>
        </div>
      </div>
    </section>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  return (
    <nav className="crumbs wrap" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && " / "}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
