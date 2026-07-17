/** Bilingual anime immersion: EN↔JP only. Shared with the extension. */

export type LearningDirection = "en-ja" | "ja-en";

export const DEFAULT_DIRECTION: LearningDirection = "en-ja";

export function normalizeDirection(value: unknown): LearningDirection {
  return value === "ja-en" ? "ja-en" : "en-ja";
}

export function targetLang(direction: LearningDirection): "ja" | "en" {
  return direction === "ja-en" ? "en" : "ja";
}

export function explainLang(direction: LearningDirection): "ja" | "en" {
  return direction === "ja-en" ? "ja" : "en";
}

export function targetLangName(direction: LearningDirection): string {
  return direction === "ja-en" ? "English" : "Japanese";
}

export function explainLangName(direction: LearningDirection): string {
  return direction === "ja-en" ? "Japanese" : "English";
}

export function directionLabel(direction: LearningDirection): string {
  return direction === "ja-en"
    ? "日本語 → English（learn English）"
    : "English → 日本語（learn Japanese）";
}
