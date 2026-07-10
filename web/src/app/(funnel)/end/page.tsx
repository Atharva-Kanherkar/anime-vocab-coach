import type { Metadata } from "next";
import { FunnelCatalog } from "@/components/funnel/funnel-catalog";
import { FunnelTracker } from "@/components/funnel/funnel-track";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const title = "Choose your ending — fan art epilogues";
const description =
  "How would YOU end One Piece, Demon Slayer, Jujutsu Kaisen, and more? Pick a fan ending and watch an AI mangaka draw your own 5-panel manga — free.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/end` },
  openGraph: { ...defaultOpenGraph, title, description, url: `${SITE_URL}/end` },
  twitter: { ...defaultTwitter, title, description },
};

export default function EndCatalogPage() {
  return (
    <>
      <FunnelTracker event="land_end" />
      <FunnelCatalog />
    </>
  );
}
