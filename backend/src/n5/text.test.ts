import { describe, expect, it } from "vitest";
import { clipId, foldKana, looseKey, looselyEqual, render, renderInline, rendered, romaniseWord, speechText } from "./text";
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
    ["がくせい_ですか。", "gakusei desu ka.", "がくせいですか。"],
    ["いきませんか。", "ikimasen ka.", "いきませんか。"],
    ["さむい_ですね。", "samui desu ne.", "さむいですね。"],
    ["ゆき_です_よ。", "yuki desu yo.", "ゆきですよ。"],
    ["しずか", "shizuka", "しずか"],
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

describe("golden kana table", () => {
  // Independent oracle: each row written out by hand, separate from the implementation table.
  const rows: [string, string][] = [
    ["あいうえお", "a i u e o"], ["かきくけこ", "ka ki ku ke ko"], ["がぎぐげご", "ga gi gu ge go"],
    ["さしすせそ", "sa shi su se so"], ["ざじずぜぞ", "za ji zu ze zo"], ["たちつてと", "ta chi tsu te to"],
    ["だぢづでど", "da ji zu de do"], ["なにぬねの", "na ni nu ne no"], ["はひふへほ", "ha hi fu he ho"],
    ["ばびぶべぼ", "ba bi bu be bo"], ["ぱぴぷぺぽ", "pa pi pu pe po"], ["まみむめも", "ma mi mu me mo"],
    ["やゆよ", "ya yu yo"], ["らりるれろ", "ra ri ru re ro"], ["わをん", "wa o n"], ["ぁぃぅぇぉゃゅょゔ", "a i u e o ya yu yo vu"],
    ["きゃきゅきょ", "kya kyu kyo"], ["ぎゃぎゅぎょ", "gya gyu gyo"], ["しゃしゅしょしぇ", "sha shu sho she"], ["じゃじゅじょじぇ", "ja ju jo je"],
    ["ちゃちゅちょちぇ", "cha chu cho che"], ["ぢゃぢゅぢょ", "ja ju jo"], ["にゃにゅにょ", "nya nyu nyo"], ["ひゃひゅひょ", "hya hyu hyo"],
    ["びゃびゅびょ", "bya byu byo"], ["ぴゃぴゅぴょ", "pya pyu pyo"], ["みゃみゅみょ", "mya myu myo"], ["りゃりゅりょ", "rya ryu ryo"],
    ["てぃでぃとぅどぅ", "ti di tu du"], ["ふぁふぃふぇふぉ", "fa fi fe fo"], ["うぃうぇうぉ", "wi we wo"], ["ゔぁゔぃゔぇゔぉ", "va vi ve vo"],
  ];
  it.each(rows)("%s", (kana, romaji) => {
    // Romanised as one word, so は, へ and を inside it are ordinary syllables except を (always o).
    expect(romaniseWord(kana)).toBe(romaji.replace(/ /g, ""));
  });
  it("romanises katakana through the same table, including the long-vowel mark", () => {
    expect(romaniseWord("カキクケコ")).toBe("kakikukeko");
    expect(romaniseWord("ヴァイオリン")).toBe("vaiorin");
    expect(romaniseWord("ケーキ")).toBe("keeki");
  });
  it("doubles the consonant after small tsu and rejects impossible sequences", () => {
    expect(romaniseWord("がっこう")).toBe("gakkou");
    expect(romaniseWord("ちょっと")).toBe("chotto");
    expect(romaniseWord("いっしょ")).toBe("issho");
    expect(romaniseWord("ざっし")).toBe("zasshi");
    for (const bad of ["っあ", "あっ", "ー", "aー", "漢", "x"]) expect(() => romaniseWord(bad)).toThrow();
  });
  it("marks n before a vowel or y only", () => {
    expect(romaniseWord("こんや")).toBe("kon'ya");
    expect(romaniseWord("げんいん")).toBe("gen'in");
    expect(romaniseWord("しんぶん")).toBe("shinbun");
    expect(romaniseWord("ほんを")).toBe("hon'o");
    expect(romaniseWord("こんにゃく")).toBe("konnyaku");
    expect(romaniseWord("てんぷら")).toBe("tenpura");
  });
  it("keeps phrase spacing in kana and word spacing in romaji", () => {
    expect(render("わたし_は ^ハル_です。 よろしく_おねがいします。")).toEqual({ romaji: "watashi wa Haru desu. yoroshiku onegaishimasu.", kana: "わたしは ハルです。よろしくおねがいします。" });
    expect(render("あ、 い？ う！")).toEqual({ romaji: "a, i? u!", kana: "あ、い？う！" });
    expect(render("^ハル")).toEqual({ romaji: "Haru", kana: "ハル" });
    expect(() => render("あ。x")).toThrow("Invalid course source");
  });
});

describe("lenient keys", () => {
  it.each([
    ["ā", "a"], ["â", "a"], ["ī", "i"], ["î", "i"], ["ū", "u"], ["û", "u"], ["ē", "e"], ["ê", "e"], ["ō", "o"], ["ô", "o"],
    ["kon'ya", "konya"], ["kon-ya", "konya"], ["kon`ya", "konya"], ["ha", "wa"], ["wo", "o"], ["he", "e"],
    ["si", "shi"], ["ti", "chi"], ["tu", "tsu"], ["hu", "fu"], ["zi", "ji"], ["sya", "sha"], ["tya", "cha"], ["zya", "ja"], ["jya", "ja"],
    ["ou", "o"], ["oo", "o"], ["uu", "u"], ["aa", "a"], ["ii", "i"], ["ee", "e"], ["ei", "e"], ["nn", "n"], ["ooo", "o"],
    ["A.B,C!D?E\"F(G)H:I;J~K", "abcdefghijk"],
  ])("%s → %s", (input, key) => {
    expect(looseKey(input, "romaji")).toBe(key);
  });
  it("only maps whole-word particles and joins words", () => {
    expect(looseKey("hana wa", "romaji")).toBe("hanawa");
    expect(looseKey("haha", "romaji")).toBe("haha");
    expect(looseKey("wotto", "romaji")).toBe("wotto");
    expect(looseKey("  a   b\tc ", "romaji")).toBe("abc");
  });
  it("folds kana punctuation, spaces and katakana", () => {
    expect(looseKey("ハル です。", "kana")).toBe("はるです");
    expect(looseKey("（はる）「です」『です』・〜~:：…\"'’‘“”-!?！？.,", "kana")).toBe("はるですです");
  });
  it("renders inline teaching text per script with conditional segments", () => {
    expect(renderInline("Use は[k: (sounds like わ)] here.")).toEqual({ romaji: "Use wa here.", kana: "Use は (sounds like わ) here." });
    expect(renderInline("Use ～ます[r: (polite)].")).toEqual({ romaji: "Use -masu (polite).", kana: "Use ～ます." });
    expect(renderInline("^ハル_は ok")).toEqual({ romaji: "Haru wa ok", kana: "ハルは ok" });
    expect(renderInline("No Japanese.")).toEqual({ romaji: "No Japanese.", kana: "No Japanese." });
    expect(rendered("ほん", "kana")).toBe("ほん");
    expect(rendered("ほん", "romaji")).toBe("hon");
  });
});
