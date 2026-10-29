import { describe, expect, it } from "vitest";
import { answersSchema, attemptSchema, completeAnswers, enrolmentSchema, eventSchema, fingerprint, finishSchema, grade, packHash, review, validScript, validateAnswers, invalidAnswerQuestionId } from "./domain";
import { LESSONS, MAX_QUESTIONS, lessonById, publicLesson } from "./course";
import { CONTENT_VERSION, EPISODE_ID, LESSON_ID, TRACK_ID, correctAnswers } from "../../test/answers";

const lesson = lessonById(LESSON_ID)!;

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
    for (const script of ["romaji", "kana"]) expect(attemptSchema.parse({ ...create, script })).toEqual({ ...create, script });
    for (const script of [null, "", "kanji", "romaji-kana"]) expect(attemptSchema.safeParse({ ...create, script }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...create, contentVersion: "old" }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...create, lessonId: "other" }).success).toBe(false);
    for (const l of LESSONS) expect(attemptSchema.safeParse({ ...create, lessonId: l.id }).success).toBe(true);
    const snapshot = { revision: 0, idempotencyKey: "one", answers: [{ questionId: "q1", value: "a" }] };
    expect(answersSchema.parse(snapshot)).toEqual(snapshot);
    for (const revision of [-1, 0.1, Infinity, NaN, 1000001, "0"]) expect(answersSchema.safeParse({ ...snapshot, revision }).success).toBe(false);
    expect(finishSchema.parse({ revision: 1000000 })).toEqual({ revision: 1000000 });
    expect(finishSchema.safeParse({ revision: 0, passed: true }).success).toBe(false);
    expect(answersSchema.safeParse({ ...snapshot, answers: [] }).success).toBe(false);
    expect(answersSchema.safeParse({ ...snapshot, answers: Array(MAX_QUESTIONS + 1).fill(snapshot.answers[0]) }).success).toBe(false);
    for (const value of ["", "a".repeat(501)]) expect(answersSchema.safeParse({ ...snapshot, answers: [{ questionId: "q1", value }] }).success).toBe(false);
    expect(answersSchema.safeParse({ ...snapshot, answers: [{ questionId: "q1", value: "a".repeat(500) }] }).success).toBe(true);
    const event = { episodeId: EPISODE_ID, kind: "watch_complete", idempotencyKey: "watch" };
    expect(eventSchema.parse(event)).toEqual(event);
    expect(eventSchema.safeParse({ ...event, kind: "mastered" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...event, kind: "practice_complete" }).success).toBe(true);
    expect(eventSchema.safeParse({ ...event, episodeId: "other" }).success).toBe(false);
  });
});

describe("pure script validation", () => {
  it.each(["Arigatō gozaimasu", "Tōkyō", "āīūēōâîûêô", "ĀĪŪĒŌÂÎÛÊÔ", "I’m Haru", "I‘m Haru", "a\u0304", "Ａｒｉｇａｔｏｕ", "Haru desu “hajimemashite”", "＂Haru＂"])("accepts normal romaji keyboard input: %s", (text) => {
    expect(validScript(text, "romaji")).toBe(true);
    expect(validScript(text, "kana")).toBe(false);
  });
  it.each(["はじめまして　ハルです", "ハルです〜", "ハルです～", "ハルです…", "ハルです！？", "はるて\u3099す", "ﾊﾙﾃﾞｽ", "ハル（はる）です", "『はる』です", "はる：です", "ハル(はる)です"])("accepts normal kana keyboard input: %s", (text) => {
    expect(validScript(text, "kana")).toBe(true);
    expect(validScript(text, "romaji")).toBe(false);
  });
  it("does not silently remove unsupported quotation marks from kana input", () => {
    for (const text of ["’はる", "‘はる", "“はる”", "”はる"]) expect(validScript(text, "kana")).toBe(false);
  });
  it("identifies only the first invalid question, without echoing its typed text", () => {
    expect(invalidAnswerQuestionId(lesson, correctAnswers(), "romaji")).toBeNull();
    expect(invalidAnswerQuestionId(lesson, [{ questionId: "w1", value: "Haruです" }], "romaji")).toBe("w1");
    expect(invalidAnswerQuestionId(lesson, [{ questionId: "unknown", value: "a" }], "romaji")).toBe("unknown");
    expect(invalidAnswerQuestionId(lesson, [{ questionId: "q1", value: "invalid" }], "romaji")).toBe("q1");
    expect(invalidAnswerQuestionId(lesson, [{ questionId: "q1", value: "a" }, { questionId: "q1", value: "a" }], "romaji")).toBe("q1");
    expect(invalidAnswerQuestionId(lessonById(LESSONS[1].id)!, [{ questionId: "q9", value: "a" }], "romaji")).toBe("q9");
  });
  it.each(["romaji", "kana"] as const)("accepts the %s fixture and rejects wrong-script production", (script) => {
    for (const unit of LESSONS.map((l) => l.unit)) {
      const l = LESSONS[unit - 1];
      const answers = correctAnswers(script, unit);
      expect(validateAnswers(l, answers, script)).toBe(true);
      expect(completeAnswers(l, answers, script)).toBe(true);
      expect(completeAnswers(l, answers.slice(1), script)).toBe(false);
      expect(validateAnswers(l, [...answers.slice(0, 1), ...answers.slice(0, 1)], script)).toBe(false);
    }
    expect(validateAnswers(lesson, [{ questionId: "unknown", value: "a" }], script)).toBe(false);
    expect(validateAnswers(lesson, [{ questionId: "q1", value: "z" }], script)).toBe(false);
    expect(validateAnswers(lesson, [{ questionId: "w1", value: script === "kana" ? "Haru" : "ハル" }], script)).toBe(false);
  });
  it("requires actual letters and rejects mixed text, kanji, controls and unreviewed Unicode", () => {
    expect(validScript("Haru desu!", "romaji")).toBe(true);
    expect(validScript("ハルです。", "kana")).toBe(true);
    for (const text of ["", "123", " ", "Haruです", "ですHaru", "春", "😀", "\u200b", "Haru\n", "ハル\t", "āハル", "…", "〜", "’", "Haru\r", "はる\n", "Haru\u200d", "Haru\u2028", "“”", "（）『』：", "“Haruです”", "『Haru』"]) for (const script of ["romaji", "kana"] as const) expect(validScript(text, script)).toBe(false);
  });
});

