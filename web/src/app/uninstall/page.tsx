import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { UninstallFeedback } from "@/components/uninstall-feedback";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

// Reached via chrome.runtime.setUninstallURL() when the extension is removed
// (#89). No auth, no funnel copy — the visitor just uninstalled. One
// question: did that happen before or after they actually gave it a try.

export const metadata: Metadata = {
  title: "Before you go",
  description: "One quick question about why AnimeVocab wasn't a fit.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/uninstall` },
  openGraph: { ...defaultOpenGraph, title: "Before you go", description: "One quick question." },
  twitter: { ...defaultTwitter, title: "Before you go" },
};

export default function UninstallPage() {
  return (
    <>
      <SiteHeader compact />
      <main id="main">
        <section className="legal wrap narrow" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <h1>Sorry to see you go</h1>
          <p style={{ marginTop: 12 }}>
            Mind answering one question? It helps decide what to fix first.
          </p>
          <UninstallFeedback />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
