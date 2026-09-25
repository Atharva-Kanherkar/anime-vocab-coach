import { describe, expect, it } from "vitest";
import {
  buildSentenceCues,
  parseJson3Words,
  RollingCaption,
  unseenTail,
  MAX_CUE_CHARS,
  type TimedWord,
} from "../src/lib/cue-sentences";

/** Words spoken back to back, `step` seconds apart, from `t0`. */
function run(texts: string[], t0 = 0, step = 0.3): TimedWord[] {
  return texts.map((text, i) => ({ start: t0 + i * step, text }));
}

describe("parseJson3Words", () => {
  it("times each word by event start plus offset and skips appends", () => {
    const words = parseJson3Words({
      events: [
        { tStartMs: 0, dDurMs: 9000 }, // window definition, no segs
        { tStartMs: 1000, dDurMs: 4000, segs: [{ utf8: "こんにちは" }, { utf8: "元気", tOffsetMs: 600 }] },
        { tStartMs: 2500, aAppend: 1, segs: [{ utf8: "\n" }] },
        { tStartMs: 3000, segs: [{ utf8: " " }, { utf8: "です", tOffsetMs: 200 }] },
      ],
    });
    expect(words).toEqual([
      { start: 1, text: "こんにちは" },
      { start: 1.6, text: "元気" },
      { start: 3.2, text: "です" },
    ]);
  });
});

describe("buildSentenceCues", () => {
  it("ends a cue at sentence punctuation", () => {
    const cues = buildSentenceCues(run(["こんにちは。", "元気", "ですか？"]), "ja");
    expect(cues.map((c) => c.text)).toEqual(["こんにちは。", "元気ですか？"]);
  });

  it("ends a cue at a pause in speech", () => {
    const words = [
      { start: 0, text: "行く" },
      { start: 0.4, text: "よ" },
      { start: 3, text: "待って" },
    ];
    expect(buildSentenceCues(words, "ja").map((c) => c.text)).toEqual(["行くよ", "待って"]);
  });

  it("caps a long unpunctuated run and loses no text", () => {
    const pieces = Array.from({ length: 20 }, (_, i) => (i % 2 ? "ですね" : "そうだ"));
    const cues = buildSentenceCues(run(pieces, 0, 0.35), "ja");
    expect(cues.length).toBeGreaterThan(1);
    for (const c of cues) expect(c.text.length).toBeLessThanOrEqual(MAX_CUE_CHARS.ja);
    expect(cues.map((c) => c.text).join("")).toBe(pieces.join(""));
  });

  it("never overlaps one cue with the next", () => {
    const cues = buildSentenceCues(run(["あ。", "い。", "う。", "え。"], 0, 0.5), "ja");
    for (let i = 0; i + 1 < cues.length; i++) expect(cues[i].end).toBeLessThanOrEqual(cues[i + 1].start);
    for (const c of cues) expect(c.end).toBeGreaterThan(c.start);
  });

  it("keeps English words apart", () => {
    const cues = buildSentenceCues(run(["hello", " there.", "how", " are", " you?"]), "en");
    expect(cues.map((c) => c.text)).toEqual(["hello there.", "how are you?"]);
  });
});

describe("RollingCaption", () => {
  it("emits a rolling caption once it settles, not per word", () => {
    const roll = new RollingCaption(700, 4000);
    roll.markEmitted("今日は");
    expect(roll.continues("今日はいい")).toBe(true);
    roll.update("今日はいい", 0);
    roll.update("今日はいい天気", 300);
    expect(roll.take(600)).toBeNull();
    expect(roll.take(1000)).toBe("今日はいい天気");
    expect(roll.take(2000)).toBeNull();
  });

  it("does not re-emit a caption that adds nothing new", () => {
    const roll = new RollingCaption(700, 4000);
    roll.markEmitted("今日はいい天気");
    roll.update("いい天気", 0);
    expect(roll.take(1000)).toBeNull();
  });

  it("gives out a caption that keeps rolling past the hold limit", () => {
    const roll = new RollingCaption(700, 2000);
    roll.markEmitted("あの");
    let text = "あの";
    for (let t = 0; t <= 2000; t += 400) {
      text += "ね";
      roll.update(text, t);
    }
    expect(roll.take(2000)).toBe(text);
  });

  it("treats unrelated text as a replacement, not a roll", () => {
    const roll = new RollingCaption();
    roll.markEmitted("おはよう");
    expect(roll.continues("さようなら")).toBe(false);
  });
});

describe("unseenTail", () => {
  it("drops the words that rolled over", () => {
    expect(unseenTail("A B C", "B C D")).toBe("D");
    expect(unseenTail("A B", "A B C")).toBe("C");
    expect(unseenTail("", "X")).toBe("X");
    expect(unseenTail("のだ", "のか")).toBe("のか");
  });
});
