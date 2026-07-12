import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Zen_Maru_Gothic } from "next/font/google";
import "./app.css";

// Rounded JP display face for the cloud app only — marketing never uses --jp-round.
const zenMaru = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--jp-round",
  display: "swap",
});

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Set the theme before first paint so there's no dark→light flash. Defaults to
// the OS preference, then remembers the user's choice. Scoped to /app; the
// marketing pages never read `data-theme`.
const themeInit = `(function(){try{var t=localStorage.getItem('av-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      <div className={`av font-sans ${zenMaru.variable}`}>{children}</div>
    </>
  );
}
