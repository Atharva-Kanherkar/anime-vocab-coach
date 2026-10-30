import { describe, expect, it } from "vitest";
import { WATCH_SOURCES, watchLinks } from "./watch";
import { LESSONS } from "./course";

describe("official watch links", () => {
  it("deep-links each episode on services with stable episode pages", () => {
    const at = (n: number, provider: string) => watchLinks(n).find((l) => l.provider === provider)!.url;
    // Verified against each service's episode titles on the checked date.
    expect(at(1, "U-NEXT")).toBe("https://video.unext.jp/episode/SID0012508/ED00071632");
    expect(at(21, "U-NEXT")).toBe("https://video.unext.jp/episode/SID0012508/ED00071652");
    expect(at(22, "U-NEXT")).toBe("https://video.unext.jp/episode/SID0012508/ED00071653");
    expect(at(1, "FOD")).toBe("https://fod.fujitv.co.jp/title/5244/5244110001/");
    expect(at(22, "FOD")).toBe("https://fod.fujitv.co.jp/title/5244/5244110022/");
    expect(at(1, "ADN")).toBe("https://animationdigitalnetwork.com/video/1203-your-lie-in-april/25757-episode-1");
    expect(at(22, "ADN")).toBe("https://animationdigitalnetwork.com/video/1203-your-lie-in-april/25778-episode-22");
    expect(at(5, "Netflix")).toBe("https://www.netflix.com/title/80041089");
  });
  it("offers no watch links for units without an episode", () => {
    expect(watchLinks(null)).toEqual([]);
    expect(LESSONS.filter((l) => !l.episode).map((l) => l.unit)).toEqual([12, 24]);
  });
  it("uses only https, untracked, English-labelled sources with ISO regions", () => {
    for (const source of WATCH_SOURCES) {
      for (const url of [source.series, ...(source.episode ? [source.episode(1), source.episode(22)] : [])]) {
        const u = new URL(url);
        expect(u.protocol).toBe("https:");
        expect(url).not.toMatch(/utm_|pxf\.io|click\.|tag=|affiliate|ref=/i);
      }
      expect(source.regions.length).toBeGreaterThan(0);
      for (const r of source.regions) expect(r).toMatch(/^[A-Z]{2}$/);
      expect(`${source.provider} ${source.note ?? ""}`).not.toMatch(/[぀-ヿ一-鿿]/);
    }
    expect(WATCH_SOURCES.filter((s) => s.regions.includes("JP")).map((s) => s.provider)).toEqual(["Netflix", "U-NEXT", "FOD", "Hulu Japan", "Prime Video Japan"]);
  });
});
