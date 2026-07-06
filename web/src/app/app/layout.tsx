import type { ReactNode } from "react";
import "./app.css";

// Set the theme before first paint so there's no dark→light flash. Defaults to
// the OS preference, then remembers the user's choice. Scoped to /app; the
// marketing pages never read `data-theme`.
const themeInit = `(function(){try{var t=localStorage.getItem('av-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      <div className="av font-sans">{children}</div>
    </>
  );
}
