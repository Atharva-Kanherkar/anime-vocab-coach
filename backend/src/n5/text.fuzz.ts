import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { looseKey, looselyEqual, render } from "./text";
import { validScript } from "./domain";
import { cleanNote, parseGrade, parseTurn, sourceText } from "./tutor";

const options = { seed: 1742030, numRuns: 1000 };
const SYLLABLES = [..."あいうえおかきくけこがぎぐげごさしすせそざじずぜぞたちつてとだでどなにぬねのはひふへほばびぶべぼぱぴぷぺぽまみむめもやゆよらりるれろわん", "きゃ", "しゅ", "ちょ", "じゃ", "りょ", "っか", "っし", "っと", "ー"];
const KATAKANA = [..."アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン"];
const word = fc.array(fc.constantFrom(...SYLLABLES.filter((s) => s !== "ー")), { minLength: 1, maxLength: 5 }).map((parts) => parts.join(""));
const phrase = fc.array(fc.oneof(word, fc.constantFrom("は", "を", "へ", "の", "に", "が", "です"), fc.constantFrom(...KATAKANA).map((k) => `^${k}${k}`)), { minLength: 1, maxLength: 4 }).map((words) => words.join("_"));
const source = fc.tuple(fc.array(phrase, { minLength: 1, maxLength: 5 }), fc.constantFrom("", "。", "？", "！")).map(([phrases, end]) => phrases.join(" ") + end);

describe("seeded text fuzzing", () => {
  it("any well-formed source renders to pure romaji and pure kana with matching speech", () => {
    fc.assert(fc.property(source, (src) => {
      const text = render(src);
      expect(validScript(text.romaji, "romaji")).toBe(true);
      expect(validScript(text.kana, "kana")).toBe(true);
      expect(text.kana).not.toMatch(/[_^]/);
      expect(text.romaji).toMatch(/^[A-Za-z' .,?!]+$/);
      expect(text.romaji).not.toMatch(/ {2}| [.,?!]/);
      // Romaji and kana stay equal under the lenient keys of their own script.
      expect(looselyEqual(text.romaji, text.romaji.toUpperCase(), "romaji")).toBe(true);
      expect(looselyEqual(text.kana, text.kana.replace(/ /g, ""), "kana")).toBe(true);
    }), options);
  });
  it("arbitrary input never crashes rendering, keys or sanitizers", () => {
    fc.assert(fc.property(fc.string({ maxLength: 120 }), fc.constantFrom("romaji" as const, "kana" as const), (text, script) => {
      try { const out = render(text); expect(validScript(out.kana, "kana")).toBe(true); } catch (error) { expect(error).toBeInstanceOf(Error); }
      expect(typeof looseKey(text, script)).toBe("string");
      expect(looselyEqual(text, text, script)).toBe(looseKey(text, script).length > 0);
      const note = cleanNote(text, script);
      if (note !== null) expect(note).not.toMatch(/[一-鿿]/);
      const rendered = sourceText(text);
      if (rendered) { expect(validScript(rendered.romaji, "romaji")).toBe(true); expect(validScript(rendered.kana, "kana")).toBe(true); }
    }), options);
  });
  it("untrusted tutor and grader output is total and never leaks the other script", () => {
    fc.assert(fc.property(fc.jsonValue(), fc.constantFrom("romaji" as const, "kana" as const), fc.integer({ min: 0, max: 10 }), (raw, script, spoken) => {
      const turn = parseTurn(raw, script);
      if (turn) {
        expect(validScript(turn.reply[script], script)).toBe(true);
        if (turn.tip && script === "romaji") expect(turn.tip).not.toMatch(/[぀-ヿ]/);
      }
      const grade = parseGrade(raw, script, spoken);
      if (grade) {
        for (const n of [grade.taskCompletion, grade.targetUse, grade.interaction]) expect([0, 1, 2, 3]).toContain(n);
        for (const e of grade.evidence) expect(validScript(e, script)).toBe(true);
        if (spoken === 0) expect(grade.status).toBe("practice_only");
      }
    }), options);
  });
});
