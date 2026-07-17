/** Extension locale helpers — ja→en default for Japanese UI language. */

import type { LearningDirection } from "../types";

export function isJapaneseUiLocale(): boolean {
  try {
    const ui = chrome.i18n?.getUILanguage?.() || navigator.language || "en";
    return ui.toLowerCase().startsWith("ja");
  } catch {
    return false;
  }
}

export function defaultDirectionForUiLocale(): LearningDirection {
  return isJapaneseUiLocale() ? "ja-en" : "en-ja";
}

export function resolveStoredDirection(stored: unknown): LearningDirection | null {
  if (stored === "ja-en" || stored === "en-ja") return stored;
  return null;
}
