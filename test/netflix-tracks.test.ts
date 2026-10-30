import { describe, expect, it } from "vitest";
import { chunkOrder, cueAt, englishFor, findTimedTextTracks, parseTimedText, parseTtml, parseVtt, pickTrack, ttmlTime } from "../src/lib/netflix-tracks";

// Shaped like Netflix's IMSC 1.1 Japanese track: tick-based times, ruby via styles.
const IMSC = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000" ttp:frameRate="24" ttp:frameRateMultiplier="1000 1001" xml:lang="ja">
<head><styling>
  <style xml:id="s1" tts:fontSize="100%"/>
  <style xml:id="rubyContainer" tts:ruby="container"/>
  <style xml:id="rubyBase" tts:ruby="base"/>
  <style xml:id="rubyText" tts:ruby="text" tts:rubyPosition="before"/>
</styling></head>
<body><div>
<p begin="12512500t" end="35785750t" region="r1"><span style="rubyContainer"><span style="rubyBase">公生</span><span style="rubyText">こうせい</span></span><span style="s1">、ピアノ弾いてよ。</span></p>
<p begin="40000000t" end="61000000t"><span>（かをり）</span><br/><span>はじめまして&#12290;</span></p>
<p begin="61000000t" end="60000000t">bad times are skipped</p>
<p begin="00:00:07.000" end="00:00:08.500">わたしは<span tts:ruby="container"><span tts:ruby="base">宮園</span><span tts:ruby="text">みやぞの</span></span>です。</p>
</div></body></tt>`;

const VTT = `WEBVTT

1
00:00:01.250 --> 00:00:03.578 position:50% line:85%
<c.japanese><ruby>公生<rt>こうせい</rt></ruby>、ピアノ弾いてよ。</c.japanese>

