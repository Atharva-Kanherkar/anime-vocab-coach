import type { Metadata } from "next";
import { CustomEnding } from "@/components/app/custom-ending";
import { DesktopChromeBanner } from "@/components/desktop-chrome-banner";
import { SITE_URL } from "@/lib/site";
import { defaultOpenGraph, defaultTwitter } from "@/lib/seo";

const title = "Fan ending for any manga";
const description =
  "Type any anime or manga title. We invent three fan endings. You pick one and get a free fan-art epilogue chapter.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/end/custom` },
  openGraph: { ...defaultOpenGraph, title, description, url: `${SITE_URL}/end/custom` },
  twitter: { ...defaultTwitter, title, description },
};

export default function CustomEndPage() {
  return (
    <>
      <main id="main" className="mx-auto mt-6 w-full max-w-[720px] px-4 pb-28 md:mt-10 md:px-6">
        <CustomEnding />
      </main>
      <DesktopChromeBanner />
    </>
  );
}
