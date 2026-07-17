/** Site locale — cookie-backed, seeded from Accept-Language on first visit. */

export type SiteLocale = "en" | "ja";

export const LOCALE_COOKIE = "av-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** English marketing paths → Japanese mirror (when one exists). */
export const EN_TO_JA_PATH: Record<string, string> = {
  "/": "/ja",
  "/animelon-alternative": "/ja/animelon-alternative",
  "/does-language-reactor-work-on-crunchyroll": "/ja/language-reactor-crunchyroll",
  "/does-migaku-work-on-crunchyroll": "/ja/migaku-crunchyroll",
  "/learn-japanese-netflix-anime": "/ja/yomitan-netflix",
  "/without-extension": "/ja/kakucho-nashi",
  "/vs-language-reactor": "/ja/vs-language-reactor",
  "/learn-japanese-crunchyroll": "/ja/crunchyroll-eigo-jimaku",
  "/free-japanese-anime-extension": "/ja/eigo-jimaku-kakucho",
  "/learn-japanese-with-anime": "/ja/anime-eigo-listening",
};

const JA_TO_EN_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_JA_PATH).map(([en, ja]) => [ja, en])
);

export function detectLocaleFromAcceptLanguage(header: string | null): SiteLocale {
  if (!header) return "en";
  const parts = header.split(",").map((p) => p.split(";")[0]?.trim().toLowerCase() ?? "");
  for (const part of parts) {
    if (part.startsWith("ja")) return "ja";
    if (part.startsWith("en")) return "en";
  }
  return "en";
}

export function parseLocaleCookie(value: string | undefined): SiteLocale | null {
  return value === "ja" || value === "en" ? value : null;
}

export function resolveSiteLocale(opts: {
  cookie: string | undefined;
  acceptLanguage: string | null;
  langParam?: string | null;
}): SiteLocale {
  if (opts.langParam === "ja" || opts.langParam === "en") return opts.langParam;
  const fromCookie = parseLocaleCookie(opts.cookie);
  if (fromCookie) return fromCookie;
  return detectLocaleFromAcceptLanguage(opts.acceptLanguage);
}

export function enPathToJa(pathname: string): string | null {
  return EN_TO_JA_PATH[pathname] ?? null;
}

export function jaPathToEn(pathname: string): string | null {
  return JA_TO_EN_PATH[pathname] ?? null;
}

export function isJaPath(pathname: string): boolean {
  return pathname === "/ja" || pathname.startsWith("/ja/");
}
