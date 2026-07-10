import type { Metadata } from "next";
import { CustomEndingExperience } from "@/components/funnel/ending-experience";
import { FunnelTracker } from "@/components/funnel/funnel-track";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const title = "Type any manga — get a fan ending";
const description =
  "Name any manga or anime. The AI invents three fan endings — pick one and watch your own 5-panel fan-art manga get drawn, dialogue and all.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/end/custom` },
  openGraph: { ...defaultOpenGraph, title, description, url: `${SITE_URL}/end/custom` },
  twitter: { ...defaultTwitter, title, description },
};

export default function CustomEndingPage() {
  return (
    <>
      <FunnelTracker event="land_custom" />
      <CustomEndingExperience />
    </>
  );
}
