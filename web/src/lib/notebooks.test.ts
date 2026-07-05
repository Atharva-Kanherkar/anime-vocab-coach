import { describe, it, expect } from "vitest";
import {
  makeEntry,
  entryHasContent,
  normalizeNotebookStore,
  clampName,
  MAX_TAGS,
  MAX_NAME_LEN,
  MAX_TEXT_LEN,
} from "./notebooks";

describe("makeEntry", () => {
  it("defaults unknown kinds to 'word' and injects id/createdAt", () => {
    const e = makeEntry({ word: "猫" }, "id1", "2026-01-01T00:00:00.000Z");
    expect(e.kind).toBe("word");
    expect(e.id).toBe("id1");
    expect(e.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(e.word).toBe("猫");
  });

  it("keeps valid explicit kinds", () => {
    expect(makeEntry({ kind: "line", line: "x" }, "i", "t").kind).toBe("line");
    expect(makeEntry({ kind: "note", note: "x" }, "i", "t").kind).toBe("note");
  });

  it("clamps text fields and trims empties to null", () => {
    const long = "あ".repeat(MAX_TEXT_LEN + 50);
    const e = makeEntry({ word: long, gloss: "   ", note: "  keep " }, "i", "t");
    expect(e.word!.length).toBe(MAX_TEXT_LEN);
    expect(e.gloss).toBeNull();
    expect(e.note).toBe("keep");
  });

  it("dedupes and caps tags, coerces level", () => {
    const e = makeEntry(
      { note: "x", tags: ["a", "a", "b", ...Array.from({ length: 20 }, (_, i) => `t${i}`)], level: "3.7" },
      "i",
      "t"
    );
    expect(e.tags.length).toBeLessThanOrEqual(MAX_TAGS);
    expect(new Set(e.tags).size).toBe(e.tags.length); // unique
    expect(e.level).toBe(4); // rounded
  });

  it("rejects non-positive levels to null", () => {
    expect(makeEntry({ note: "x", level: 0 }, "i", "t").level).toBeNull();
    expect(makeEntry({ note: "x", level: "abc" }, "i", "t").level).toBeNull();
  });
});

describe("entryHasContent", () => {
  it("is true when any of word/line/note is present", () => {
    expect(entryHasContent(makeEntry({ word: "猫" }, "i", "t"))).toBe(true);
    expect(entryHasContent(makeEntry({ line: "x" }, "i", "t"))).toBe(true);
    expect(entryHasContent(makeEntry({ note: "x" }, "i", "t"))).toBe(true);
  });
  it("is false when the entry only has metadata (title/tags)", () => {
    expect(entryHasContent(makeEntry({ title: "AoT", tags: ["x"] }, "i", "t"))).toBe(false);
  });
});

describe("clampName", () => {
  it("defaults blank names and clamps length", () => {
    expect(clampName("   ")).toBe("Untitled notebook");
    expect(clampName(undefined)).toBe("Untitled notebook");
    expect(clampName("x".repeat(MAX_NAME_LEN + 10)).length).toBe(MAX_NAME_LEN);
  });
});

describe("normalizeNotebookStore", () => {
  it("returns an empty store for garbage input", () => {
    expect(normalizeNotebookStore(null)).toEqual({ schemaVersion: 1, notebooks: [] });
    expect(normalizeNotebookStore("nope").notebooks).toEqual([]);
  });

  it("drops notebooks without a string id, keeps valid ones and repairs fields", () => {
    const store = normalizeNotebookStore({
      notebooks: [
        { name: "no id here" }, // dropped
        {
          id: "nb1",
          name: "",
          entries: [
            { id: "e1", kind: "word", word: "猫" },
            { kind: "note", note: "no id" }, // dropped (no id)
          ],
        },
      ],
    });
    expect(store.notebooks).toHaveLength(1);
    expect(store.notebooks[0].name).toBe("Untitled notebook"); // blank → default
    expect(store.notebooks[0].entries).toHaveLength(1);
    expect(store.notebooks[0].entries[0].word).toBe("猫");
  });
});
