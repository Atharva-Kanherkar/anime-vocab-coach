import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aiLimitForPlan,
  coachCacheKey,
  normalizeCoachRequest,
  runCoach,
  type CoachRequest,
} from "./ai-coach";

function mockOpenAi(content: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  } as unknown as Response);
}

const baseReq: CoachRequest = {
  mode: "explain",
  word: "見る",
  reading: "みる",
  line: "ちゃんと前を見て歩けよ。",
  level: 5,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeCoachRequest", () => {
  it("accepts a valid explain request", () => {
    const out = normalizeCoachRequest({ mode: "explain", word: "見る", line: "前を見て。" });
    expect("req" in out).toBe(true);
  });

  it("rejects an unknown mode", () => {
    expect(normalizeCoachRequest({ mode: "translate", word: "x", line: "y" })).toEqual({ error: "invalid_mode" });
  });

  it("requires a word and a line", () => {
    expect(normalizeCoachRequest({ mode: "explain", line: "y" })).toEqual({ error: "missing_word" });
    expect(normalizeCoachRequest({ mode: "explain", word: "x" })).toEqual({ error: "missing_line" });
  });

  it("clamps oversized input", () => {
    const out = normalizeCoachRequest({ mode: "hooks", word: "あ".repeat(500), line: "い".repeat(999) });
    if (!("req" in out)) throw new Error("expected ok");
    expect(out.req.word.length).toBeLessThanOrEqual(80);
    expect(out.req.line.length).toBeLessThanOrEqual(400);
  });
});

describe("aiLimitForPlan", () => {
  it("maps each tier to its cap", () => {
    expect(aiLimitForPlan("free", 5, 300, 600)).toBe(5);
    expect(aiLimitForPlan("pro", 5, 300, 600)).toBe(300);
    expect(aiLimitForPlan("max", 5, 300, 600)).toBe(600);
  });
});

describe("coachCacheKey", () => {
  it("is stable for the same input and differs by mode", async () => {
    const a = await coachCacheKey(baseReq);
    const b = await coachCacheKey(baseReq);
    const c = await coachCacheKey({ ...baseReq, mode: "hooks" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("ai:v2:explain:")).toBe(true);
  });
});

describe("runCoach", () => {
  it("shapes an explain response", async () => {
    vi.stubGlobal("fetch", mockOpenAi(JSON.stringify({ meaning: "to see", nuance: "casual command" })));
    const out = await runCoach("sk-test", "gpt-4.1-nano", baseReq);
    expect(out).toEqual({ mode: "explain", meaning: "to see", nuance: "casual command" });
  });

  it("caps hooks at three", async () => {
    vi.stubGlobal("fetch", mockOpenAi(JSON.stringify({ hooks: ["a", "b", "c", "d"] })));
    const out = await runCoach("sk-test", "gpt-4.1-nano", { ...baseReq, mode: "hooks" });
    expect(out).toEqual({ mode: "hooks", hooks: ["a", "b", "c"] });
  });

  it("throws on an OpenAI HTTP error", async () => {
    vi.stubGlobal("fetch", mockOpenAi("", false, 429));
    await expect(runCoach("sk-test", "gpt-4.1-nano", baseReq)).rejects.toThrow("openai_429");
  });

  it("throws when the model returns no usable content", async () => {
    vi.stubGlobal("fetch", mockOpenAi(JSON.stringify({ meaning: "" })));
    await expect(runCoach("sk-test", "gpt-4.1-nano", baseReq)).rejects.toThrow("openai_empty");
  });
});
