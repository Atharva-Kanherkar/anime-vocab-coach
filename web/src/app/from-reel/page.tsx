import type { Metadata } from "next";
import { FromReelClient } from "@/components/from-reel-client";
import { DesktopChromeBanner } from "@/components/desktop-chrome-banner";
import { FEATURED_ENDING } from "@/lib/ending-hooks";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/from-reel";
const title = "How would YOU end this manga? | AnimeVocab";
const description = `${FEATURED_ENDING.cliffhanger} Free Choose-Your-Ending — no signup, works on your phone.`;

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    title: "How would YOU end this manga?",
    description,
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "How would YOU end this manga?",
    description,
  },
};

export default function FromReelPage() {
  return (
    <>
      <FromReelClient />
      <DesktopChromeBanner />
    </>
  );
}
