import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { FxAudioPrimer } from "@/components/fx-audio-primer";
import { ScrollEffects } from "@/components/site-chrome";
import { CLERK_ENABLED } from "@/lib/flags";
import {
  SEO_KEYWORDS,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  defaultOpenGraph,
  defaultTwitter,
} from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import "./globals.css";
import { IBM_Plex_Sans, Newsreader, Noto_Sans_JP } from "next/font/google";

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

const clerkAppearance = {
  variables: {
    colorPrimary: "#e3ba63",
    colorBackground: "#10141f",
    colorInputBackground: "#171c2b",
    colorInputText: "rgba(238, 242, 252, 0.95)",
    colorText: "rgba(238, 242, 252, 0.95)",
    colorTextSecondary: "rgba(224, 232, 250, 0.66)",
    colorModalBackdrop: "rgba(4, 6, 12, 0.74)",
    borderRadius: "0.625rem",
    fontFamily: "var(--sans)",
  },
  elements: {
    cardBox: {
      boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
    },
    card: {
      border: "1px solid rgba(224, 232, 255, 0.11)",
    },
    formButtonPrimary: {
      color: "#10141f",
      fontWeight: "600",
    },
    footerActionLink: {
      color: "#e3ba63",
    },
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_TAGLINE} | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: "Atharva Kanherkar", url: "https://x.com/attharrva15" }],
  creator: "Atharva Kanherkar",
  publisher: SITE_NAME,
  category: "education",
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: defaultOpenGraph,
  twitter: defaultTwitter,
  other: {
    "theme-color": "#080a12",
    "apple-mobile-web-app-title": SITE_NAME,
    "format-detection": "telephone=no",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const shell = (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {children}
      <FxAudioPrimer />
      <ScrollEffects />
    </>
  );

  return (
    <html lang="en" className={`${newsreader.variable} ${ibmPlex.variable} ${notoJp.variable}`}>
      <body>
        {/* Clerk is behind a flag; when off, render with no ClerkProvider so
            the site works without Clerk keys. See @/lib/flags. */}
        {CLERK_ENABLED ? (
          <ClerkProvider appearance={clerkAppearance}>{shell}</ClerkProvider>
        ) : (
          shell
        )}
      </body>
    </html>
  );
}
