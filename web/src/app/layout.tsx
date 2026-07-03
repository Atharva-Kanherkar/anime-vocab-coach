import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader, Noto_Sans_JP } from "next/font/google";
import { ScrollEffects } from "@/components/site-chrome";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--serif",
  display: "swap",
});

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--sans",
  display: "swap",
});

const notoJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--jp",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Learn Japanese from Anime | AnimeVocab",
    template: "%s | AnimeVocab",
  },
  description:
    "AnimeVocab is a free Chrome extension that teaches Japanese vocabulary while you watch anime. Romaji-first word cards, spaced repetition, and Listening Mode for Netflix, Crunchyroll, and YouTube.",
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  openGraph: {
    siteName: "AnimeVocab",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${ibmPlex.variable} ${notoJp.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
        <ScrollEffects />
      </body>
    </html>
  );
}
