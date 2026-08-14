import { describe, expect, it } from "vitest";
import { buildGlossIndex, linkEnglishWord } from "../src/lib/gloss-link";
import type { DictEntry, Token } from "../src/types";

function tok(base: string): Token {
  return { surface: base, base, reading: "", pos: "名詞", pos1: "一般" };
}

const DICT: Record<string, DictEntry> = {
  "友達": { reading: "ともだち", glosses: ["friend", "companion"], level: 5, freqRank: 300 },
  "食べる": { reading: "たべる", glosses: ["to eat"], level: 5, freqRank: 120 },
  "約束": { reading: "やくそく", glosses: ["promise; vow", "appointment"], level: 4, freqRank: 900 },
  "は": { reading: "は", glosses: [], level: 1, freqRank: 1 },
};
const lookupFn = (base: string): DictEntry | null => DICT[base] || null;

describe("gloss-link", () => {
  const tokens = [tok("友達"), tok("は"), tok("約束"), tok("食べる")];
  const index = buildGlossIndex(tokens, lookupFn);

  it("links a direct gloss word to its token", () => {
    expect(linkEnglishWord("friend", index)).toBe(0);
    expect(linkEnglishWord("promise", index)).toBe(2);
  });

  it("links inflected English via lemmatization", () => {
    expect(linkEnglishWord("friends", index)).toBe(0);
    expect(linkEnglishWord("promised", index)).toBe(2);
    expect(linkEnglishWord("eating", index)).toBe(3);
  });

  it("ignores punctuation and case", () => {
    expect(linkEnglishWord("Friend,", index)).toBe(0);
    expect(linkEnglishWord("“promise”", index)).toBe(2);
  });

  it("returns -1 for unrelated or too-short words", () => {
    expect(linkEnglishWord("banana", index)).toBe(-1);
    expect(linkEnglishWord("to", index)).toBe(-1);
    expect(linkEnglishWord("", index)).toBe(-1);
  });

  it("skips generic gloss words like 'to'", () => {
    expect(index.has("to")).toBe(false);
  });

  it("earlier token wins a shared gloss word", () => {
    const dup = [tok("友達"), tok("約束")];
    const dict2 = {
      "友達": { reading: "", glosses: ["friend"], level: 5, freqRank: 1 },
      "約束": { reading: "", glosses: ["friend"], level: 5, freqRank: 2 },
    } as Record<string, DictEntry>;
    const idx2 = buildGlossIndex(dup, (b) => dict2[b] || null);
    expect(linkEnglishWord("friend", idx2)).toBe(0);
  });
});
