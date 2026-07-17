import { describe, it, expect } from "vitest";
import { lemmatize, tokenizeEnglish, hasEnglish } from "../src/lib/english-tokenize";
import {
  normalizeDirection,
  targetLang,
  explainLang,
  audioLang,
  contextSubtitleLabel,
} from "../src/lib/direction";
import { lookupForDirection, checkEligibility } from "../src/lib/scoring";

describe("direction", () => {
  it("defaults unknown values to en-ja", () => {
    expect(normalizeDirection(undefined)).toBe("en-ja");
    expect(normalizeDirection("ja-en")).toBe("ja-en");
  });

  it("maps study and explain languages", () => {
    expect(targetLang("en-ja")).toBe("ja");
    expect(explainLang("en-ja")).toBe("en");
    expect(targetLang("ja-en")).toBe("en");
    expect(explainLang("ja-en")).toBe("ja");
    expect(audioLang("ja-en")).toBe("en");
    expect(contextSubtitleLabel("ja-en")).toBe("Japanese subtitle");
  });
});

describe("english tokenize", () => {
  it("detects english", () => {
    expect(hasEnglish("I love you")).toBe(true);
    expect(hasEnglish("こんにちは")).toBe(false);
  });

  it("lemmatizes common endings", () => {
    expect(lemmatize("running")).toBe("run");
    expect(lemmatize("cats")).toBe("cat");
    expect(lemmatize("please")).toBe("please");
  });

  it("skips stopwords and keeps content words", () => {
    const tokens = tokenizeEnglish("I really love you forever");
    const bases = tokens.map((t) => t.base);
    expect(bases).toContain("love");
    expect(bases).toContain("really");
    expect(bases).toContain("forever");
    expect(bases).not.toContain("i");
    expect(bases).not.toContain("you");
  });
});

describe("ja-en scoring", () => {
  it("looks up English essentials with Japanese glosses", () => {
    const entry = lookupForDirection("please", "ja-en");
    expect(entry?.glosses[0]).toMatch(/お願い|どうぞ/);
  });

  it("marks CONTENT tokens eligible when essential", () => {
    const token = {
      surface: "Please",
      base: "please",
      reading: "",
      pos: "CONTENT",
      pos1: "english",
    };
    const check = checkEligibility(token, {}, null, Date.now(), "ja-en");
    expect(check.eligible).toBe(true);
    expect(check.entry?.glosses.length).toBeGreaterThan(0);
  });
});
