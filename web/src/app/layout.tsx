import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { ExtensionSignoutBridge } from "@/components/extension-signout-bridge";
import { FxAudioPrimer } from "@/components/fx-audio-primer";
import { LocaleProvider } from "@/components/locale-provider";
import { MetaPixel } from "@/components/meta-pixel";
import { ScrollEffects } from "@/components/site-chrome";
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

// Clerk core-2 variable names (themes 2.x): colorForeground / colorInput /
// colorInputForeground / colorPrimaryForeground. The pre-2.x names (colorText,
// colorInputText, colorInputBackground, colorTextSecondary) are silently
// ignored, which is what left the sign-in/up text dark-on-dark. baseTheme: dark
// covers everything else (dividers, muted text, icons).
const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#db7a5c",
    colorPrimaryForeground: "#100b08",
    colorBackground: "#10141f",
    colorForeground: "#eef2fc",
    colorInput: "#171c2b",
    colorInputForeground: "#eef2fc",
    colorNeutral: "#eef2fc",
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
      fontWeight: "600",
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
    types: {
      "application/rss+xml": `${SITE_URL}/feed.xml`,
    },
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
    <LocaleProvider>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {children}
      <FxAudioPrimer />
      <ScrollEffects />
    </LocaleProvider>
  );

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${ibmPlex.variable} ${notoJp.variable}`}
    >
      <body>
        <MetaPixel />
        {DEV_NO_CLERK ? (
          shell
        ) : (
          <ClerkProvider appearance={clerkAppearance}>
            {shell}
            <ExtensionSignoutBridge />
          </ClerkProvider>
        )}
      </body>
    </html>
  );
}
