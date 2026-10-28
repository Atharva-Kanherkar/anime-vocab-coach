import { describe, expect, it } from "vitest";
import { answersSchema, attemptSchema, completeAnswers, enrolmentSchema, eventSchema, fingerprint, finishSchema, grade, publicLesson, validScript, validateAnswers } from "./domain";
import { CONTENT_VERSION, EPISODE_ID, GRAMMAR, LESSON_ID, QUESTIONS, TRACK_ID, VOCABULARY } from "./content";
import { correctAnswers } from "../../test/answers";

describe("strict request contracts", () => {
  const enrolment = { trackId: TRACK_ID, script: "romaji", idempotencyKey: "abc_1-z" };
  it("only accepts the preview track, pure scripts, and bounded stable keys", () => {
    expect(enrolmentSchema.parse(enrolment)).toEqual(enrolment);
    for (const script of ["kanji", "romaji-kana", "", null]) expect(enrolmentSchema.safeParse({ ...enrolment, script }).success).toBe(false);
    for (const idempotencyKey of ["", "a".repeat(101), "a/b", "鍵", " space", "a.b"]) expect(enrolmentSchema.safeParse({ ...enrolment, idempotencyKey }).success).toBe(false);
    expect(enrolmentSchema.safeParse({ ...enrolment, idempotencyKey: "x".repeat(100) }).success).toBe(true);
    expect(enrolmentSchema.safeParse({ ...enrolment, trackId: "spy-x-family-2022" }).success).toBe(false);
    expect(enrolmentSchema.safeParse({ ...enrolment, userId: "victim" }).success).toBe(false);
    expect(enrolmentSchema.safeParse({ ...enrolment, score: 100 }).success).toBe(false);
  });
  it("pins content and bounds revisions, answers, events and finish bodies", () => {
    const create = { lessonId: LESSON_ID, contentVersion: CONTENT_VERSION, idempotencyKey: "one" };
    expect(attemptSchema.parse(create)).toEqual(create);
    expect(attemptSchema.safeParse({ ...create, contentVersion: "old" }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...create, lessonId: "other" }).success).toBe(false);
    const snapshot = { revision: 0, idempotencyKey: "one", answers: [{ questionId: "greeting", value: "a" }] };
    expect(answersSchema.parse(snapshot)).toEqual(snapshot);
    for (const revision of [-1, 0.1, Infinity, NaN, 1000001, "0"]) expect(answersSchema.safeParse({ ...snapshot, revision }).success).toBe(false);
    expect(finishSchema.parse({ revision: 1000000 })).toEqual({ revision: 1000000 });
    expect(finishSchema.safeParse({ revision: 0, passed: true }).success).toBe(false);
    expect(answersSchema.safeParse({ ...snapshot, answers: [] }).success).toBe(false);
    expect(answersSchema.safeParse({ ...snapshot, answers: Array(11).fill(snapshot.answers[0]) }).success).toBe(false);
    for (const value of ["", "a".repeat(501)]) expect(answersSchema.safeParse({ ...snapshot, answers: [{ questionId: "greeting", value }] }).success).toBe(false);
    expect(answersSchema.safeParse({ ...snapshot, answers: [{ questionId: "greeting", value: "a".repeat(500) }] }).success).toBe(true);
    const event = { episodeId: EPISODE_ID, kind: "watch_complete", idempotencyKey: "watch" };
    expect(eventSchema.parse(event)).toEqual(event);
    expect(eventSchema.safeParse({ ...event, kind: "mastered" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...event, kind: "practice_complete" }).success).toBe(true);
    expect(eventSchema.safeParse({ ...event, episodeId: "other" }).success).toBe(false);
  });
});

