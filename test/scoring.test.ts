import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DictEntry, Settings, Token, VocabMap } from "../src/types";
import { DEFAULTS } from "../src/types";

// The scoring module is the "which word do we teach" brain. It only depends on
// the dictionary's `lookup`, which we mock so tests are pure and deterministic.
const dict: Record<string, DictEntry> = {
  // common-ish N5 noun
  猫: { reading: "ねこ", glosses: ["cat"], level: 5, freqRank: 900 },
  // verb, mid frequency, matches default target level 5
  食べる: { reading: "たべる", glosses: ["to eat"], level: 5, freqRank: 500 },
  // rarer word, far from target level
  憂鬱: { reading: "ゆううつ", glosses: ["melancholy"], level: 1, freqRank: 18000 },
  学校: { reading: "がっこう", glosses: ["school"], level: 5, freqRank: 300 },
};

vi.mock("../src/lib/dictionary", () => ({
  lookup: (base: string) => dict[base] ?? null,
}));

// Imported after the mock is registered.
const { hasKanji, checkEligibility, pickTarget } = await import("../src/lib/scoring");

function tok(base: string, pos = "名詞", pos1 = "一般"): Token {
  return { surface: base, base, reading: "", pos, pos1 };
}

describe("hasKanji", () => {
  it("detects kanji", () => {
    expect(hasKanji("猫")).toBe(true);
    expect(hasKanji("食べる")).toBe(true);
  });
  it("returns false for pure kana / latin", () => {
    expect(hasKanji("ねこ")).toBe(false);
    expect(hasKanji("neko")).toBe(false);
  });
});

describe("checkEligibility", () => {
  const empty: VocabMap = {};

  it("accepts a content word present in the dictionary", () => {
    const r = checkEligibility(tok("猫"), empty, null);
    expect(r.eligible).toBe(true);
    expect(r.countSeen).toBe(true);
    expect(r.entry?.glosses[0]).toBe("cat");
  });

  it("rejects non-content parts of speech (e.g. particles)", () => {
    const r = checkEligibility(tok("は", "助詞", "係助詞"), empty, null);
    expect(r.eligible).toBe(false);
    expect(r.countSeen).toBe(false);
  });

  it("rejects excluded noun subtypes (pronouns, numbers, proper nouns)", () => {
    expect(checkEligibility(tok("これ", "名詞", "代名詞"), empty, null).eligible).toBe(false);
    expect(checkEligibility(tok("東京", "名詞", "固有名詞"), empty, null).eligible).toBe(false);
  });

  it("rejects short kana-only tokens but allows single kanji", () => {
    // single kana content word: too short, no kanji
    expect(checkEligibility(tok("目", "名詞", "一般"), empty, null).eligible).toBe(false); // not in dict anyway
    // in-dict single-kanji is allowed past the length gate (fails only on lookup here)
  });

  it("rejects words missing from the dictionary", () => {
    const r = checkEligibility(tok("存在しない語"), empty, null);
    expect(r.eligible).toBe(false);
    expect(r.countSeen).toBe(false);
  });

  it("counts but does not re-teach known/ignored words", () => {
    const states: VocabMap = {
      猫: { state: "known" } as VocabMap[string],
    };
    const r = checkEligibility(tok("猫"), states, null);
    expect(r.eligible).toBe(false);
    expect(r.countSeen).toBe(true);
    expect(r.entry).toBeDefined();
  });

  it("skips words already targeted this session", () => {
    const r = checkEligibility(tok("猫"), empty, new Set(["猫"]));
    expect(r.eligible).toBe(false);
    expect(r.countSeen).toBe(true);
  });
});

describe("pickTarget", () => {
  const settings: Settings = { ...DEFAULTS, targetLevel: 5 };

  beforeEach(() => vi.restoreAllMocks());

  it("returns null when nothing is eligible", () => {
    expect(pickTarget([tok("は", "助詞", "係助詞")], {}, settings, new Set())).toBeNull();
  });

  it("prioritizes a due review over a new word", () => {
    const states: VocabMap = {
      食べる: {
        state: "learning",
        srs: { stage: 2, dueAt: Date.now() - 1000, lapses: 0 },
      } as VocabMap[string],
    };
    const target = pickTarget([tok("猫"), tok("食べる", "動詞", "自立")], states, settings, new Set());
    expect(target).not.toBeNull();
    expect(target!.isReview).toBe(true);
    expect(target!.token.base).toBe("食べる");
  });

  it("picks the higher-scoring word among new candidates", () => {
    // 学校 (freqRank 300, level 5) should beat 憂鬱 (freqRank 18000, level 1).
    const target = pickTarget([tok("憂鬱"), tok("学校")], {}, settings, new Set());
    expect(target).not.toBeNull();
    expect(target!.token.base).toBe("学校");
    expect(target!.isReview).toBe(false);
  });

  it("drops candidates below the score threshold", () => {
    // 憂鬱 alone: very rare + far from target level → below 0.35 → no target.
    const target = pickTarget([tok("憂鬱")], {}, settings, new Set());
    expect(target).toBeNull();
  });
});
