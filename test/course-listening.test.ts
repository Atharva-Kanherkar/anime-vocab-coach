import { describe, expect, it } from "vitest";
import { courseLessonFromState, coursePrompt, lessonUrl, soundKey, wordsHeard } from "../src/lib/course-listening";

// Readings as kuromoji gives them (katakana; tokenizer.ts converts to hiragana).
const t = (surface: string, reading: string, base = surface) => ({ surface, base, reading });
const words = [
  { id: "hajimemashite", kana: "はじめまして" },
  { id: "yoroshiku-onegaishimasu", kana: "よろしくおねがいします" },
  { id: "tomodachi", kana: "ともだち" },
  { id: "piano", kana: "ピアノ" },
  { id: "hiku", kana: "ひく" },
  { id: "e", kana: "え" },
];

describe("hearing lesson words", () => {
  it("normalises spellings to sound", () => {
    expect(soundKey("ピアノ")).toBe("ぴあの");
    expect(soundKey("よろしく おねがいします。")).toBe("よろしくおねがいします");
    expect(soundKey("ｺｳｾｲ")).toBe("こうせい");
    expect(soundKey("ラーメン")).toBe("らーめん");
  });

  it("finds words spelled by whole tokens, including runs of several", () => {
    const line = [t("はじめまして", "ハジメマシテ"), t("。", ""), t("よろしく", "ヨロシク"), t("お", "オ"), t("願い", "ネガイ"), t("し", "シ"), t("ます", "マス")];
    expect(wordsHeard(line, words)).toEqual(["hajimemashite", "yoroshiku-onegaishimasu"]);
    expect(wordsHeard([t("友達", "トモダチ"), t("だ", "ダ"), t("よ", "ヨ")], words)).toEqual(["tomodachi"]);
    expect(wordsHeard([t("ピアノ", "ピアノ"), t("を", "ヲ")], words)).toEqual(["piano"]);
  });

  it("does not take a slice of a longer word, or a single kana", () => {
    expect(wordsHeard([t("友達たち", "トモダチタチ")], words)).toEqual([]);
    expect(wordsHeard([t("え", "エ"), t("？", "")], words)).toEqual([]);
    expect(wordsHeard([], words)).toEqual([]);
  });

  it("hears conjugated forms through the dictionary form", () => {
    const line = [t("ピアノ", "ピアノ"), t("を", "ヲ"), t("弾い", "ヒイ", "弾く"), t("て", "テ")];
    expect(wordsHeard(line, words, (base) => (base === "弾く" ? "ひく" : null))).toEqual(["piano", "hiku"]);
    expect(wordsHeard(line, words)).toEqual(["piano"]);
    expect(wordsHeard([t("ひい", "ヒイ", "ひく"), t("て", "テ")], words)).toEqual(["hiku"]);
  });

  it("asks the dictionary for a dictionary form that is not all kana", () => {
    const line = [t("お願いし", "オネガイシ", "お願いする"), t("ます", "マス")];
    const asked: string[] = [];
    const reading = (base: string) => { asked.push(base); return base === "お願いする" ? "おねがいする" : null; };
    expect(wordsHeard(line, [{ id: "onegai", kana: "おねがいする" }], reading)).toEqual(["onegai"]);
    expect(asked).toContain("お願いする");
  });

  it("falls back to the surface when the tokenizer has no reading", () => {
    expect(wordsHeard([t("ピアノ", "")], words)).toEqual(["piano"]);
  });
});

const state = (lesson: unknown) => ({ apiVersion: 1, lesson });
const lesson = {
  id: "your-lie-in-april-u01", script: "romaji", canDo: "Greet someone new.", unit: 1, title: "Greet and introduce yourself",
  episode: { number: 1, title: "Monotone/Colorful" },
  vocabulary: [{ id: "tomodachi", reading: "tomodachi", meaning: "friend", kana: "ともだち" }],
  heard: ["tomodachi", "not-in-lesson", 4],
};