describe("pure script validation", () => {
  it.each(["romaji", "kana"] as const)("accepts the %s fixture and rejects wrong-script production", (script) => {
    const answers = correctAnswers(script);
    expect(validateAnswers(answers, script)).toBe(true);
    expect(completeAnswers(answers, script)).toBe(true);
    expect(completeAnswers(answers.slice(1), script)).toBe(false);
    expect(validateAnswers([...answers.slice(0, 1), ...answers.slice(0, 1)], script)).toBe(false);
    expect(validateAnswers([{ questionId: "unknown", value: "a" }], script)).toBe(false);
    expect(validateAnswers([{ questionId: "greeting", value: "z" }], script)).toBe(false);
    expect(validateAnswers([{ questionId: "write-name", value: script === "kana" ? "Haru" : "ハル" }], script)).toBe(false);
  });
  it("requires actual letters and rejects mixed text, kanji, controls and unreviewed Unicode", () => {
    expect(validScript("Haru desu!", "romaji")).toBe(true);
    expect(validScript("ハルです。", "kana")).toBe(true);
    for (const text of ["", "123", " ", "Haruです", "春", "😀", "\u200b", "Haru\n", "ハル\t"]) for (const script of ["romaji", "kana"] as const) expect(validScript(text, script)).toBe(false);
  });
});

describe("public rendering and server grading", () => {
  it.each(["romaji", "kana"] as const)("returns only public fields in %s and keeps semantic choice IDs", (script) => {
    const lesson = publicLesson(script);
    expect(lesson).toMatchObject({ apiVersion: 1, id: LESSON_ID, courseId: "n5-foundations", contentVersion: CONTENT_VERSION, episodeId: EPISODE_ID, script, status: "unreviewed_preview", canDo: expect.stringContaining("Greet"), summarySource: "https://www.yourlieinapril.com/story/01.html" });
    expect(lesson.summary).toContain("student");
    expect(lesson.vocabulary).toEqual(VOCABULARY.map((v) => ({ id: v.id, reading: v.text[script], meaning: v.meaning })));
    expect(lesson.grammar).toEqual(GRAMMAR.map((g) => ({ id: g.id, explanation: g.explanation, example: g.text[script] })));
    expect(lesson.watchLinks).toEqual([{ provider: "Crunchyroll", url: "https://www.crunchyroll.com/series/G63V7KN9Y/your-lie-in-april", region: "unknown", availability: "unknown", checkedAt: null }]);
    expect(lesson.questions).toHaveLength(10);
    lesson.questions.forEach((q, i) => {
      expect(Object.keys(q).sort()).toEqual(q.kind === "choice" ? ["choices", "id", "kind", "objectiveId", "prompt"] : ["id", "kind", "objectiveId", "prompt"]);
      expect(q).toMatchObject({ id: QUESTIONS[i].id, objectiveId: QUESTIONS[i].objectiveId, prompt: QUESTIONS[i].prompt, kind: QUESTIONS[i].kind });
      expect(q.choices).toEqual(QUESTIONS[i].choices?.map((c) => ({ id: c.id, text: c.text[script] })));
      q.choices?.forEach((c) => expect(validScript(c.text, script)).toBe(true));
    });
    expect(JSON.stringify(lesson)).not.toMatch(/correctOption|acceptedAnswer/);
  });
  it("perfect objective answers still cannot award writing/speaking/listening or mastery", () => {
    expect(grade(correctAnswers(), "romaji")).toEqual({ correct: 8, total: 8, objectivePercent: 100, production: "needs_review", speaking: "not_assessed", listening: "not_assessed", kanjiLiteracy: "not_assessed", mastery: false, outcome: "preview_practice_complete", script: "romaji" });
    const answers = correctAnswers("kana");
    answers[0].value = "a";
    expect(grade(answers, "kana")).toMatchObject({ correct: 7, total: 8, objectivePercent: 87.5, script: "kana" });
    expect(() => grade([], "romaji")).toThrow("incomplete_answers");
    answers[0].value = "garbage";
    expect(() => grade(answers, "kana")).toThrow("incomplete_answers");
  });
  it("hashes canonical validated payloads without retaining answer text", async () => {
    const a = await fingerprint({ value: "a" });
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe("d6d61f963ecf125d1b48333b18082156319c1202d1f886057da0ca987c3dff25");
    expect(await fingerprint({ value: "b" })).not.toBe(a);
  });
});
