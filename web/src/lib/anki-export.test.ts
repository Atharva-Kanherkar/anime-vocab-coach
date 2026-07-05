import { describe, it, expect } from "vitest";
import { toAnkiCsv, ankiCardCount, ANKI_COLUMNS } from "./anki-export";

// Data rows are the CSV lines that aren't Anki `#` directives.
const dataRows = (csv: string) => csv.trimEnd().split("\n").filter((l) => !l.startsWith("#"));
import type { CloudSyncSnapshot, CloudWordRecord } from "./sync";

function word(partial: Partial<CloudWordRecord>): CloudWordRecord {
  return {
    base: "猫", state: "learning", reading: "ねこ", gloss: "cat",
    level: 5, freqRank: 900, seenCount: 1, shownCount: 0,
    firstSeenAt: null, lastSeenAt: null, review: null, source: null,
    ...partial,
  };
}

function snap(words: CloudWordRecord[]): CloudSyncSnapshot {
  return { schemaVersion: 1, source: "animevocab-extension", importedAt: "", sourceExportedAt: null, settings: {}, words, daily: [], cardTimestamps: [] };
}

describe("toAnkiCsv", () => {
  it("leads with Anki directives, then one row per cardable word", () => {
    const csv = toAnkiCsv(snap([
      word({ base: "約束", reading: "やくそく", gloss: "promise", state: "learning", source: { title: "AoT", line: "約束を守る", en: "keep the promise" } }),
    ]));
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("#separator:Comma");
    expect(lines).toContain(`#columns:${ANKI_COLUMNS.join(",")}`);
    const data = dataRows(csv);
    expect(data).toHaveLength(1);
    expect(data[0]).toBe(`"約束","やくそく","promise","約束を守る","AoT — keep the promise","learning"`);
  });

  it("skips new and ignored words", () => {
    const csv = toAnkiCsv(snap([
      word({ base: "a", state: "learning" }),
      word({ base: "b", state: "known" }),
      word({ base: "c", state: "new" }),
      word({ base: "d", state: "ignored" }),
    ]));
    expect(dataRows(csv)).toHaveLength(2);
    expect(csv).toContain('"a"');
    expect(csv).toContain('"b"');
    expect(csv).not.toContain('"c"');
    expect(csv).not.toContain('"d"');
  });

  it("escapes commas, quotes, and CR/LF per RFC 4180", () => {
    const csv = toAnkiCsv(snap([
      word({ base: "X", gloss: 'a, b "c"', source: { title: null, line: "line1\r\nline2", en: null } }),
    ]));
    const row = dataRows(csv)[0];
    expect(row).toContain('"a, b ""c"""'); // quotes doubled, comma safe inside quotes
    expect(row).toContain('"line1 line2"'); // CRLF flattened to a single space
  });

  it("handles missing source/reading gracefully", () => {
    const csv = toAnkiCsv(snap([word({ base: "空", reading: "", gloss: "", source: null })]));
    expect(dataRows(csv)[0]).toBe(`"空","","","","","learning"`);
  });
});

describe("ankiCardCount", () => {
  it("counts only learning + known", () => {
    expect(ankiCardCount(snap([
      word({ state: "learning" }), word({ state: "known" }), word({ state: "new" }), word({ state: "ignored" }),
    ]))).toBe(2);
  });
});
