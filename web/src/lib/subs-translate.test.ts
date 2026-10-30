import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeSubRequest, parseSubTranslation, runSubTranslate, subCacheKey, subPrompt, type SubTranslateRequest } from "./subs-translate";

vi.mock("./telemetry", () => ({ recordLlmCall: vi.fn(async () => {}) }));

const req = (over: Partial<SubTranslateRequest> = {}): SubTranslateRequest => ({
  line: "公生、ピアノ弾いてよ。", context: ["久しぶり。"], title: "Your Lie in April", words: [{ i: 0, s: "公生" }, { i: 3, s: "弾い" }], ...over,
});

describe("dual subtitle requests", () => {
  it("keeps a bounded Japanese line, recent context and words that are in the line", () => {
    const out = normalizeSubRequest({
      line: "  公生、ピアノ弾いてよ。 ", context: ["a", "b", "c", "d", 5], title: "Your Lie in April",
      words: [{ i: 0, s: "公生" }, { i: 1, s: "猫" }, { i: -1, s: "公生" }, { i: 2.5, s: "弾い" }, { i: 3, s: "弾い" }, "x"],
    });
    expect("req" in out && out.req).toEqual({ line: "公生、ピアノ弾いてよ。", context: ["b", "c", "d"], title: "Your Lie in April", words: [{ i: 0, s: "公生" }, { i: 3, s: "弾い" }] });
  });

  it("refuses lines with no Japanese in them", () => {
    expect(normalizeSubRequest({ line: "hello" })).toEqual({ error: "missing_line" });
    expect(normalizeSubRequest({})).toEqual({ error: "missing_line" });
    expect(normalizeSubRequest(null)).toEqual({ error: "invalid_body" });
  });

  it("shares a cache entry across context, not across shows or lines", async () => {
    const a = await subCacheKey(req());
    expect(a).toBe(await subCacheKey(req({ context: ["something else"] })));
    expect(a).not.toBe(await subCacheKey(req({ title: "Another show" })));
    expect(a).not.toBe(await subCacheKey(req({ line: "公生、ピアノ弾いて。" })));
    expect(a.startsWith("ai:subs:v1:")).toBe(true);
  });

  it("asks for the target line only, with the words to read", () => {
    const { system, user } = subPrompt(req());
    expect(system).toContain("Translate only the TARGET line");
    expect(user).toContain("TARGET: 公生、ピアノ弾いてよ。");
    expect(user).toContain("- 久しぶり。");
    expect(user).toContain("0=公生, 3=弾い");
  });
});

describe("dual subtitle answers", () => {
  it("keeps English and kana readings for asked words only", () => {
    expect(parseSubTranslation({ en: " Kousei, play the piano! ", readings: { "0": "こうせい", "3": "ひい", "7": "ねこ", "1": "kousei" } }, req()))
      .toEqual({ en: "Kousei, play the piano!", readings: { "0": "こうせい", "3": "ひい" } });
  });

  it("drops answers that are not English subtitles", () => {
    expect(parseSubTranslation({ en: "公生、ピアノ弾いてよ。" }, req())).toBeNull();
    expect(parseSubTranslation({ en: "" }, req())).toBeNull();
    expect(parseSubTranslation(null, req())).toBeNull();
    expect(parseSubTranslation({ en: "Play.", readings: ["こうせい"] }, req())).toEqual({ en: "Play.", readings: {} });
  });
});

describe("runSubTranslate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls the model with reasoning off and returns the parsed line", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"en":"Kousei, play!","readings":{"0":"こうせい"}}' } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await runSubTranslate("k", "gpt-5.6-luna", req())).toEqual({ en: "Kousei, play!", readings: { "0": "こうせい" } });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.reasoning_effort).toBe("none");
    expect(sent.response_format).toEqual({ type: "json_object" });
  });

  it("throws on provider errors and unusable answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(runSubTranslate("k", "gpt-4.1-mini", req())).rejects.toThrow("openai_500");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"en":"弾いて"}' } }] }) }));
    await expect(runSubTranslate("k", "gpt-4.1-mini", req())).rejects.toThrow("openai_empty");
  });
});
