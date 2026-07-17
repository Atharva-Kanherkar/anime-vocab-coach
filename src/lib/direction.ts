/** Bilingual anime immersion: EN↔JP only. */

export type LearningDirection = "en-ja" | "ja-en";

export const DEFAULT_DIRECTION: LearningDirection = "en-ja";

export function normalizeDirection(value: unknown): LearningDirection {
  return value === "ja-en" ? "ja-en" : "en-ja";
}

/** Language the learner is studying (captions / Listening Mode audio). */
export function targetLang(direction: LearningDirection): "ja" | "en" {
  return direction === "ja-en" ? "en" : "ja";
}

/** Language used for glosses and coach replies. */
export function explainLang(direction: LearningDirection): "ja" | "en" {
  return direction === "ja-en" ? "ja" : "en";
}

export function directionLabel(direction: LearningDirection): string {
  return direction === "ja-en"
    ? "日本語 → English（英語を学ぶ）"
    : "English → 日本語（Japanese）";
}

export function targetLangName(direction: LearningDirection): string {
  return direction === "ja-en" ? "English" : "Japanese";
}

export function explainLangName(direction: LearningDirection): string {
  return direction === "ja-en" ? "Japanese" : "English";
}

/** Caption / audio language code for Whisper & YouTube tracks. */
export function audioLang(direction: LearningDirection): "ja" | "en" {
  return targetLang(direction);
}

/** Context subtitle language (the other track). */
export function contextLang(direction: LearningDirection): "ja" | "en" {
  return direction === "ja-en" ? "ja" : "en";
}

export function contextSubtitleLabel(direction: LearningDirection): string {
  return direction === "ja-en" ? "Japanese subtitle" : "English subtitle";
}

export function chatPlaceholder(direction: LearningDirection): string {
  return direction === "ja-en"
    ? "このシーンの英語について聞く…"
    : "Ask about Japanese in this scene…";
}
