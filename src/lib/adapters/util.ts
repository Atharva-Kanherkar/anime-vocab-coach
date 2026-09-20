import { normalizeDirection, type LearningDirection } from "../direction";

export function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Tags that stand in for a line break when a player injects HTML into cue
 *  text. WebVTT itself uses a literal newline, but some players emit `<br>`
 *  (or wrap each line in a block element) instead, and dropping those glues
 *  the last word of one line onto the first word of the next ("homesince"). */
const CUE_SEPARATOR_TAG = /<\s*\/?\s*(?:br|p|div)\b[^>]*>/gi;
/** Everything else: WebVTT's own inline spans (`<i> <b> <u> <c> <v> <lang>
 *  <ruby> <rt>`) and karaoke timestamp tags. None of these mark a word
 *  boundary, so they have to vanish without leaving a space behind — Japanese
 *  is written without spaces, and a stray one would split a word before
 *  kuromoji ever sees it. */
const CUE_INLINE_TAG = /<[^>]+>/g;

/** Strip markup from a VTT cue, keeping the words apart exactly where the
 *  markup actually separated them. `normalize()` collapses whatever runs of
 *  whitespace this leaves behind. */
export function stripCueTags(text: string): string {
  return text.replace(CUE_SEPARATOR_TAG, " ").replace(CUE_INLINE_TAG, "");
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
