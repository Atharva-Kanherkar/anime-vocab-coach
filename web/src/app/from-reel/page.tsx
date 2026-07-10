import type { Metadata } from "next";
import { FromReelClient } from "@/components/from-reel-client";
import { DesktopChromeBanner } from "@/components/desktop-chrome-banner";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const path = "/from-reel";
const title = "How would YOU end it? | AnimeVocab";
const description =
  "Fan endings for One Piece, Demon Slayer, Jujutsu Kaisen, and more. Pick a finale, get a free fan-art manga chapter on your phone.";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: true },
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    title: "How would YOU end it?",
    description,
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "How would YOU end it?",
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
