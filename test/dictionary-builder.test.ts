import { describe, expect, it } from "vitest";
// The production builder is native ESM so it can also run directly under Node.
// @ts-expect-error JavaScript build script intentionally has no declaration file.
import { buildDictionary } from "../scripts/build-dictionary.mjs";

type BuiltDictionary = Record<string, { r: string; g: string[]; l: number; f: number }>;

function build(entries: string): BuiltDictionary {
  return buildDictionary(`<JMdict>${entries}</JMdict>`).dict as BuiltDictionary;
}

const entry = (body: string) => `<entry>${body}</entry>`;

describe("dictionary builder", () => {
  it("selects the first sense applicable to each written form", () => {
    const dict = build(entry(`
      <k_ele><keb>撮る</keb><ke_pri>ichi1</ke_pri></k_ele>
      <k_ele><keb>録る</keb><ke_pri>ichi1</ke_pri></k_ele>
      <r_ele><reb>とる</reb><re_pri>ichi1</re_pri></r_ele>
      <sense><stagk>撮る</stagk><gloss>to take a photograph</gloss></sense>
      <sense><s_inf>esp. 録る</s_inf><gloss>to record audio or video</gloss></sense>
    `));

    expect(dict["撮る"].g).toEqual(["to take a photograph"]);
    expect(dict["録る"].g).toEqual(["to record audio or video"]);
    expect(dict["とる"].g).toEqual(["to take a photograph"]);
  });

  it("uses spelling hints when JMdict marks an especially common form", () => {
    const dict = build(entry(`
      <k_ele><keb>開ける</keb><ke_pri>ichi1</ke_pri></k_ele>
      <k_ele><keb>空ける</keb><ke_pri>ichi1</ke_pri></k_ele>
      <k_ele><keb>明ける</keb><ke_pri>ichi1</ke_pri></k_ele>
      <r_ele><reb>あける</reb><re_pri>ichi1</re_pri></r_ele>
      <sense><stagk>開ける</stagk><gloss>to open</gloss></sense>
      <sense><s_inf>esp. 空ける</s_inf><gloss>to empty</gloss></sense>
      <sense><s_inf>esp. 明ける</s_inf><gloss>to dawn</gloss></sense>
    `));

    expect(dict["開ける"].g).toEqual(["to open"]);
    expect(dict["空ける"].g).toEqual(["to empty"]);
    expect(dict["明ける"].g).toEqual(["to dawn"]);
  });

  it("honors reading restrictions for written forms", () => {
    const dict = build(entry(`
      <k_ele><keb>入る</keb><ke_pri>ichi1</ke_pri></k_ele>
      <k_ele><keb>居る</keb><ke_pri>ichi1</ke_pri></k_ele>
      <r_ele><reb>いる</reb><re_restr>居る</re_restr><re_pri>ichi1</re_pri></r_ele>
      <r_ele><reb>はいる</reb><re_restr>入る</re_restr><re_pri>ichi1</re_pri></r_ele>
      <sense><gloss>to enter or exist</gloss></sense>
    `));

    expect(dict["入る"].r).toBe("はいる");
    expect(dict["居る"].r).toBe("いる");
  });

  it("resolves ranked kana collisions independently of input order", () => {
    const common = entry(`
      <k_ele><keb>居る</keb></k_ele>
      <r_ele><reb>いる</reb><re_pri>ichi1</re_pri></r_ele>
      <sense><misc>&uk;</misc><gloss>to exist</gloss></sense>
    `);
    const rare = entry(`
      <k_ele><keb>射る</keb></k_ele>
      <r_ele><reb>いる</reb><re_pri>nf27</re_pri></r_ele>
      <sense><gloss>to shoot an arrow</gloss></sense>
    `);

    expect(build(common + rare)["いる"].g).toEqual(["to exist"]);
    expect(build(rare + common)["いる"].g).toEqual(["to exist"]);
  });

  it.each([
    ["うん", "運", "yes", "fortune"],
    ["おい", "甥", "hey!", "nephew"],
    ["はい", "肺", "yes", "lung"],
  ])("prefers the kana-only spoken meaning for %s", (reading, written, spoken, homophone) => {
    const kanaOnly = entry(`
      <r_ele><reb>${reading}</reb><re_pri>spec1</re_pri></r_ele>
      <sense><pos>&int;</pos><gloss>${spoken}</gloss></sense>
    `);
    const writtenEntry = entry(`
      <k_ele><keb>${written}</keb><ke_pri>ichi1</ke_pri></k_ele>
      <r_ele><reb>${reading}</reb><re_pri>ichi1</re_pri><re_pri>news1</re_pri></r_ele>
      <sense><gloss>${homophone}</gloss></sense>
    `);

    expect(build(kanaOnly + writtenEntry)[reading].g).toEqual([spoken]);
    expect(build(writtenEntry + kanaOnly)[reading].g).toEqual([spoken]);
  });

  it("retains unprioritized reading aliases for a prioritized entry", () => {
    const dict = build(entry(`
      <k_ele><keb>疼き疼き</keb><ke_pri>ichi1</ke_pri></k_ele>
      <r_ele><reb>ズキズキ</reb><re_nokanji/></r_ele>
      <r_ele><reb>ずきずき</reb><re_pri>ichi1</re_pri></r_ele>
      <sense><gloss>throbbingly</gloss></sense>
    `));

    expect(dict["ズキズキ"].g).toEqual(["throbbingly"]);
    expect(dict["ずきずき"].g).toEqual(["throbbingly"]);
  });

  it("keeps a typed gloss when it is the only definition", () => {
    const dict = build(entry(`
      <r_ele><reb>ぞ</reb><re_pri>spec1</re_pri></r_ele>
      <sense><gloss g_type="expl">adds force or indicates command</gloss></sense>
    `));

    expect(dict["ぞ"].g).toEqual(["adds force or indicates command"]);
  });
});
