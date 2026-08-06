import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aiLimitForPlan,
  coachCacheKey,
  completionTuning,
  DEFAULT_COACH_MODEL,
  DEFAULT_COACH_REASONING_EFFORT,
  isReasoningModel,
  normalizeCoachRequest,
  normalizeReasoningEffort,
  reasoningEffortForModel,
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

  it("sends reasoning params (not temperature/max_tokens) for the luna default model", async () => {
    const fetchMock = mockOpenAi(JSON.stringify({ meaning: "to see", nuance: "casual" }));
    vi.stubGlobal("fetch", fetchMock);
    await runCoach("sk-test", DEFAULT_COACH_MODEL, baseReq);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("gpt-5.6-luna");
    expect(body.reasoning_effort).toBe("max");
    expect(body.max_completion_tokens).toBeGreaterThan(400);
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("max_tokens");
  });
});

describe("reasoning model tuning", () => {
  it("defaults the coach to gpt-5.6-luna at max effort", () => {
    expect(DEFAULT_COACH_MODEL).toBe("gpt-5.6-luna");
    expect(DEFAULT_COACH_REASONING_EFFORT).toBe("max");
  });

  it("classifies model families", () => {
    expect(isReasoningModel("gpt-5.6-luna")).toBe(true);
    expect(isReasoningModel("o3-mini")).toBe(true);
    expect(isReasoningModel("gpt-4.1-nano")).toBe(false);
    expect(isReasoningModel("gpt-4o")).toBe(false);
  });

  it("keeps the classic contract for non-reasoning models", () => {
    expect(completionTuning("gpt-4.1-nano", { temperature: 0.4, maxTokens: 400 })).toEqual({
      temperature: 0.4,
      max_tokens: 400,
    });
  });

  it("gives reasoning tokens headroom scaled by effort", () => {
    const none = completionTuning("gpt-5.6-luna", { temperature: 0.4, maxTokens: 400, effort: "none" });
    const low = completionTuning("gpt-5.6-luna", { temperature: 0.4, maxTokens: 400, effort: "low" });
    const max = completionTuning("gpt-5.6-luna", { temperature: 0.4, maxTokens: 400, effort: "max" });
    expect(none.max_completion_tokens).toBe(400);
    expect(low.max_completion_tokens).toBe(2400);
    expect(max.max_completion_tokens).toBe(25400);
    expect(max.max_completion_tokens).toBeGreaterThanOrEqual(25_000);
    expect(max.reasoning_effort).toBe("max");
  });

  it("uses conservative defaults but preserves explicit model overrides", () => {
    expect(reasoningEffortForModel("gpt-5.4-mini")).toBe("medium");
    expect(reasoningEffortForModel("gpt-5.4-mini", "none")).toBe("none");
    expect(reasoningEffortForModel("gpt-5.4-mini", "xhigh")).toBe("xhigh");
    expect(reasoningEffortForModel("gpt-5.5", "max")).toBe("max");
    expect(reasoningEffortForModel("o3-mini", "low")).toBe("low");
    expect(() => reasoningEffortForModel("gpt-5", "max")).toThrow(
      "unsupported_reasoning_effort:gpt-5:max"
    );
    expect(() => reasoningEffortForModel("gpt-5.4-mini", "max")).toThrow(
      "unsupported_reasoning_effort:gpt-5.4-mini:max"
    );
    expect(() => reasoningEffortForModel("o3-mini", "xhigh")).toThrow(
      "unsupported_reasoning_effort:o3-mini:xhigh"
    );
    expect(() => reasoningEffortForModel("gpt-5.6-luna", "minimal")).toThrow(
      "unsupported_reasoning_effort:gpt-5.6-luna:minimal"
    );
  });

  it("normalizes effort strings and rejects junk", () => {
    expect(normalizeReasoningEffort("xhigh")).toBe("xhigh");
    expect(normalizeReasoningEffort("MAX")).toBeNull();
    expect(normalizeReasoningEffort("")).toBeNull();
    expect(normalizeReasoningEffort(undefined)).toBeNull();
  });
});
