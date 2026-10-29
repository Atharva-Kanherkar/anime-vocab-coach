import { describe, expect, it } from "vitest";
import { UNITS } from "./curriculum";
import { CLIPS, EPISODE_IDS, LESSONS, LESSON_IDS, courseOutline, publicLesson } from "./course";
import { validScript } from "./domain";
import { render } from "./text";
import { courseRomajiWords } from "./tutor";

const KANA = /[ぁ-ゖァ-ヺ]/;
const KANJI = /[一-鿿㐀-䶿]/;

describe("Your Lie in April course map", () => {
  it("has 24 ordered units mapping every episode 1-22 exactly once", () => {
    expect(LESSONS).toHaveLength(24);
    expect(LESSONS.map((l) => l.unit)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    const episodes = LESSONS.map((l) => l.episode?.number ?? null);
    expect(episodes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, null, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, null]);
    expect(LESSONS[11].kind).toBe("study");
    expect(LESSONS[23].kind).toBe("final");
    expect(LESSONS.filter((l) => l.kind === "episode")).toHaveLength(22);
    expect(new Set(LESSON_IDS).size).toBe(24);
    expect(new Set(EPISODE_IDS).size).toBe(22);
    expect(courseOutline().units.map((u) => u.lessonId)).toEqual(LESSON_IDS);
  });

  it("matches the official episode titles", () => {
    expect(UNITS.flatMap((u) => (u.episode ? [u.episode.title] : []))).toEqual([
      "Monotone/Colorful", "Friend A", "Inside Spring", "The Journey", "Cloudy Skies", "On the Way Home", "The Shadow Whispers", "Let It Ring",
      "Resonance", "The Scenery I Shared With You", "Light of Life", "Twinkle Little Star", "Love's Sorrow", "Footsteps", "Liar", "Two of a Kind",
      "Twilight", "Hearts Come Together", "Goodbye, Hero", "Hand in Hand", "Snow", "Spring Wind",
    ]);
  });
});

