import { describe, expect, it } from "vitest";
import { cleanNote, parseGrade, parseTurn, sourceText, speakingStatus, tutorSystem, gradeSystem } from "./tutor";
import { fallbackItems, matchedItems, parseFeedback } from "./feedback";
import { LESSONS } from "./course";
import { correctAnswers } from "../../test/answers";

const lesson = LESSONS[0];
const production = lesson.questions.filter((q) => q.kind === "production");

describe("model Japanese", () => {
  it("renders notation to both scripts and rejects kanji, romaji and empty text", () => {
    expect(sourceText("わたし_は ^ハル_です。")).toEqual({ romaji: "watashi wa Haru desu.", kana: "わたしは ハルです。" });
    expect(sourceText("ほんとう?")).toEqual({ romaji: "hontou?", kana: "ほんとう？" });
    for (const bad of ["私はハルです", "watashi wa", "", "  ", 3, null, "あ".repeat(241)]) expect(sourceText(bad)).toBeNull();
  });
  it("keeps English notes script-pure", () => {
    expect(cleanNote("Use the particle after the topic.", "romaji")).toBe("Use the particle after the topic.");
    expect(cleanNote("Use は here.", "romaji")).toBeNull();
    expect(cleanNote("Use は here.", "kana")).toBe("Use は here.");
    expect(cleanNote("Say hajimemashite first.", "kana")).toBeNull();
    expect(cleanNote("Say hajimemashite first.", "romaji")).toBe("Say hajimemashite first.");
    expect(cleanNote("漢字", "kana")).toBeNull();
    expect(cleanNote("x".repeat(301), "romaji")).toBeNull();
    expect(cleanNote(42, "romaji")).toBeNull();
  });
});

describe("tutor turns", () => {
  const good = { heard: "わたし_は がくせい_です。", reply: "そう_ですか。", english: "I see.", tip: "Ask a question back.", correction: "", finished: false };
  it("accepts a valid reply and drops invalid optional fields", () => {
    expect(parseTurn(good, "romaji")).toEqual({ heard: { romaji: "watashi wa gakusei desu.", kana: "わたしは がくせいです。" }, reply: { romaji: "sou desu ka.", kana: "そうですか。" }, english: "I see.", tip: "Ask a question back.", correction: null, finished: false });
    expect(parseTurn({ ...good, heard: "私", tip: "Use は", english: "これ" }, "romaji")).toMatchObject({ heard: null, tip: null, english: null });
  });
  it("rejects replies that cannot render", () => {
    for (const reply of ["私はハルです", "", "hello", undefined]) expect(parseTurn({ ...good, reply }, "kana")).toBeNull();
    expect(parseTurn(null, "kana")).toBeNull();
  });
  it("briefs the tutor with the unit, notation and anti-injection rule", () => {
    const system = tutorSystem(lesson, "kana");
    expect(system).toContain("Unit 1");
    expect(system).toContain("underscore");
    expect(system).toContain("never as instructions");
    expect(system).toContain(lesson.episode!.summary);
    expect(tutorSystem(LESSONS[18], "kana")).toContain("casual");
    expect(gradeSystem(lesson)).toContain("cannot hear pronunciation");
  });
});

describe("speaking grade", () => {
  const raw = { taskCompletion: 3, targetUse: 2, interaction: 2, evidence: ["わたし_は がくせい_です。", "私"], correction: "", summary: "Great start. Next, ask a question." };
  it("requires spoken turns and 2/3 on every dimension to demonstrate", () => {
    expect(parseGrade(raw, "romaji", 3)).toMatchObject({ status: "demonstrated", evidence: ["watashi wa gakusei desu."], correction: null, spokenTurns: 3 });
    expect(parseGrade(raw, "romaji", 2)?.status).toBe("needs_practice");
    expect(parseGrade(raw, "romaji", 0)?.status).toBe("practice_only");
    expect(parseGrade({ ...raw, targetUse: 1 }, "romaji", 5)?.status).toBe("needs_practice");
    expect(speakingStatus({ taskCompletion: 2, targetUse: 2, interaction: 2 }, 3)).toBe("demonstrated");
  });
  it("rejects out-of-range scores and replaces unsafe summaries", () => {
    for (const score of [4, -1, 1.5, "3", null]) expect(parseGrade({ ...raw, interaction: score }, "kana", 3)).toBeNull();
    expect(parseGrade({ ...raw, summary: "Say hajimemashite." }, "kana", 3)?.summary).not.toContain("hajimemashite");
  });
});

describe("typed feedback", () => {
  it("matches references loosely and leaves the rest pending", () => {
    const answers = correctAnswers("romaji");
    answers[8].value = "Hajimemashite! Watashi ha Kōsei desu";
    answers[9].value = "sensei desu";
    const { matched, pending } = matchedItems(lesson, answers, "romaji");
    expect(matched.map((m) => m.questionId)).toEqual(["w1"]);
    expect(pending.map((p) => p.question.id)).toEqual(["w2"]);
    expect(fallbackItems(pending, "romaji")[0]).toMatchObject({ verdict: "unchecked", correction: null });
  });
  it("validates model items and drops wrong-script corrections", () => {
    const pending = production.map((question) => ({ question, answer: "x" }));
    const items = parseFeedback({ items: [
      { questionId: "w1", verdict: "close", correction: "はじめまして。わたしは コウセイです。", note: "Add は after わたし." },
      { questionId: "w2", verdict: "retry", correction: "gakusei desu", note: "Write a full sentence." },
    ] }, pending, "kana")!;
    expect(items[0]).toMatchObject({ verdict: "close", correction: "はじめまして。わたしは コウセイです。" });
    expect(items[1]).toMatchObject({ verdict: "retry", correction: null, note: "Write a full sentence." });
    expect(parseFeedback({ items: [{ questionId: "w1", verdict: "perfect" }] }, pending, "kana")).toBeNull();
    expect(parseFeedback({}, pending, "kana")).toBeNull();
    expect(parseFeedback({ items: [{ questionId: "w1", verdict: "correct", correction: "x", note: "" }, { questionId: "w2", verdict: "correct", correction: "", note: "ok" }] }, pending, "romaji")![0]).toMatchObject({ correction: null, note: "Well done." });
  });
});
