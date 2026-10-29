import { describe, expect, it } from "vitest";
import { clipId, foldKana, looseKey, looselyEqual, render, romaniseWord, speechText } from "./text";
import { validScript } from "./domain";

describe("render", () => {
  it.each([
    ["わたし_は ^コウセイ_です。", "watashi wa Kousei desu.", "わたしは コウセイです。"],
    ["がっこう_へ いきます。", "gakkou e ikimasu.", "がっこうへ いきます。"],
    ["ほん_を よみます。", "hon o yomimasu.", "ほんを よみます。"],
    ["はい、 そう_です。", "hai, sou desu.", "はい、そうです。"],
    ["おなまえ_は？", "onamae wa?", "おなまえは？"],
    ["こんばんは！", "konbanwa!", "こんばんは！"],
    ["きっぷ", "kippu", "きっぷ"],
    ["まっちゃ", "matcha", "まっちゃ"],
    ["こんや", "kon'ya", "こんや"],
    ["きんえん", "kin'en", "きんえん"],
    ["しゃしん", "shashin", "しゃしん"],
    ["コーヒー", "koohii", "コーヒー"],
    ["パーティー", "paatii", "パーティー"],
    ["ふつか", "futsuka", "ふつか"],
    ["じゅぎょう", "jugyou", "じゅぎょう"],
  ])("%s", (source, romaji, kana) => {
    expect(render(source)).toEqual({ romaji, kana });
    expect(validScript(romaji, "romaji")).toBe(true);
    expect(validScript(kana, "kana")).toBe(true);
  });

  it("reads the fixed greetings with wa", () => {
    expect(render("こんにちは").romaji).toBe("konnichiwa");
    expect(render("こんばんは。").romaji).toBe("konbanwa.");
  });

  it("rejects kanji, latin text and stray marks", () => {
    for (const bad of ["私", "abc", "", "  ", "ー", "っ", "あっ", "ハル1"]) expect(() => render(bad)).toThrow();
  });

  it("speaks kana without display spaces", () => {
    expect(speechText("わたし_は ^コウセイ_です。")).toBe("わたしはコウセイです。");
  });

  it("romanises a particle only when it is the whole word", () => {
    expect(romaniseWord("は")).toBe("wa");
    expect(romaniseWord("はな")).toBe("hana");
    expect(romaniseWord("を")).toBe("o");
  });
});

describe("looseKey", () => {
  it.each([
    ["Watashi wa Kousei desu.", "watashi wa Kousei desu."],
    ["watashi ha kousei desu", "watashi wa Kousei desu."],
    ["Watashi wa Kōsei desu", "watashi wa Kousei desu."],
    ["watashi wa kosei desu!", "watashi wa Kousei desu."],
    ["hon wo yomimasu", "hon o yomimasu."],
    ["gakkou he ikimasu", "gakkou e ikimasu."],
    ["watasi wa gakusei desu", "watashi wa gakusei desu."],
    ["tomodati desu", "tomodachi desu."],
    ["ohayō gozaimasu", "ohayou gozaimasu."],
    ["sensē", "sensei"],
    ["kon'ya", "konya"],
  ])("romaji %s matches %s", (answer, reference) => {
    expect(looselyEqual(answer, reference, "romaji")).toBe(true);
  });

  it.each([
    ["わたしは こうせいです", "わたしは コウセイです。"],
    ["ワタシハコウセイデス。", "わたしは コウセイです。"],
    ["わたしは　コウセイです！", "わたしは コウセイです。"],
  ])("kana %s matches %s", (answer, reference) => {
    expect(looselyEqual(answer, reference, "kana")).toBe(true);
  });

  it("does not forgive different words or particles in kana", () => {
    expect(looselyEqual("watashi wa sensei desu", "watashi wa gakusei desu.", "romaji")).toBe(false);
    expect(looselyEqual("わたしわ がくせいです", "わたしは がくせいです。", "kana")).toBe(false);
    expect(looselyEqual("", "", "romaji")).toBe(false);
    expect(looselyEqual("...", "...", "kana")).toBe(false);
  });

  it("keeps shu and chu intact while mapping hu to fu", () => {
    expect(looseKey("shukudai", "romaji")).toBe("shukudai");
    expect(looseKey("chuu", "romaji")).toBe("chu");
    expect(looseKey("huyu", "romaji")).toBe("fuyu");
  });

  it("folds katakana", () => { expect(foldKana("コーヒー")).toBe("こーひー"); });
});

describe("clipId", () => {
  it("is stable, 16 hex characters and seed-sensitive", () => {
    expect(clipId("a")).toMatch(/^[0-9a-f]{16}$/);
    expect(clipId("a")).toBe(clipId("a"));
    expect(clipId("a")).not.toBe(clipId("b"));
  });
});
