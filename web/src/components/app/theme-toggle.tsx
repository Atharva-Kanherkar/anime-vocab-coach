"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@/components/app/icons";

type Theme = "dark" | "light";

// Toggles the `data-theme` attribute the app.css palette keys off of. The
// initial value is written pre-paint by the inline script in app/layout.tsx;
// here we just mirror and flip it.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // data-theme is set by a pre-hydration inline script, so it can only be
    // read after mount; adopting it here (and gating render on `mounted`) is
    // the intended SSR-safe pattern.
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current === "light" || current === "dark") setTheme(current);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("av-theme", next);
    } catch {
      /* private mode — theme just won't persist */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="av-btn av-btn-ghost av-btn-sm !px-2"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {mounted && theme === "dark" ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
    </button>
  );
}
