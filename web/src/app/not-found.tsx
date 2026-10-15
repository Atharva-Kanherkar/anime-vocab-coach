import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { installUrl } from "@/lib/site";

// Without this file a missing page reused the home page's <title> and had no
// <main> for the skip link to land on (ISO 25010 usability audit).
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader compact />
      <main id="main">
        <section className="wrap narrow" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <h1>Page not found</h1>
          <p style={{ color: "var(--ink-2)", marginTop: 12 }}>
            That page doesn&apos;t exist, or it moved. These are the places people usually mean:
          </p>
          <p style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
            <Link className="btn btn-accent" href="/">
              Home
            </Link>
            <a className="btn btn-line" href={installUrl()} rel="noopener noreferrer">
              Add to Chrome
            </a>
            <Link className="btn btn-line" href="/pricing">
              Pricing
            </Link>
            <Link className="btn btn-line" href="/blog">
              Blog
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
