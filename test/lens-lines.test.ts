import { describe, expect, it } from "vitest";
import { lensPieceDelayMs, splitForLens } from "../src/lib/lens-lines";

describe("splitForLens", () => {
  it("splits at sentence ends", () => {
    expect(splitForLens("待って！どこに行くの？", "ja")).toEqual(["待って！", "どこに行くの？"]);
  });

  it("breaks a long sentence at the last comma before the cap", () => {
    const text = "昨日の夜、ずっと考えていたんだけど、やっぱりお前と一緒に行くことにしたよ";
    const pieces = splitForLens(text, "ja", 28);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(28);
    expect(pieces[0].endsWith("、")).toBe(true);
    expect(pieces.join("")).toBe(text);
  });

  it("breaks hard at the cap when there is nowhere softer", () => {
    const text = "あ".repeat(70);
    const pieces = splitForLens(text, "ja", 28);
    expect(pieces.map((p) => p.length)).toEqual([28, 28, 14]);
    expect(pieces.join("")).toBe(text);
  });

  it("never returns empty pieces", () => {
    expect(splitForLens("", "ja")).toEqual([]);
    expect(splitForLens("  。 ", "ja").every(Boolean)).toBe(true);
  });

  it("breaks English at spaces and keeps every word", () => {
    const text = "I told you already that I was never going to leave this town without you, and I meant it every single time.";
    const pieces = splitForLens(text, "en", 40);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(40);
    expect(pieces.join(" ")).toBe(text);
  });
});

describe("lensPieceDelayMs", () => {
  it("stays between 1.2s and 4s", () => {
    expect(lensPieceDelayMs("あ", "ja")).toBe(1200);
    expect(lensPieceDelayMs("あ".repeat(20), "ja")).toBe(1800);
    expect(lensPieceDelayMs("あ".repeat(100), "ja")).toBe(4000);
  });
});
