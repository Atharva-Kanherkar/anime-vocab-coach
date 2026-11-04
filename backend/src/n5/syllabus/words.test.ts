import { describe, expect, it } from "vitest";
import { UNITS } from "../curriculum";
import { render } from "../text";
import seedPos from "./seed-pos.json";
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

  it("has reviewed POS metadata for every seeded word and no extras", () => {
    const seeded = new Set(UNITS.flatMap((unit) => unit.vocabulary.map(([src]) => src)));
    expect(Object.keys(seedPos).sort()).toEqual([...seeded].sort());
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

describe("syllabus metadata corrections", () => {
  const byId = new Map(WORDS.map((word) => [word.id, word]));
  const bySrc = new Map(WORDS.map((word) => [word.src, word]));

  it("stores grammatical POS, not the topic tag", () => {
    for (const id of ["tabemasu", "nomimasu", "oshiemasu", "hikimasu"]) {
      expect(byId.get(id)?.pos, id).toBe("verb");
    }
    expect(byId.get("piano")?.pos).toBe("noun");
    expect(byId.get("piano")?.tags.length).toBeGreaterThan(0);
  });

  it("fixes glosses the source takes from the wrong sense", () => {
    expect(bySrc.get("はんぶん")?.meaning).toBe("half");
    expect(bySrc.get("せっけん")?.meaning).toBe("soap");
  });

  it("merges senses that share a reading", () => {
    expect(bySrc.get("あつい")?.meaning).toContain("hot");
    expect(bySrc.get("きる")?.meaning).toContain("wear");
    expect(bySrc.get("いる")?.meaning).toContain("need");
    expect(bySrc.get("かぜ")?.meaning).toContain("wind");
  });

  it("keeps a lexical は as ha, not the topic particle wa", () => {
    const tooth = bySrc.get("'は");
    expect(tooth?.id).toBe("ha");
    expect(tooth?.meaning).toBe("tooth");
    expect(render("'は")).toEqual({ romaji: "ha", kana: "は" });
    expect(render("は")).toEqual({ romaji: "wa", kana: "は" });
  });
});
