import fc from "fast-check";
import { expect, it } from "vitest";
import { courseLessonFromState, wordsHeard } from "../src/lib/course-listening";

it("never throws on arbitrary course snapshots, and keeps heard ids inside the lesson", () => {
  fc.assert(fc.property(fc.anything(), fc.anything(), (lesson, extra) => {
    const parsed = courseLessonFromState({ lesson, extra });
    if (parsed) for (const id of parsed.heard) expect(parsed.words.some((w) => w.id === id)).toBe(true);
  }), { numRuns: 2000 });
});

it("only ever reports lesson words, each once", () => {
  const token = fc.record({ surface: fc.string(), base: fc.string(), reading: fc.string() });
  const word = fc.record({ id: fc.string({ minLength: 1 }), kana: fc.string() });
  fc.assert(fc.property(fc.array(token, { maxLength: 12 }), fc.uniqueArray(word, { maxLength: 8, selector: (w) => w.id }), (tokens, words) => {
    const heard = wordsHeard(tokens, words, () => null);
    expect(new Set(heard).size).toBe(heard.length);
    for (const id of heard) expect(words.some((w) => w.id === id)).toBe(true);
  }), { numRuns: 2000 });
});
