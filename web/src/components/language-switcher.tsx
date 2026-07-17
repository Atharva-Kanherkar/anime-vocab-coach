"use client";

import { useSiteLocale } from "@/components/locale-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useSiteLocale();

  return (
    <div
      className={compact ? "lang-switch lang-switch--compact" : "lang-switch"}
      role="group"
      aria-label="Site language"
    >
      <button
        type="button"
        className={locale === "ja" ? "lang-switch__btn is-active" : "lang-switch__btn"}
        aria-pressed={locale === "ja"}
        onClick={() => setLocale("ja")}
      >
        日本語
      </button>
      <button
        type="button"
        className={locale === "en" ? "lang-switch__btn is-active" : "lang-switch__btn"}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
    </div>
  );
}
