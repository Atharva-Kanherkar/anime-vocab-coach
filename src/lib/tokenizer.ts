import { warn } from "./log";
import { kataToHira } from "./romaji";
import type { Token } from "../types";

let initPromise: Promise<KuromojiTokenizer> | null = null;
let tokenizerInstance: KuromojiTokenizer | null = null;

export function init(): Promise<KuromojiTokenizer> {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: chrome.runtime.getURL("kuromoji/dict/") }).build((err, tk) => {
      if (err) {
        warn("tokenizer init failed:", err);
        // Don't permanently disable: a single transient kuromoji load failure
        // used to kill tokenization for the whole tab (no card ever shows
        // again). Clearing initPromise lets a later call retry.
        initPromise = null;
        reject(err);
        return;
      }
      tokenizerInstance = tk;
      resolve(tk);
    });
  });

  return initPromise;
}

export async function tokenize(text: string): Promise<Token[]> {
  try {
    await init();
  } catch {
    // Transient init failure — return no tokens for this line; the next line
    // retries init rather than the tab being stuck cardless forever.
    return [];
  }
  if (!tokenizerInstance) return [];
  return tokenizerInstance.tokenize(text).map((t) => ({
    surface: t.surface_form,
    base: t.basic_form === "*" ? t.surface_form : t.basic_form,
    reading: kataToHira(t.reading || ""),
    pos: t.pos,
    pos1: t.pos_detail_1
  }));
}
