import { beforeAll, describe, expect, it } from "vitest";
import kuromoji from "kuromoji";
import { resolve } from "node:path";
import { displayTexts, dualPieces, dualText } from "../src/lib/dual-line";
import { kataToHira } from "../src/lib/romaji";
import type { Token } from "../src/types";

let tokenizer: { tokenize: (s: string) => { surface_form: string; basic_form: string; reading?: string; pos: string; pos_detail_1: string }[] };
beforeAll(async () => {
  tokenizer = await new Promise((ok, fail) =>
    kuromoji.builder({ dicPath: resolve("extension/kuromoji/dict") }).build((err, t) => (err ? fail(err) : ok(t as never)))
  );
}, 30_000);
// The same mapping as src/lib/tokenizer.ts.
const tokens = (line: string): Token[] =>
  tokenizer.tokenize(line).map((t) => ({
    surface: t.surface_form, base: t.basic_form === "*" ? t.surface_form : t.basic_form,
    reading: kataToHira(t.reading || ""), pos: t.pos, pos1: t.pos_detail_1,
  }));
const romaji = (line: string, readings?: Record<string, string>) => dualText(dualPieces(tokens(line), "romaji", readings), "romaji");
const kana = (line: string) => dualText(dualPieces(tokens(line), "kana"), "kana");

describe("dual subtitle romaji", () => {
  it.each([
    ["はじめまして。わたしは学生です。", "Hajimemashite. Watashi wa gakusei desu."],
    ["かをりちゃん、ピアノを弾いてよ！", "Kaori-chan, piano o hiite yo!"],
    ["昨日、本を読んだ。", "Kinou, hon o yonda."],
    ["何してるの？", "Nani shiteru no?"],
    ["食べています。", "Tabete imasu."],
    ["椿さんは中学生ですか。", "Tsubaki-san wa chuugakusei desu ka."],
    ["学校へ行く。", "Gakkou e iku."],
    ["「好きだよ」って言ったんだ。", "“Suki da yo” tte ittan da."],
  ])("%s → %s", (line, expected) => {
    expect(romaji(line)).toBe(expected);
  });

  it("capitalises every sentence in the pieces themselves, as shown on screen", () => {
    const pieces = dualPieces(tokens("はじめまして。わたしは学生です。「好きだよ」って。"), "romaji");
    const shown = displayTexts(pieces, "romaji");
    expect(shown).toEqual(["Hajimemashite.", "Watashi", "wa", "gakusei", "desu.", "“Suki", "da", "yo”", "tte."]);
    expect(dualText(pieces, "romaji")).toBe(shown.join(" "));
    expect(displayTexts(dualPieces(tokens("きみはうそをついた。"), "kana"), "kana")[0]).toBe("きみ");
  });

  it("takes corrected readings for words the tokenizer misread", () => {
    expect(romaji("公生です。")).not.toBe("Kousei desu.");
    expect(romaji("公生です。", { "0": "こうせい" })).toBe("Kousei desu.");
  });

  it("keeps one piece per word, each pointing at its first token", () => {
    const pieces = dualPieces(tokens("ピアノを弾いてよ"), "romaji");
    expect(pieces.map((p) => p.text)).toEqual(["piano", "o", "hiite", "yo"]);
    expect(pieces[2].tokens).toEqual([2, 3]);
    expect(pieces.every((p, i) => i === 0 || !p.attached)).toBe(true);
  });
});

describe("dual subtitle kana and original", () => {
  it("spaces words and keeps Japanese punctuation and katakana loanwords", () => {
    expect(kana("君は嘘をついていた。")).toBe("きみ は うそ を ついて いた。");
    expect(kana("ピアノを弾いて")).toBe("ピアノ を ひいて");
  });

  it("shows the original line untouched", () => {
    expect(dualText(dualPieces(tokens("君は嘘をついていた。"), "kanji"), "kanji")).toBe("君は嘘をついていた。");
  });

  it("handles empty and punctuation-only lines", () => {
    expect(dualText(dualPieces([], "romaji"), "romaji")).toBe("");
    expect(romaji("……")).toBe("……");
  });
});

describe("readings from the track", () => {
  it("reads a name split by the tokenizer as one word", () => {
    const toks = tokens("公生、ピアノ弾いてよ。");
    const split = toks.findIndex((t) => t.surface === "公");
    if (split >= 0 && toks[split + 1]?.surface === "生") {
      expect(dualText(dualPieces(toks, "romaji", { [split]: "こうせい", [split + 1]: "" }), "romaji")).toBe("Kousei, piano hiite yo.");
    } else {
      const whole = toks.findIndex((t) => t.surface === "公生");
      expect(dualText(dualPieces(toks, "romaji", { [whole]: "こうせい" }), "romaji")).toBe("Kousei, piano hiite yo.");
    }
  });
});
