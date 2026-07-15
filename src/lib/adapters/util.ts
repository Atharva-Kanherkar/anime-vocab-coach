import { normalizeDirection, type LearningDirection } from "../direction";

export function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function hasJapanese(text: string): boolean {
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/.test(text);
}

export function hasEnglish(text: string): boolean {
  return /[A-Za-z]{2,}/.test(text);
}

/** True when `text` looks like the language we're studying. */
export function matchesTargetScript(text: string, direction: LearningDirection): boolean {
  return normalizeDirection(direction) === "ja-en" ? hasEnglish(text) : hasJapanese(text);
}

/** Module-level direction for adapters (set from content settings). */
let activeDirection: LearningDirection = "en-ja";

export function setAdapterDirection(direction: LearningDirection): void {
  activeDirection = normalizeDirection(direction);
}

export function getAdapterDirection(): LearningDirection {
  return activeDirection;
}
