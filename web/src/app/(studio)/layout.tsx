import type { ReactNode } from "react";
import "../app/app.css";
import { StudioChrome } from "@/components/app/studio-chrome";

// Public Manga Studio + Gallery (outside the login-gated /app). Reuses the Cloud
// app's riso-print theme; app.css is scoped to `.av`, so it styles only this
// subtree. Same before-paint theme init as /app to avoid a flash.
const themeInit = `(function(){try{var t=localStorage.getItem('av-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function StudioSectionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      <div className="av font-sans min-h-screen pb-24">
        <StudioChrome />
        {children}
      </div>
    </>
  );
}
