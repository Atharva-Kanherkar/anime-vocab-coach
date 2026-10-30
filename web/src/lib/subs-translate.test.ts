import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_BATCH_LINES, batchCacheKey, batchPrompt, normalizeBatchRequest, normalizeSubRequest, parseBatch, parseSubTranslation, runBatchTranslate, runSubTranslate, subCacheKey, subPrompt, type SubTranslateRequest } from "./subs-translate";

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

  it.each([
    ["gpt-5.6-luna", "none"],
    ["gpt-5-mini", "minimal"],
    ["o3-mini", "low"],
    ["o4", "low"],
  ])("asks %s for its fastest supported effort (%s)", async (model, effort) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"en":"Play."}' } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(runSubTranslate("k", model, req())).resolves.toMatchObject({ en: "Play." });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reasoning_effort).toBe(effort);
  });

  it("sends no reasoning params to models that do not reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"en":"Play."}' } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    await runSubTranslate("k", "gpt-4.1-mini", req());
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.reasoning_effort).toBeUndefined();
    expect(sent.temperature).toBe(0.2);
  });

  it("throws on provider errors and unusable answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(runSubTranslate("k", "gpt-4.1-mini", req())).rejects.toThrow("openai_500");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"en":"弾いて"}' } }] }) }));
    await expect(runSubTranslate("k", "gpt-4.1-mini", req())).rejects.toThrow("openai_empty");
  });
});

describe("whole-episode chunks", () => {
  const batch = { title: "Your Lie in April", lines: ["公生、ピアノ弾いてよ。", "はじめまして。", "……"], context: ["前の行"] };

  it("accepts a bounded chunk with some Japanese, and keeps recent context", () => {
    const out = normalizeBatchRequest({ ...batch, context: ["a", "b", "c", "d"] });
    expect("req" in out && out.req).toEqual({ ...batch, context: ["b", "c", "d"] });
    expect(normalizeBatchRequest({ lines: [] })).toEqual({ error: "invalid_lines" });
    expect(normalizeBatchRequest({ lines: Array(MAX_BATCH_LINES + 1).fill("はい") })).toEqual({ error: "invalid_lines" });
    expect(normalizeBatchRequest({ lines: ["hello"] })).toEqual({ error: "invalid_lines" });
    expect(normalizeBatchRequest({ lines: ["はい", 3] })).toEqual({ error: "invalid_lines" });
    expect(normalizeBatchRequest(null)).toEqual({ error: "invalid_body" });
  });

  it("caches by show and lines, not by context", async () => {
    const key = await batchCacheKey(batch);
    expect(key).toBe(await batchCacheKey({ ...batch, context: [] }));
    expect(key).not.toBe(await batchCacheKey({ ...batch, title: "Other" }));
    expect(key.startsWith("ai:subs-batch:v1:")).toBe(true);
  });

  it("numbers the lines and asks for one English line each", () => {
    const { system, user } = batchPrompt(batch);
    expect(system).toContain("same order and count");
    expect(user).toContain("1. 公生、ピアノ弾いてよ。");
    expect(user).toContain("Lines (3):");
  });

  it("keeps aligned answers and names that appear, in kana", () => {
    expect(parseBatch({ en: ["1. Kousei, play.", "Nice to meet you.", "…"], names: { 公生: "こうせい", 猫: "ねこ", 宮園: "miyazono" } }, batch))
      .toEqual({ en: ["Kousei, play.", "Nice to meet you.", ""], names: { 公生: "こうせい" } });
    expect(parseBatch({ en: ["one", "two"] }, batch)).toBeNull();
    expect(parseBatch({ en: ["", "", ""] }, batch)).toBeNull();
    expect(parseBatch(null, batch)).toBeNull();
  });

  it("runs with reasoning off and enough room for every line", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"en":["Play.","Hi.",""],"names":{}}' } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await runBatchTranslate("k", "gpt-4.1-mini", batch)).toEqual({ en: ["Play.", "Hi.", ""], names: {} });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.max_tokens).toBe(60 * 3 + 200);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"en":["only one"]}' } }] }) }));
    await expect(runBatchTranslate("k", "gpt-4.1-mini", batch)).rejects.toThrow("openai_misaligned");
    vi.unstubAllGlobals();
  });
});