describe("public rendering and server grading", () => {
  it.each(["romaji", "kana"] as const)("returns only public fields in %s for every lesson", (script) => {
    for (const l of LESSONS) {
      const pub = publicLesson(l, script);
      expect(pub).toMatchObject({ apiVersion: 1, id: l.id, courseId: "n5-foundations", contentVersion: CONTENT_VERSION, episodeId: l.episodeId, script, status: "unreviewed_preview", trackId: TRACK_ID, unit: l.unit });
      expect(pub.questions).toHaveLength(l.questions.length);
      pub.questions.forEach((q, i) => {
        const source = l.questions[i];
        expect(q).toMatchObject({ id: source.id, objectiveId: source.objectiveId, prompt: source.prompt[script], kind: source.kind, skill: source.skill });
        if (source.kind === "choice") {
          expect(q.choices).toEqual(source.choices.map((c) => ({ id: c.id, text: c.text[script] })));
          if (source.choiceLanguage === "ja") q.choices!.forEach((c) => expect(validScript(c.text, script)).toBe(true));
        } else expect(q.choices).toBeUndefined();
      });
      for (const text of [...pub.vocabulary.map((v) => v.reading), ...pub.grammar.flatMap((g) => g.examples.map((e) => e.text)), ...pub.dialogue.map((d) => d.text), pub.speaking.opener.text])
        expect(validScript(text, script)).toBe(true);
      expect(JSON.stringify(pub)).not.toMatch(/correctOption|references|transcript/);
      for (const q of pub.questions) expect(Object.keys(q)).not.toContain("explanation");
    }
    expect(publicLesson(lesson, script).watchLinks).toEqual([{ provider: "Crunchyroll", url: "https://www.crunchyroll.com/series/G63V7KN9Y/your-lie-in-april", region: "unknown", availability: "unknown", checkedAt: null }]);
    expect(publicLesson(lesson, script).summarySource).toBe("https://www.yourlieinapril.com/story/01.html");
  });
  it("links lessons in order", () => {
    expect(publicLesson(LESSONS[0], "kana").previousLessonId).toBeNull();
    expect(publicLesson(LESSONS[0], "kana").nextLessonId).toBe(LESSONS[1].id);
    expect(publicLesson(LESSONS[23], "kana").nextLessonId).toBeNull();
  });
  it("perfect objective answers pass the lesson gate but never award writing, speaking or mastery", () => {
    expect(grade(lesson, correctAnswers(), "romaji")).toEqual({ correct: 8, total: 8, objectivePercent: 100, passed: true,
      skills: { vocabulary: { correct: 3, total: 3 }, grammar: { correct: 2, total: 2 }, reading: { correct: 1, total: 1 }, listening: { correct: 2, total: 2 } },
      production: "needs_review", speaking: "not_assessed", kanjiLiteracy: "not_assessed", mastery: false, outcome: "preview_practice_complete", script: "romaji" });
    const answers = correctAnswers("kana");
    const wrong = (index: number) => lesson.questions[index].kind === "choice" ? (lesson.questions[index] as { choices: { id: string }[] }).choices.find((c) => c.id !== answers[index].value)!.id : "";
    answers[0].value = wrong(0);
    expect(grade(lesson, answers, "kana")).toMatchObject({ correct: 7, total: 8, objectivePercent: 87.5, passed: true, script: "kana" });
    answers[1].value = wrong(1);
    expect(grade(lesson, answers, "kana")).toMatchObject({ correct: 6, objectivePercent: 75, passed: false });
    expect(() => grade(lesson, [], "romaji")).toThrow("incomplete_answers");
    answers[0].value = "garbage";
    expect(() => grade(lesson, answers, "kana")).toThrow("incomplete_answers");
  });
  it("reviews every question with the key, explanation, transcript and references in the attempt script", () => {
    const answers = correctAnswers("kana");
    const items = review(lesson, answers, "kana");
    expect(items).toHaveLength(10);
    for (const item of items.slice(0, 8)) expect(item).toMatchObject({ correct: true, correctChoiceId: expect.any(String), explanation: expect.any(String) });
    expect(items.find((i) => i.questionId === "q7")!.transcript).toBe("おはようございます。");
    expect(items.find((i) => i.questionId === "w1")).toEqual({ questionId: "w1", correct: null, answer: answers[8].value, references: ["はじめまして。わたしは コウセイです。", "はじめまして。コウセイです。"] });
    expect(review(lesson, [], "romaji").every((i) => i.answer === null)).toBe(true);
  });
  it("pins a per-lesson pack hash", async () => {
    expect(await packHash(lesson)).toMatch(/^[a-f0-9]{64}$/);
    expect(await packHash(lesson)).not.toBe(await packHash(LESSONS[1]));
  });
  it("hashes canonical validated payloads without retaining answer text", async () => {
    const a = await fingerprint({ value: "a" });
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe("d6d61f963ecf125d1b48333b18082156319c1202d1f886057da0ca987c3dff25");
    expect(await fingerprint({ value: "b" })).not.toBe(a);
  });
});
