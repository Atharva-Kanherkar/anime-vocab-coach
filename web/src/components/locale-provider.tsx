"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  enPathToJa,
  isJaPath,
  jaPathToEn,
  type SiteLocale,
} from "@/lib/locale";
import { siteUi, type SiteUiKey } from "@/lib/i18n/site-ui";

type LocaleContextValue = {
  locale: SiteLocale;
  t: (key: SiteUiKey) => string;
  setLocale: (next: SiteLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookieLocale(): SiteLocale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return value === "ja" || value === "en" ? value : null;
}

function writeCookieLocale(locale: SiteLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

function resolveLocale(pathname: string): SiteLocale {
  if (isJaPath(pathname)) return "ja";
  return readCookieLocale() ?? "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  // Initial render must match SSR output (which can't see the cookie), so
  // derive only from the path here; the effect below applies the cookie
  // locale after hydration. Reading document.cookie in the initializer
  // causes hydration mismatches for every ja-cookie user on non-/ja pages.
  const [locale, setLocaleState] = useState<SiteLocale>(() => (isJaPath(pathname) ? "ja" : "en"));

  useEffect(() => {
    const next = resolveLocale(pathname);
    // Cookie locale is applied after hydration on purpose (see comment above
    // the initializer) — reading it during render would mismatch SSR output.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(next);
    document.documentElement.lang = next === "ja" ? "ja" : "en";
  }, [pathname]);

  const setLocale = useCallback(
    (next: SiteLocale) => {
      writeCookieLocale(next);
      setLocaleState(next);
      document.documentElement.lang = next === "ja" ? "ja" : "en";

      const jaTarget = enPathToJa(pathname);
      const enTarget = jaPathToEn(pathname);

      if (next === "ja") {
        window.location.href = jaTarget ?? (pathname === "/" ? "/ja" : pathname);
        return;
      }
      if (enTarget) {
        window.location.href = enTarget;
        return;
      }
      if (isJaPath(pathname)) {
        window.location.href = "/";
        return;
      }
      window.location.reload();
    },
    [pathname]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: (key) => siteUi(locale, key),
      setLocale,
    }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useSiteLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: "en",
      t: (key) => siteUi("en", key),
      setLocale: () => {},
    };
  }
  return ctx;
}
