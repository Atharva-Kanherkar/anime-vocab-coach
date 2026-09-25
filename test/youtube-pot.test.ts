import { describe, expect, it } from "vitest";
import { extractPot, trackUrl } from "../src/lib/youtube-pot";

const PLAYER_REQUEST =
  "https://www.youtube.com/api/timedtext?v=abc123&ei=x&caps=asr&opi=1&exp=xpe&xoaf=5&hl=en&ip=0.0.0.0" +
  "&ipbits=0&expire=1790350689&sparams=ip,ipbits,expire,v,ei,opi,exp,xoaf&signature=SIG&key=yt8" +
  "&kind=asr&lang=ja&fmt=json3&xorb=2&xobt=3&xovt=3&cbrand=apple&cbr=Chrome&cbrver=128&c=WEB&cver=2.20260920" +
  "&cplayer=UNIPLAYER&cos=Macintosh&cplatform=DESKTOP&pot=TOKEN_123";

describe("extractPot", () => {
  it("reads the token, client and video from a player caption request", () => {
    expect(extractPot(PLAYER_REQUEST)).toEqual({ videoId: "abc123", pot: "TOKEN_123", c: "WEB", cver: "2.20260920" });
  });

  it("ignores caption requests without a token and other URLs", () => {
    expect(extractPot("https://www.youtube.com/api/timedtext?v=abc123&lang=ja")).toBeNull();
    expect(extractPot("https://www.youtube.com/youtubei/v1/player?pot=x&v=abc")).toBeNull();
    expect(extractPot("not a url ::")).toBeNull();
  });
});

describe("trackUrl", () => {
  const base = "https://www.youtube.com/api/timedtext?v=abc123&exp=xpe&signature=SIG&lang=ja&kind=asr";

  it("adds json3 and the token, keeping the signed parameters", () => {
    const url = new URL(trackUrl(base, { videoId: "abc123", pot: "T", c: "WEB", cver: "2.1" }));
    expect(url.searchParams.get("fmt")).toBe("json3");
    expect(url.searchParams.get("pot")).toBe("T");
    expect(url.searchParams.get("c")).toBe("WEB");
    expect(url.searchParams.get("cver")).toBe("2.1");
    expect(url.searchParams.get("signature")).toBe("SIG");
    expect(url.searchParams.get("lang")).toBe("ja");
  });

  it("still asks for json3 without a token", () => {
    const url = new URL(trackUrl("/api/timedtext?v=a", null));
    expect(url.searchParams.get("fmt")).toBe("json3");
    expect(url.searchParams.has("pot")).toBe(false);
  });
});
