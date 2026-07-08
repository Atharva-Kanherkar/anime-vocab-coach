import type { ReactNode } from "react";
import Link from "next/link";
import { breadcrumbJsonLd } from "@/lib/seo";

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
  currentPath,
}: {
  items: { href?: string; label: string }[];
  /** Path of the current page (last crumb) for JSON-LD when it has no href */
  currentPath?: string;
}) {
  const ldItems = items.map((item, i) => {
    const path = item.href ?? (i === items.length - 1 ? currentPath : undefined);
    return path ? { name: item.label, path } : null;
  }).filter((x): x is { name: string; path: string } => x !== null);

  return (
    <>
      {ldItems.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(ldItems)) }}
        />
      ) : null}
      <nav className="crumbs wrap" aria-label="Breadcrumb">
        {items.map((item, i) => (
          <span key={item.label}>
            {i > 0 && " / "}
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          </span>
        ))}
      </nav>
    </>
  );
}