describe.each(LESSONS.map((l) => [l.id, l] as const))("lesson %s", (_id, lesson) => {
  const choices = lesson.questions.filter((q) => q.kind === "choice");
  const writing = lesson.questions.filter((q) => q.kind === "production");

  it("has the planned amount of teaching and assessment", () => {
    expect(lesson.vocabulary.length).toBeGreaterThanOrEqual(8);
    expect(lesson.vocabulary.length).toBeLessThanOrEqual(12);
    expect(lesson.grammar.length).toBeGreaterThanOrEqual(1);
    expect(lesson.grammar.length).toBeLessThanOrEqual(2);
    for (const g of lesson.grammar) expect(g.examples.length).toBeGreaterThanOrEqual(2);
    expect(lesson.dialogue.length).toBeGreaterThanOrEqual(4);
    expect(lesson.dialogue.length).toBeLessThanOrEqual(6);
    expect(choices).toHaveLength(lesson.kind === "final" ? 20 : lesson.kind === "study" ? 12 : 8);
    expect(writing).toHaveLength(lesson.kind === "final" ? 3 : 2);
    if (lesson.kind === "episode") {
      for (const skill of ["vocabulary", "grammar", "reading", "listening"]) expect(choices.some((q) => q.skill === skill)).toBe(true);
      expect(lesson.episode!.summary.length).toBeGreaterThan(80);
    }
    expect(lesson.speaking.prompts.length).toBeGreaterThanOrEqual(2);
  });

  it("has unique ids and exactly one correct, distinct choice per question", () => {
    expect(new Set(lesson.questions.map((q) => q.id)).size).toBe(lesson.questions.length);
    expect(new Set(lesson.vocabulary.map((v) => v.id)).size).toBe(lesson.vocabulary.length);
    for (const q of choices) {
      expect(q.choices).toHaveLength(3);
      expect(q.choices.map((c) => c.id)).toEqual(["a", "b", "c"]);
      expect(q.choices.filter((c) => c.id === q.correctOption)).toHaveLength(1);
      for (const script of ["romaji", "kana"] as const) expect(new Set(q.choices.map((c) => c.text[script].toLowerCase())).size).toBe(3);
      if (q.skill === "listening") expect(q.audio).toMatch(/^[0-9a-f]{16}$/);
      if (q.choiceLanguage === "en") for (const c of q.choices) expect(KANA.test(c.text.romaji)).toBe(false);
    }
    for (const w of writing) expect(w.references.length).toBeGreaterThanOrEqual(1);
  });

  it("does not always put the correct answer in the same position", () => {
    expect(new Set(choices.map((q) => q.correctOption)).size).toBeGreaterThan(1);
  });

  it.each(["romaji", "kana"] as const)("keeps every learner-facing string in %s, with no kanji", (script) => {
    const pub = publicLesson(lesson, script);
    const japanese = [
      ...pub.vocabulary.map((v) => v.reading), ...pub.grammar.flatMap((g) => [g.example, ...g.examples.map((e) => e.text)]),
      ...pub.dialogue.map((d) => d.text), pub.speaking.opener.text,
      ...pub.questions.flatMap((q) => [...(q.text ? [q.text] : []), ...(q.choiceLanguage === "ja" ? q.choices!.map((c) => c.text) : [])]),
      ...lesson.questions.flatMap((q) => (q.kind === "production" ? q.references.map((r) => r[script]) : q.transcript ? [q.transcript[script]] : [])),
    ];
    for (const text of japanese) expect(validScript(text, script), text).toBe(true);
    const english = [
      pub.canDo, pub.hook, pub.summary ?? "", pub.speaking.goal, ...pub.speaking.prompts, pub.speaking.opener.english,
      ...pub.vocabulary.map((v) => v.meaning), ...pub.grammar.flatMap((g) => [g.title, g.explanation, ...g.examples.map((e) => e.english)]),
      ...pub.dialogue.map((d) => d.english), ...pub.questions.map((q) => q.prompt),
      ...pub.questions.flatMap((q) => (q.choiceLanguage === "en" ? q.choices!.map((c) => c.text) : [])),
      ...lesson.questions.flatMap((q) => (q.kind === "choice" ? [q.explanation[script]] : [])),
    ];
    const romajiWords = courseRomajiWords();
    for (const text of english) {
      expect(KANJI.test(text), text).toBe(false);
      if (script === "romaji") expect(KANA.test(text), text).toBe(false);
      else {
        // Kana mode may contain kana and English, but never the course's own romaji words.
        const leaked = text.toLowerCase().split(/[^a-z']+/).filter((w) => romajiWords.has(w));
        expect(leaked, text).toEqual([]);
      }
    }
    expect(JSON.stringify(pub)).not.toMatch(KANJI);
  });
});

describe("audio clips", () => {
  it("registers every clip referenced by a lesson, with kana-only speech", () => {
    const referenced = new Set<string>();
    for (const lesson of LESSONS) {
      for (const v of lesson.vocabulary) referenced.add(v.audio);
      for (const g of lesson.grammar) for (const e of g.examples) referenced.add(e.audio);
      for (const d of lesson.dialogue) referenced.add(d.audio);
      referenced.add(lesson.speaking.opener.audio);
      for (const q of lesson.questions) if (q.kind === "choice" && q.audio) referenced.add(q.audio);
    }
    for (const id of referenced) {
      expect(CLIPS.has(id), id).toBe(true);
      expect(validScript(CLIPS.get(id)!, "kana")).toBe(true);
      expect(CLIPS.get(id)).not.toContain(" ");
    }
    expect(CLIPS.size).toBe(referenced.size);
  });

  it("never reuses a vocabulary clip id for a listening question", () => {
    const vocabulary = new Set(LESSONS.flatMap((l) => l.vocabulary.map((v) => v.audio)));
    const examples = new Set(LESSONS.flatMap((l) => [...l.dialogue.map((d) => d.audio), ...l.grammar.flatMap((g) => g.examples.map((e) => e.audio))]));
    for (const lesson of LESSONS) for (const q of lesson.questions) if (q.kind === "choice" && q.audio) {
      expect(vocabulary.has(q.audio)).toBe(false);
      expect(examples.has(q.audio)).toBe(false);
    }
  });

  it("speaks the same kana the learner reads", () => {
    expect(CLIPS.get(LESSONS[0].vocabulary[0].audio)).toBe(render("はじめまして").kana);
  });
});
