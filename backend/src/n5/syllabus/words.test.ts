import { describe, expect, it } from "vitest";
import { UNITS } from "../curriculum";
import { render } from "../text";
import { WORDS } from "./plan";

const slug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

describe("N5 syllabus words", () => {
  it("ships 750-850 entries, of which 600 are in the 24-unit course", () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(750);
    expect(WORDS.length).toBeLessThanOrEqual(850);
    expect(WORDS.filter((word) => !word.reserve)).toHaveLength(600);
    expect(WORDS.filter((word) => word.reserve)).toHaveLength(151);
  });

  it("keeps every seeded curriculum word under its current id", () => {
    const seeded = new Map<string, string>();
    for (const unit of UNITS) {
      for (const [src] of unit.vocabulary) seeded.set(slug(render(src).romaji), src);
    }
    expect(seeded.size).toBeGreaterThanOrEqual(230);
    for (const [id, src] of seeded) {
      expect(WORDS.find((word) => word.id === id)?.src, id).toBe(src);
    }
  });

  it("renders every src in both scripts and matches the id to the romaji", () => {
    for (const word of WORDS) {
      const rendered = render(word.src);
      expect(rendered.kana, word.id).not.toBe("");
      expect(rendered.romaji, word.id).not.toBe("");
      expect(slug(rendered.romaji), word.id).toBe(word.id);
    }
  });

  it("has unique ids and unique src values", () => {
    expect(new Set(WORDS.map((word) => word.id)).size).toBe(WORDS.length);
    expect(new Set(WORDS.map((word) => word.src)).size).toBe(WORDS.length);
  });

  it("has a band from 1 to 4, a known part of speech and at least one tag", () => {
    const pos = new Set([
      "noun", "verb", "i-adjective", "na-adjective", "adjective", "adverb",
      "pronoun", "numeral", "counter", "conjunction", "expression", "particle",
    ]);
    for (const word of WORDS) {
      expect([1, 2, 3, 4], word.id).toContain(word.band);
      expect(pos.has(word.pos), `${word.id}: ${word.pos}`).toBe(true);
      expect(word.tags.length, word.id).toBeGreaterThan(0);
      expect(word.meaning.trim(), word.id).not.toBe("");
    }
  });

  it("marks reserve words with the reserve tag and nothing else", () => {
    for (const word of WORDS) {
      expect(Boolean(word.reserve), word.id).toBe(word.tags.includes("reserve"));
    }
  });
});
