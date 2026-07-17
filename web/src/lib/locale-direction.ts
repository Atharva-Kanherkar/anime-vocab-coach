import type { LearningDirection } from "./direction";
import { detectLocaleFromAcceptLanguage, type SiteLocale } from "./locale";

export const JA_EN_PROMPT_DISMISSED_KEY = "av-ja-en-prompt-dismissed";
export const DIRECTION_QUERY_KEY = "direction";

/** True when browser / Accept-Language prefers Japanese. */
export function isJapaneseLocale(opts?: {
  acceptLanguage?: string | null;
  navigatorLanguage?: string | null;
}): boolean {
  if (opts?.navigatorLanguage?.toLowerCase().startsWith("ja")) return true;
  return detectLocaleFromAcceptLanguage(opts?.acceptLanguage ?? null) === "ja";
}

/** Default learning direction when user has never saved an explicit choice. */
export function defaultDirectionForLocale(locale: SiteLocale): LearningDirection {
  return locale === "ja" ? "ja-en" : "en-ja";
}

export function resolveLearningDirection(
  stored: unknown,
  locale: SiteLocale = "en"
): LearningDirection {
  if (stored === "ja-en" || stored === "en-ja") return stored;
  return defaultDirectionForLocale(locale);
}

export function parseDirectionQuery(value: string | null | undefined): LearningDirection | null {
  return value === "ja-en" || value === "en-ja" ? value : null;
}
