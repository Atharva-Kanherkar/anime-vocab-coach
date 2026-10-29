import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { answersSchema, attemptSchema, enrolmentSchema, eventSchema, finishSchema, grade, validScript } from "./domain";
import { TRACK_ID, correctAnswers, correctText } from "../../test/answers";
import { LESSONS } from "./course";

const options = { seed: 1742026, numRuns: 1000 };
describe("seeded N5 domain fuzzing", () => {
  it("arbitrary JSON never crashes contract validation and cannot inject identities or grades", () => {
    fc.assert(fc.property(fc.jsonValue(), (value) => {
      for (const schema of [enrolmentSchema, attemptSchema, answersSchema, eventSchema, finishSchema]) expect(() => schema.safeParse(value)).not.toThrow();
      expect(enrolmentSchema.safeParse({ trackId: TRACK_ID, script: "romaji", idempotencyKey: "key", userId: value }).success).toBe(false);
      expect(finishSchema.safeParse({ revision: 0, passed: value }).success).toBe(false);
    }), options);
  });
  it("arbitrary Unicode never crosses the selected script boundary", () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 0x10ffff }), { maxLength: 100 }), fc.constantFrom("romaji" as const, "kana" as const), (points, script) => {
      const text = String.fromCodePoint(...points);
      if (validScript(text, script)) {
        if (script === "romaji") {
          const normalized = text.normalize("NFKC").replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
          const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZāīūēōâîûêôĀĪŪĒŌÂÎÛÊÔ0123456789 .,!?'\"():;-";
          expect([...normalized].every((c) => alphabet.includes(c))).toBe(true);
          expect(/[a-zāīūēōâîûêô]/i.test(normalized)).toBe(true);
        }
        else { const normalized = text.normalize("NFKC"); expect(/[a-z\u4e00-\u9fff]/i.test(normalized)).toBe(false); expect(/[\u3041-\u3096\u30a1-\u30fa]/.test(normalized)).toBe(true); }
      }
      if (/[a-z]/i.test(text)) expect(validScript(`ハル${text}`, "kana")).toBe(false);
      expect(validScript(`Haru${text}ハル`, "romaji")).toBe(false);
      expect(validScript(`ハル${text}Haru`, "romaji")).toBe(false);
    }), options);
  });
  it("keyboard variants stay within the chosen script under normalization", () => {
    fc.assert(fc.property(fc.array(fc.constantFrom("ā", "ī", "ū", "ē", "ō", "â", "î", "û", "ê", "ô", "a\u0304", "’", "‘", "“", "”", "　"), { maxLength: 50 }), (characters) => {
      const text = `Haru${characters.join("")}`;
      expect(validScript(text, "romaji")).toBe(true);
      expect(validScript(text, "kana")).toBe(false);
      expect(validScript(`${text}ハル`, "romaji")).toBe(false);
    }), options);
  });
  it("normal kana punctuation remains valid without admitting romaji or punctuation-only text", () => {
    fc.assert(fc.property(fc.array(fc.constantFrom("（", "）", "『", "』", "：", "　", "…", "〜"), { minLength: 1, maxLength: 50 }), (characters) => {
      const punctuation = characters.join("");
      expect(validScript(`ハル${punctuation}です`, "kana")).toBe(true);
      expect(validScript(punctuation, "kana")).toBe(false);
      expect(validScript(`ハル${punctuation}Haru`, "kana")).toBe(false);
      expect(validScript(`ハル${punctuation}`, "romaji")).toBe(false);
    }), options);
  });
  it("random objective answers have independently calculated bounded scores and never imply mastery", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: LESSONS.length }), fc.array(fc.constantFrom("a", "b", "c"), { minLength: 20, maxLength: 20 }), fc.constantFrom("romaji" as const, "kana" as const), (unit, picks, script) => {
      const lesson = LESSONS[unit - 1];
      const answers = correctAnswers(script, unit);
      let expected = 0;
      let total = 0;
      lesson.questions.forEach((q, index) => {
        if (q.kind !== "choice") return;
        answers[index].value = picks[total];
        // Oracle: the authored text, not the grader's key.
        if (q.choices.find((c) => c.id === picks[total])!.text[script] === correctText(unit, q.id, script)) expected++;
        total++;
      });
      const result = grade(lesson, answers, script);
      expect(result.correct).toBe(expected);
      expect(result.total).toBe(total);
      expect(result.objectivePercent).toBeCloseTo(expected / total * 100);
      expect(result.passed).toBe(expected / total >= 0.8);
      expect(Object.values(result.skills).reduce((sum, s) => sum + s.total, 0)).toBe(total);
      expect(result.mastery).toBe(false);
      expect(result.production).toBe("needs_review");
      expect(result.speaking).toBe("not_assessed");
    }), options);
  });
  it("arbitrary idempotency keys and revisions respect schema boundaries", () => {
    fc.assert(fc.property(fc.string({ maxLength: 150 }), fc.double({ noNaN: false }), (idempotencyKey, revision) => {
      const accepted = enrolmentSchema.safeParse({ trackId: TRACK_ID, script: "kana", idempotencyKey }).success;
      expect(accepted).toBe(idempotencyKey.length >= 1 && idempotencyKey.length <= 100 && [...idempotencyKey].every((char) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-".includes(char)));
      expect(finishSchema.safeParse({ revision }).success).toBe(Number.isInteger(revision) && revision >= 0 && revision <= 1000000);
    }), options);
  });
});