2
00:00:04.000 --> 00:00:06.100
はじめまして。
&lt;わたし&gt;です`;

describe("timed text", () => {
  it("reads TTML times in ticks, clock time, frames and offsets", () => {
    const base = { tickRate: 10_000_000, frameRate: 24 };
    expect(ttmlTime("12512500t", base)).toBeCloseTo(1.25125);
    expect(ttmlTime("00:01:02.500", base)).toBeCloseTo(62.5);
    expect(ttmlTime("00:00:01:12", base)).toBeCloseTo(1.5);
    expect(ttmlTime("1.5s", base)).toBe(1.5);
    expect(ttmlTime("250ms", base)).toBe(0.25);
    expect(ttmlTime("2m", base)).toBe(120);
    expect(ttmlTime("nonsense", base)).toBeNaN();
    expect(ttmlTime(undefined, base)).toBeNaN();
  });

  it("parses Netflix IMSC: furigana out of the line and into the glossary, line breaks as spaces", () => {
    const cues = parseTtml(IMSC);
    expect(cues.map((c) => c.text)).toEqual(["公生、ピアノ弾いてよ。", "（かをり） はじめまして。", "わたしは宮園です。"]);
    expect(cues[0]).toMatchObject({ ruby: [["公生", "こうせい"]] });
    expect(cues[0].start).toBeCloseTo(1.25125);
    expect(cues[0].end).toBeCloseTo(3.578575);
    expect(cues[1]).toMatchObject({ start: 4, end: 6.1, ruby: [] });
    expect(cues[2]).toMatchObject({ start: 7, end: 8.5, ruby: [["宮園", "みやぞの"]] });
  });

  it("parses WebVTT with ruby and entities", () => {
    const cues = parseVtt(VTT);
    expect(cues).toEqual([
      { start: 1.25, end: 3.578, text: "公生、ピアノ弾いてよ。", ruby: [["公生", "こうせい"]] },
      { start: 4, end: 6.1, text: "はじめまして。 <わたし>です", ruby: [] },
    ]);
    expect(parseTimedText(VTT)).toEqual(cues);
    expect(parseTimedText(IMSC)).toHaveLength(3);
    expect(parseTimedText("garbage")).toEqual([]);
  });
});

// Shaped like the player's manifest response.
const manifest = {
  id: 1, version: 2,
  result: {
    movieId: 80041089,
    timedtexttracks: [
      { language: "ja", rawTrackType: "closedcaptions", isForcedNarrative: false, isNoneTrack: false,
        ttDownloadables: { "imsc1.1": { urls: [{ cdn_id: 1, url: "https://ipv4.nflxvideo.net/ja-cc.xml" }] } } },
      { language: "ja", rawTrackType: "subtitles", isForcedNarrative: false, isNoneTrack: false,
        ttDownloadables: { "nflx-cmisc": { urls: [{ url: "https://ipv4.nflxvideo.net/ja.zip" }] }, "dfxp-ls-sdh": { downloadUrls: { "7": "https://ipv4.nflxvideo.net/ja.dfxp" } }, "imsc1.1": { urls: [{ url: "https://ipv4.nflxvideo.net/ja.xml" }] } } },
      { language: "en", rawTrackType: "subtitles", isForcedNarrative: true, isNoneTrack: false,
        ttDownloadables: { "imsc1.1": { urls: [{ url: "https://ipv4.nflxvideo.net/en-forced.xml" }] } } },
      { language: "en", rawTrackType: "subtitles", isForcedNarrative: false, isNoneTrack: false,
        ttDownloadables: { "webvtt-lssdh-ios8": { urls: [{ url: "https://ipv4.nflxvideo.net/en.vtt" }] }, "imsc1.1": { urls: [{ url: "https://ipv4.nflxvideo.net/en.xml" }] } } },
      { language: "", isNoneTrack: true, ttDownloadables: {} },
    ],
  },
};

describe("the player's manifest", () => {
  it("finds the tracks and the video they belong to, however deep", () => {
    const found = findTimedTextTracks(manifest);
    expect(found?.movieId).toBe("80041089");
    expect(found?.tracks).toHaveLength(5);
    expect(findTimedTextTracks({ a: { b: manifest } })?.movieId).toBe("80041089");
    expect(findTimedTextTracks({ timedtexttracks: [] })).toBeNull();
    expect(findTimedTextTracks({ a: { b: { c: { d: manifest } } } })).toBeNull();
    expect(findTimedTextTracks("x")).toBeNull();
  });

  it("picks real subtitles over captions, readable formats in order, never forced or image tracks", () => {
    const { tracks } = findTimedTextTracks(manifest)!;
    expect(pickTrack(tracks, "ja")).toEqual({ format: "imsc1.1", url: "https://ipv4.nflxvideo.net/ja.xml" });
    expect(pickTrack(tracks, "en")).toEqual({ format: "webvtt-lssdh-ios8", url: "https://ipv4.nflxvideo.net/en.vtt" });
    const onlyCaptions = tracks.filter((t) => t.kind === "closedcaptions");
    expect(pickTrack(onlyCaptions, "ja")?.url).toContain("ja-cc");
    expect(pickTrack(tracks.filter((t) => t.forced), "en")).toBeNull();
    expect(pickTrack([{ language: "ja-JP", kind: "subtitles", forced: false, none: false, downloads: [{ format: "nflx-cmisc", url: "https://x/y" }] }], "ja")).toBeNull();
    expect(pickTrack([{ language: "en-GB", kind: "subtitles", forced: false, none: false, downloads: [{ format: "dfxp-ls-sdh", url: "https://x/en" }] }], "en")?.url).toBe("https://x/en");
  });

  it("ignores non-https download URLs", () => {
    const bad = { movieId: 1, timedtexttracks: [{ language: "ja", ttDownloadables: { "imsc1.1": { urls: [{ url: "http://x/ja.xml" }] } } }] };
    expect(pickTrack(findTimedTextTracks(bad)!.tracks, "ja")).toBeNull();
  });
});

describe("using the tracks", () => {
  const cues = [
    { start: 1, end: 3, text: "a", ruby: [] },
    { start: 3, end: 5, text: "b", ruby: [] },
    { start: 7, end: 9, text: "c", ruby: [] },
    { start: 8, end: 10, text: "d", ruby: [] },
  ];

  it("finds the cue on screen at a time, exactly at its edges", () => {
    expect(cueAt(cues, 0.99)).toBe(-1);
    expect(cueAt(cues, 1)).toBe(0);
    expect(cueAt(cues, 2.999)).toBe(0);
    expect(cueAt(cues, 3)).toBe(1);
    expect(cueAt(cues, 6)).toBe(-1);
    expect(cueAt(cues, 8.5)).toBe(3);
    expect(cueAt(cues, 9.5)).toBe(3);
    expect(cueAt(cues, 11)).toBe(-1);
    expect(cueAt([], 1)).toBe(-1);
  });

  it("pairs each Japanese line with the English it overlaps most", () => {
    const en = [
      { start: 0.9, end: 3.1, text: "Hello.", ruby: [] },
      { start: 3.1, end: 4, text: "It's me,", ruby: [] },
      { start: 4, end: 5.2, text: "Kaori.", ruby: [] },
      { start: 9.9, end: 12, text: "Late.", ruby: [] },
    ];
    expect(englishFor(cues, en)).toEqual(["Hello.", "It's me, Kaori.", "", ""]);
  });

  it("translates the chunk playing now first, then what follows, then what came before", () => {
    expect(chunkOrder(6, 2)).toEqual([2, 3, 4, 5, 1, 0]);
    expect(chunkOrder(3, 0)).toEqual([0, 1, 2]);
    expect(chunkOrder(3, 9)).toEqual([2, 1, 0]);
    expect(chunkOrder(0, 0)).toEqual([]);
  });
});
