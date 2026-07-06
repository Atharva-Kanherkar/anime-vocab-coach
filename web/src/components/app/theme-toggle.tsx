"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

// Toggles the `data-theme` attribute the app.css palette keys off of. The
// initial value is written pre-paint by the inline script in app/layout.tsx;
// here we just mirror and flip it.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
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
      <span aria-hidden className="text-base leading-none">
        {mounted ? (theme === "dark" ? "☀" : "☾") : "☾"}
      </span>
    </button>
  );
}
