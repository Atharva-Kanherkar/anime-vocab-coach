// Links words in the English subtitle line to tokens in the paired Japanese
// line via dictionary glosses, so hovering an English word can surface the
// Japanese word it translates. Pure (no DOM, no chrome.*) for unit testing.
import { lemmatize } from "./english-tokenize";
import type { DictEntry, Token } from "../types";

/** Gloss words too generic to anchor a link ("to do", "be", "thing"...). */
const GLOSS_STOP = new Set([
  "the", "and", "for", "with", "from", "into", "onto", "one", "ones",
  "thing", "things", "person", "someone", "something", "esp", "etc",
  "very", "not", "non", "out", "off", "away", "become", "becoming",
  "make", "making", "used", "usually", "often", "form", "state",
]);

function glossWords(gloss: string): string[] {
  return gloss
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // parenthetical usage notes aren't translations
    .split(/[^a-z']+/)
    .filter((w) => w.length >= 3 && !GLOSS_STOP.has(w));
}

/**
 * Map of lemmatized English word -> index of the Japanese token whose gloss
 * contains it. Earlier tokens and earlier glosses win, so the most direct
 * translation keeps the link when two tokens share a gloss word.
 */
export function buildGlossIndex(
  tokens: Token[],
  lookupFn: (base: string) => DictEntry | null
): Map<string, number> {
  const index = new Map<string, number>();
  tokens.forEach((tk, i) => {
    const entry = lookupFn(tk.base);
    if (!entry) return;
    for (const gloss of entry.glosses.slice(0, 3)) {
      for (const word of glossWords(gloss)) {
        const lemma = lemmatize(word);
        if (!index.has(lemma)) index.set(lemma, i);
      }
    }
  });
  return index;
}

/** Token index in the JP line that an on-screen English word translates, or -1. */
export function linkEnglishWord(word: string, index: Map<string, number>): number {
  const clean = word.toLowerCase().replace(/[^a-z']/g, "");
  if (clean.length < 3) return -1;
  const lemma = lemmatize(clean);
  // lemmatize strips "-ed"/"-ing" without restoring a dropped final e
  // ("promised" -> "promis"), so also try the e-restored stem.
  for (const candidate of [clean, lemma, lemma + "e"]) {
    const idx = index.get(candidate);
    if (idx !== undefined) return idx;
  }
  return -1;
}
