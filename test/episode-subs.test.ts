import { describe, expect, it, vi } from "vitest";
import { CHUNK, EpisodeSubs, PARALLEL, glossaryReadings, type BatchRequest, type BatchResponse } from "../src/lib/episode-subs";
import type { TimedCue } from "../src/lib/netflix-tracks";

const cues = (n: number): TimedCue[] => Array.from({ length: n }, (_, i) => ({ start: i * 2, end: i * 2 + 1.5, text: `行${i}`, ruby: i === 0 ? [["公生", "こうせい"]] as [string, string][] : [] }));
const answer = (req: BatchRequest): BatchResponse => ({ ok: true, result: { en: req.lines.map((l) => "en:" + l), names: { 宮園: "みやぞの" } } });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("an episode's English", () => {
  it("comes straight from the English track when there is one, with no requests", async () => {
    const send = vi.fn();
    const ep = new EpisodeSubs(cues(3), [{ start: 0, end: 1.6, text: "Hi.", ruby: [] }], "Show", send);
    expect(ep.source).toBe("track");
    expect(ep.englishAt(0)).toBe("Hi.");
    expect(ep.englishAt(1)).toBe("");
    expect(await ep.whenEnglish(2)).toBe("");
    ep.translateFrom(0);
    expect(send).not.toHaveBeenCalled();
    expect(ep.glossary.get("公生")).toBe("こうせい");
  });

  it("is translated a chunk at a time, the chunk playing now first, a few at once", async () => {
    const pending: { req: BatchRequest; resolve: (r: BatchResponse) => void }[] = [];
    const send = vi.fn((req: BatchRequest) => new Promise<BatchResponse>((resolve) => pending.push({ req, resolve })));
    const ep = new EpisodeSubs(cues(CHUNK * 6 + 3), null, "Show", send);
    ep.translateFrom(CHUNK * 2 + 5);
    expect(send).toHaveBeenCalledTimes(PARALLEL);
    expect(pending.map((p) => p.req.lines[0])).toEqual([`行${CHUNK * 2}`, `行${CHUNK * 3}`, `行${CHUNK * 4}`, `行${CHUNK * 5}`]);
    expect(pending[0].req.context).toEqual([`行${CHUNK * 2 - 3}`, `行${CHUNK * 2 - 2}`, `行${CHUNK * 2 - 1}`]);
    expect(pending[0].req.title).toBe("Show");
    const waiting = ep.whenEnglish(CHUNK * 2 + 5);
    pending[0].resolve(answer(pending[0].req));
    expect(await waiting).toBe(`en:行${CHUNK * 2 + 5}`);
    await flush();
    // The freed slot takes the next chunk ahead (the last, partial one).
    expect(pending[PARALLEL].req.lines).toHaveLength(3);
    expect(ep.glossary.get("宮園")).toBe("みやぞの");
    expect(ep.progress()).toEqual({ done: 1, total: 7 });
  });

  it("reorders after a seek and never asks for a chunk twice", async () => {
    const asked: string[] = [];
    const ep = new EpisodeSubs(cues(CHUNK * 8), null, null, async (req) => { asked.push(req.lines[0]); return answer(req); });
    ep.translateFrom(0);
    ep.translateFrom(CHUNK * 6);
    for (let i = 0; i < 20; i++) await flush();
    expect(new Set(asked).size).toBe(asked.length);
    expect(asked).toHaveLength(8);
    expect(asked.slice(0, PARALLEL)).toEqual([`行0`, `行${CHUNK}`, `行${CHUNK * 2}`, `行${CHUNK * 3}`]);
    expect(asked[PARALLEL]).toBe(`行${CHUNK * 6}`);
  });

  it("reports a failed chunk as null so the line can be asked for on its own", async () => {
    const ep = new EpisodeSubs(cues(CHUNK * 2), null, null, async () => ({ ok: false, error: "openai_500" }));
    expect(await ep.whenEnglish(3)).toBeNull();
    expect(ep.lastError).toBe("openai_500");
    expect(await ep.whenEnglish(4)).toBeNull();
  });

  it("stops asking once the account is out of lines", async () => {
    const send = vi.fn(async (): Promise<BatchResponse> => ({ ok: false, error: "subs_quota_exhausted" }));
    const ep = new EpisodeSubs(cues(CHUNK * 10), null, null, send);
    ep.translateFrom(0);
    for (let i = 0; i < 10; i++) await flush();
    expect(send).toHaveBeenCalledTimes(PARALLEL);
    expect(await ep.whenEnglish(CHUNK * 9)).toBeNull();
    expect(send).toHaveBeenCalledTimes(PARALLEL);
  });

  it("drops an answer whose line count does not match", async () => {
    const ep = new EpisodeSubs(cues(5), null, null, async () => ({ ok: true, result: { en: ["just one"], names: {} } }));
    expect(await ep.whenEnglish(0)).toBeNull();
  });
});

describe("glossary readings", () => {
  const g = new Map([["公生", "こうせい"], ["宮園", "みやぞの"], ["かをり", "かをり"]]);
  it("reads a name split across tokens as one word, kanji names only", () => {
    expect(glossaryReadings([{ surface: "公" }, { surface: "生" }, { surface: "、" }, { surface: "宮園" }, { surface: "かをり" }], g))
      .toEqual({ "0": "こうせい", "1": "", "3": "みやぞの" });
    expect(glossaryReadings([{ surface: "公" }], g)).toEqual({});
    expect(glossaryReadings([{ surface: "公" }, { surface: "生" }], new Map())).toEqual({});
  });
});
