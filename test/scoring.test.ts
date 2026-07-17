import { describe, it, expect, vi } from "vitest";
import type { DictEntry, Settings, Token, VocabMap, VocabRecord } from "../src/types";
import { DEFAULTS } from "../src/types";

// The scoring module is the "which word do we teach" brain. It only depends on
// the dictionary's `lookup`, which we mock so tests are pure and deterministic.
// vi.hoisted keeps the fixture safe even if the import below is made static.
const { dict } = vi.hoisted(() => ({
  dict: {
    猫: { reading: "ねこ", glosses: ["cat"], level: 5, freqRank: 900 },
    犬: { reading: "いぬ", glosses: ["dog"], level: 5, freqRank: 900 }, // score-twin of 猫
    食べる: { reading: "たべる", glosses: ["to eat"], level: 5, freqRank: 500 },
    憂鬱: { reading: "ゆううつ", glosses: ["melancholy"], level: 1, freqRank: 18000 },
    学校: { reading: "がっこう", glosses: ["school"], level: 5, freqRank: 300 },
    目: { reading: "め", glosses: ["eye"], level: 5, freqRank: 1000 }, // single-kanji
    お願いします: { reading: "おねがいします", glosses: ["please"], level: 3, freqRank: 5000 },
  } as Record<string, DictEntry>,
}));

vi.mock("../src/lib/dictionary", () => ({
  lookup: (base: string) => dict[base] ?? null,
}));

const { hasKanji, checkEligibility, pickTarget } = await import("../src/lib/scoring");

function tok(base: string, pos = "名詞", pos1 = "一般"): Token {
  return { surface: base, base, reading: "", pos, pos1 };
}

// Fill a full VocabRecord so tests don't lie about the shape via casts.
function vocab(partial: Partial<VocabRecord>): VocabRecord {
  return {
    state: "new",
    reading: "",
    gloss: "",
    level: 5,
    freqRank: 1000,
    seenCount: 0,
    shownCount: 0,
    firstSeenAt: 0,
    lastSeenAt: 0,
    srs: null,
    ...partial,
  };
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

  it("rejects short kana-only tokens on the length gate", () => {
    // single kana, no kanji → rejected before dictionary lookup
    const r = checkEligibility(tok("め"), empty, null);
    expect(r.eligible).toBe(false);
    expect(r.countSeen).toBe(false);
  });

  it("allows an in-dictionary single-kanji word past the length gate", () => {
    const r = checkEligibility(tok("目"), empty, null);
    expect(r.eligible).toBe(true);
    expect(r.entry?.glosses[0]).toBe("eye");
  });

  it("rejects words missing from the dictionary", () => {
    const r = checkEligibility(tok("存在しない語"), empty, null);
    expect(r.eligible).toBe(false);
    expect(r.countSeen).toBe(false);
  });

  it("counts but does not re-teach known/ignored words", () => {
    const states: VocabMap = { 猫: vocab({ state: "known" }) };
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

  it("treats a learning word as eligible only when its review is due", () => {
    const now = 1_000_000;
    const notDue: VocabMap = { 猫: vocab({ state: "learning", srs: { stage: 2, dueAt: now + 5000, lapses: 0 } }) };
    const due: VocabMap = { 猫: vocab({ state: "learning", srs: { stage: 2, dueAt: now - 5000, lapses: 0 } }) };
    // not due yet: counted, but not re-served (prevents an SRS-resetting "learn" card)
    const r1 = checkEligibility(tok("猫"), notDue, null, now);
    expect(r1.eligible).toBe(false);
    expect(r1.countSeen).toBe(true);
    // due: eligible (for a review)
    expect(checkEligibility(tok("猫"), due, null, now).eligible).toBe(true);
  });
});

describe("pickTarget", () => {
  const settings: Settings = { ...DEFAULTS, targetLevel: 5 };

  it("returns null when nothing is eligible", () => {
    expect(pickTarget([tok("は", "助詞", "係助詞")], {}, settings, new Set())).toBeNull();
  });

  it("prioritizes a due review over a new word", () => {
    const states: VocabMap = {
      食べる: vocab({ state: "learning", srs: { stage: 2, dueAt: Date.now() - 1000, lapses: 0 } }),
    };
    const target = pickTarget([tok("猫"), tok("食べる", "動詞", "自立")], states, settings, new Set());
    expect(target).not.toBeNull();
    expect(target!.isReview).toBe(true);
    expect(target!.token.base).toBe("食べる");
  });

  it("picks the most-overdue review first", () => {
    const states: VocabMap = {
      食べる: vocab({ state: "learning", srs: { stage: 2, dueAt: Date.now() - 1000, lapses: 0 } }),
      学校: vocab({ state: "learning", srs: { stage: 3, dueAt: Date.now() - 9000, lapses: 0 } }),
    };
    const target = pickTarget([tok("食べる", "動詞", "自立"), tok("学校")], states, settings, new Set());
    expect(target!.isReview).toBe(true);
    expect(target!.token.base).toBe("学校");
  });

  it("does NOT re-serve a learning word before its review is due", () => {
    // 猫 is being learned but not due; 憂鬱 is below threshold. Nothing should be
    // served — critically, 猫 must not come back as a fresh isReview:false card.
    const states: VocabMap = {
      猫: vocab({ state: "learning", seenCount: 5, srs: { stage: 2, dueAt: Date.now() + 60_000, lapses: 0 } }),
    };
    const target = pickTarget([tok("猫"), tok("憂鬱")], states, settings, new Set());
    expect(target).toBeNull();
  });

  it("picks the higher-scoring word among two above-threshold candidates", () => {
    // 猫 (0.780) vs 学校 (0.793): both clear the 0.35 threshold, so the
    // best-candidate comparison actually runs. 学校 wins on frequency.
    const target = pickTarget([tok("猫"), tok("学校")], {}, settings, new Set());
    expect(target).not.toBeNull();
    expect(target!.token.base).toBe("学校");
    expect(target!.isReview).toBe(false);
  });

  it("uses the familiarity term to break ties between equal-score words", () => {
    // 猫 and 犬 have identical freq/level; 猫 has been seen 5x → familiarity edge.
    const states: VocabMap = { 猫: vocab({ state: "new", seenCount: 5 }) };
    const target = pickTarget([tok("犬"), tok("猫")], states, settings, new Set());
    expect(target!.token.base).toBe("猫");
  });

  it("drops candidates below the score threshold", () => {
    // 憂鬱 alone: 0.045 << 0.35 → no target.
    expect(pickTarget([tok("憂鬱")], {}, settings, new Set())).toBeNull();
  });

  it("boosts essential beginner phrases like お願いします", () => {
    // 犬 is common but not essential-boosted; お願いします should win on boost.
    const target = pickTarget([tok("犬"), tok("お願いします")], {}, settings, new Set());
    expect(target!.token.base).toBe("お願いします");
  });
});