describe("the lesson from the course API", () => {
  it("keeps what Listening needs and drops what it cannot trust", () => {
    expect(courseLessonFromState(state(lesson))).toEqual({
      id: lesson.id, unit: 1, title: lesson.title, canDo: lesson.canDo, script: "romaji",
      episode: lesson.episode, words: [{ id: "tomodachi", reading: "tomodachi", meaning: "friend", kana: "ともだち" }], heard: ["tomodachi"],
    });
    expect(courseLessonFromState(state({ ...lesson, unit: 0, episode: null, title: 7 }))).toMatchObject({ unit: null, episode: null, title: null });
    expect(courseLessonFromState(state({ ...lesson, unit: 99 }))?.unit).toBe(99);
    expect(courseLessonFromState(state({ ...lesson, unit: 100 }))?.unit).toBeNull();
    expect(courseLessonFromState(state({ ...lesson, heard: undefined }))?.heard).toEqual([]);
    expect(courseLessonFromState(state({ ...lesson, heard: [{ toString: () => "tomodachi" }] }))?.heard).toEqual([]);
  });

  it("holds every field to its bound", () => {
    const word = lesson.vocabulary[0];
    expect(courseLessonFromState(state({ ...lesson, vocabulary: Array(20).fill(word) }))?.words).toHaveLength(20);
    expect(courseLessonFromState(state({ ...lesson, vocabulary: [{ ...word, reading: "a".repeat(120) }] }))).not.toBeNull();
    expect(courseLessonFromState(state({ ...lesson, vocabulary: [{ ...word, reading: "a".repeat(121) }] }))).toBeNull();
    expect(courseLessonFromState(state({ ...lesson, vocabulary: [{ reading: "x", meaning: "y" }] }))).toBeNull();
    expect(courseLessonFromState(state({ ...lesson, id: "your-lie-in-april-u01/../x" }))).toBeNull();
    // A function is an object to JavaScript, but never a lesson.
    expect(courseLessonFromState(state(Object.assign(() => {}, lesson)))).toBeNull();
  });

  it("rejects malformed lessons rather than showing them", () => {
    for (const bad of [null, "x", { ...lesson, id: "../x" }, { ...lesson, script: "kanji" }, { ...lesson, canDo: "" },
      { ...lesson, vocabulary: "x" }, { ...lesson, vocabulary: Array(21).fill(lesson.vocabulary[0]) }, { ...lesson, vocabulary: [{ id: "a" }] }]) {
      expect(courseLessonFromState(state(bad))).toBeNull();
    }
    expect(courseLessonFromState(null)).toBeNull();
    expect(courseLessonFromState({ lesson: null })).toBeNull();
  });

  it("matches kana-script lessons from older APIs that send no kana", () => {
    const kana = { ...lesson, script: "kana", vocabulary: [{ id: "tomodachi", reading: "ともだち", meaning: "friend" }] };
    expect(courseLessonFromState(state(kana))?.words[0].kana).toBe("ともだち");
    const romaji = { ...lesson, vocabulary: [{ id: "tomodachi", reading: "tomodachi", meaning: "friend" }] };
    expect(courseLessonFromState(state(romaji))?.words[0].kana).toBe("");
  });

  it("tells the copilot the unit, script and words", () => {
    const parsed = courseLessonFromState(state(lesson))!;
    expect(coursePrompt(parsed)).toEqual({ unit: 1, title: lesson.title, canDo: lesson.canDo, script: "romaji", words: ["tomodachi — friend"] });
    expect(coursePrompt({ ...parsed, unit: null })).toBeNull();
    expect(coursePrompt({ ...parsed, title: null })?.title).toBe("");
  });

  it("links only to the lesson on animevocab.com", () => {
    expect(lessonUrl({ id: "your-lie-in-april-u01", script: "kana" }, "practice")).toBe("https://animevocab.com/app/n5/lessons/your-lie-in-april-u01?script=kana#practice");
    expect(() => lessonUrl({ id: "../../evil", script: "kana" }, "watch")).toThrow("Invalid lesson");
    expect(() => lessonUrl({ id: "lesson?x=1", script: "kana" }, "watch")).toThrow("Invalid lesson");
  });
});
