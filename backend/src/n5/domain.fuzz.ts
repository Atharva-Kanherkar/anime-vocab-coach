import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { answersSchema, attemptSchema, enrolmentSchema, eventSchema, finishSchema, grade, publicLesson, validScript } from "./domain";
import { correctAnswers } from "../../test/answers";
import { TRACK_ID } from "./content";

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
          const normalized = text.normalize("NFKC").replace(/[’‘]/g, "'");
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
    fc.assert(fc.property(fc.array(fc.constantFrom("ā", "ī", "ū", "ē", "ō", "â", "î", "û", "ê", "ô", "a\u0304", "’", "‘", "　"), { maxLength: 50 }), (characters) => {
      const text = `Haru${characters.join("")}`;
      expect(validScript(text, "romaji")).toBe(true);
      expect(validScript(text, "kana")).toBe(false);
      expect(validScript(`${text}ハル`, "romaji")).toBe(false);
    }), options);
  });
  it("random objective answers have independently calculated bounded scores and never imply mastery", () => {
    const oracle = ["b", "a", "c", "b", "c", "a", "b", "c"];
    fc.assert(fc.property(fc.array(fc.constantFrom("a", "b", "c"), { minLength: 8, maxLength: 8 }), fc.constantFrom("romaji" as const, "kana" as const), (choices, script) => {
      const answers = correctAnswers(script);
      choices.forEach((choice, index) => { answers[index].value = choice; });
      const expected = choices.reduce((total, choice, index) => total + Number(choice === oracle[index]), 0);
      const result = grade(answers, script);
      expect(result.correct).toBe(expected);
      expect(result.objectivePercent).toBe(expected * 12.5);
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
      for (const script of ["romaji", "kana"] as const) {
        const lesson = publicLesson(script);
        expect(JSON.stringify(lesson)).not.toMatch(/correctOption|acceptedAnswer/);
        lesson.questions.flatMap((q) => q.choices ?? []).forEach((c) => expect(validScript(c.text, script)).toBe(true));
      }
    }), options);
  });
});
