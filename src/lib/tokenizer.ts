import { warn } from "./log";
import { kataToHira } from "./romaji";
import type { Token } from "../types";

let initPromise: Promise<KuromojiTokenizer> | null = null;
let tokenizerInstance: KuromojiTokenizer | null = null;
let disabled = false;

export function init(): Promise<KuromojiTokenizer> {
  if (disabled) return Promise.reject(new Error("tokenizer disabled"));
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: chrome.runtime.getURL("kuromoji/dict/") }).build((err, tk) => {
      if (err) {
        warn("tokenizer init failed:", err);
        disabled = true;
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
  await init();
  if (!tokenizerInstance) return [];
  return tokenizerInstance.tokenize(text).map((t) => ({
    surface: t.surface_form,
    base: t.basic_form === "*" ? t.surface_form : t.basic_form,
    reading: kataToHira(t.reading || ""),
    pos: t.pos,
    pos1: t.pos_detail_1
  }));
}
