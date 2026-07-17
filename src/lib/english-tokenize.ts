import type { Token } from "../types";

/** Common function words — skip for vocab cards. */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "so", "as", "at", "by",
  "for", "from", "in", "into", "of", "on", "onto", "to", "with", "without",
  "about", "above", "after", "before", "between", "over", "under", "up", "down",
  "out", "off", "over", "again", "further", "once", "here", "there", "when",
  "where", "why", "how", "all", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "than", "too", "very",
  "can", "will", "just", "don", "should", "now", "i", "me", "my", "myself",
  "we", "our", "ours", "you", "your", "yours", "he", "him", "his", "she", "her",
  "hers", "it", "its", "they", "them", "their", "what", "which", "who", "whom",
  "this", "that", "these", "those", "am", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing",
  "would", "could", "ought", "i'm", "you're", "he's", "she's", "it's", "we're",
  "they're", "i've", "you've", "we've", "they've", "i'd", "you'd", "he'd",
  "she'd", "we'd", "they'd", "i'll", "you'll", "he'll", "she'll", "we'll",
  "they'll", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't",
  "hadn't", "doesn't", "don't", "didn't", "won't", "wouldn't", "shan't",
  "shouldn't", "can't", "cannot", "couldn't", "mustn't", "let's", "that's",
  "who's", "what's", "here's", "there's", "when's", "where's", "why's", "how's",
  "oh", "ah", "uh", "um", "yeah", "yes", "ok", "okay", "hey", "hi", "hello",
]);

/** Lightweight lemma: strip common English inflection endings. */
export function lemmatize(raw: string): string {
  const w = raw.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ves") && w.length > 4) return w.slice(0, -3) + "f";
  if (w.endsWith("ing") && w.length > 5) {
    const stem = w.slice(0, -3);
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) return stem.slice(0, -1);
    return stem;
  }
  if (w.endsWith("ed") && w.length > 4) {
    const stem = w.slice(0, -2);
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) return stem.slice(0, -1);
    return stem;
  }
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

export function hasEnglish(text: string): boolean {
  return /[A-Za-z]{2,}/.test(text);
}

/**
 * Split an English subtitle into content-word tokens.
 * POS is a generic CONTENT tag so scoring skips Japanese UniDic filters.
 */
export function tokenizeEnglish(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const surface = m[0];
    const lower = surface.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    if (lower.length < 3 && !/[A-Z]/.test(surface)) continue;
    const base = lemmatize(lower);
    if (STOPWORDS.has(base) || base.length < 2) continue;
    tokens.push({
      surface,
      base,
      reading: "",
      pos: "CONTENT",
      pos1: "english",
    });
  }
  return tokens;
}
