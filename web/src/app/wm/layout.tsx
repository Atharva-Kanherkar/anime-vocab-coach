import type { ReactNode } from "react";
import "../app/app.css";

// Public manga share pages (/m/<id>) reuse the Cloud app's riso-print theme.
// app.css is scoped to the `.av` wrapper class, so importing it here styles
// only this subtree. Same before-paint theme init as /app to avoid a flash.
const themeInit = `(function(){try{var t=localStorage.getItem('av-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      <div className="av font-sans">{children}</div>
    </>
  );
}
