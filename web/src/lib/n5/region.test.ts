import { describe, expect, it } from "vitest";
import { guessRegion, splitByRegion } from "./region";
import { safeLink } from "./core";

describe("watch region", () => {
  it("prefers timezone, then a language region, else unknown", () => {
    expect(guessRegion("Asia/Tokyo", ["en-US"])).toBe("JP");
    expect(guessRegion("Asia/Kolkata")).toBe("IN");
    expect(guessRegion("America/Toronto")).toBe("CA");
    expect(guessRegion("America/Los_Angeles")).toBe("US");
    expect(guessRegion("Australia/Sydney")).toBe("AU");
    expect(guessRegion("Europe/London")).toBe("GB");
    expect(guessRegion("Antarctica/Troll", ["fr-FR"])).toBe("FR");
    expect(guessRegion("Antarctica/Troll", ["en", "xx-ZZ"])).toBeNull();
    expect(guessRegion(undefined)).toBeNull();
  });
  it("puts local links first without hiding any", () => {
    const links = [{ p: "a", regions: ["US"] }, { p: "b", regions: ["JP", "US"] }, { p: "c", regions: ["JP"] }];
    expect(splitByRegion(links, "JP")).toEqual({ local: [links[1], links[2]], other: [links[0]] });
    expect(splitByRegion(links, null)).toEqual({ local: [], other: links });
  });
  it("allows only official watch pages over https", () => {
    for (const ok of ["https://www.netflix.com/title/80041089", "https://video.unext.jp/episode/SID0012508/ED00071632", "https://fod.fujitv.co.jp/title/5244/5244110001/", "https://www.amazon.co.jp/dp/B0H2WMCJ2Q", "https://www.primevideo.com/detail?gti=x", "https://animationdigitalnetwork.com/video/1203-your-lie-in-april/25757-episode-1", "https://www.crunchyroll.com/series/G63V7KN9Y/your-lie-in-april"])
      expect(safeLink(ok, "watch")).toBe(ok);
    for (const bad of ["http://www.netflix.com/title/1", "https://evil.netflix.com.example/title/1", "https://www.netflix.com/login", "https://user:pw@www.netflix.com/title/1", "https://www.netflix.com:8443/title/1", "javascript:alert(1)", "https://www.amazon.co.jp/gp/cart", "https://crunchyroll.pxf.io/xk92Nv"])
      expect(safeLink(bad, "watch")).toBeNull();
  });
});
