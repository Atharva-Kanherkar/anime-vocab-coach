import { describe, expect, it } from "vitest";
import { animeContextCacheBasis, seriesTitle } from "./anime-title";

/**
 * The anime-context cache was hashing the episode number into its key, so every
 * episode of a show paid for its own completion: 3 hits against 41 paid lookups
 * on 2026-09-20, 87% of all AI spend, and a 3.2s wait per card.
 *
 * Two properties matter here, and they pull in opposite directions. Episodes of
 * one show must collapse to one key — that is the fix. And two different shows
 * must never collapse into one, because a merged key serves a learner notes
 * about a programme they are not watching. Where the rule is unsure it keeps
 * the title, because an extra cache entry costs a fraction of a cent and a
 * wrong one is a wrong answer.
 */

describe("seriesTitle — episodes of one show collapse", () => {
  it.each([
    ["Naruto Shippuden Episode 42", "Naruto Shippuden"],
    ["Naruto Shippuden - Episode 43 - The Promise", "Naruto Shippuden"],
    ["Naruto Shippuden – Episode 100", "Naruto Shippuden"],
    ["Naruto Shippuden Ep. 7", "Naruto Shippuden"],
    ["Naruto Shippuden EP12", "Naruto Shippuden"],
    ["Naruto Shippuden | Episode 8", "Naruto Shippuden"],
    ["Naruto Shippuden: Episode 9", "Naruto Shippuden"],
    ["Naruto Shippuden #15", "Naruto Shippuden"],
  ])("%j → %j", (raw, want) => {
    expect(seriesTitle(raw)).toBe(want);
  });

  it("collapses a whole season to one key", () => {
    const keys = new Set(
      Array.from({ length: 24 }, (_, i) => animeContextCacheBasis(`Frieren - Episode ${i + 1}`))
    );
    expect(keys.size).toBe(1);
  });

  it("collapses the same show written three different ways", () => {
    const keys = new Set([
      animeContextCacheBasis("Frieren Season 2 Episode 5"),
      animeContextCacheBasis("Frieren S2E5"),
      animeContextCacheBasis("Frieren Season 2"),
    ]);
    expect(keys.size).toBe(1);
  });
});

describe("seriesTitle — Japanese and player decoration", () => {
  it.each([
    ["葬送のフリーレン 第12話", "葬送のフリーレン"],
    ["ワンピース 第1089話 「ルフィの決意」", "ワンピース"],
    ["【公式】五等分の花嫁 第3話", "五等分の花嫁"],
    ["[HorribleSubs] Steins;Gate - Episode 4", "Steins;Gate"],
    ["Attack on Titan Episode 5 (Dub)", "Attack on Titan"],
    ["Attack on Titan (Dub) [1080p]", "Attack on Titan"],
    ["Bocchi the Rock! Episode 3 (English Dub)", "Bocchi the Rock!"],
  ])("%j → %j", (raw, want) => {
    expect(seriesTitle(raw)).toBe(want);
  });
});

describe("seriesTitle — what it must NOT touch", () => {
  /**
   * Every one of these has a number that is part of the show's identity.
   * Stripping any of them merges distinct series.
   */
  it.each([
    "Mobile Suit Gundam 00",
    "Steins;Gate 0",
    "86",
    "91 Days",
    "Fruits Basket (2019)",
    "Rebuild of Evangelion 3.0",
    "Haikyuu!! To the Top",
    "Cowboy Bebop",
    "Epic Seven",
    "5 Centimeters per Second",
  ])("leaves %j alone", (raw) => {
    expect(seriesTitle(raw)).toBe(raw);
  });

  it("keeps two adaptations of the same story apart", () => {
    expect(animeContextCacheBasis("Fruits Basket (2019) Episode 4")).not.toBe(
      animeContextCacheBasis("Fruits Basket Episode 4")
    );
  });

  it("keeps different shows apart even when they share a prefix", () => {
    expect(animeContextCacheBasis("Mobile Suit Gundam 00 Episode 2")).not.toBe(
      animeContextCacheBasis("Mobile Suit Gundam Episode 2")
    );
  });
});

describe("seriesTitle — degenerate input", () => {
  it("keeps a title that is nothing but an episode marker", () => {
    // Stripping to "" would collapse every such lookup onto one shared entry
    // and serve whichever show got there first.
    expect(seriesTitle("Episode 5")).toBe("Episode 5");
    expect(seriesTitle("第5話")).toBe("第5話");
  });

  it("handles empty and whitespace", () => {
    expect(seriesTitle("")).toBe("");
    expect(seriesTitle("   ")).toBe("");
    expect(seriesTitle(null as unknown as string)).toBe("");
  });

  it("collapses runs of whitespace so spacing cannot split a key", () => {
    expect(animeContextCacheBasis("Naruto   Shippuden")).toBe(
      animeContextCacheBasis("Naruto Shippuden")
    );
  });

  it("is case-insensitive at the key, but preserves case for the prompt", () => {
    expect(animeContextCacheBasis("FRIEREN")).toBe(animeContextCacheBasis("frieren"));
    expect(seriesTitle("FRIEREN Episode 2")).toBe("FRIEREN");
  });

  it("bounds a hostile title", () => {
    expect(seriesTitle("あ".repeat(500)).length).toBeLessThanOrEqual(120);
  });
});
