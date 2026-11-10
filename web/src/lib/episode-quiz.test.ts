import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_QUESTIONS,
  MAX_QUIZ_LINES,
  normalizeQuizRequest,
  runEpisodeQuiz,
  sanitizeHaru,
  sanitizeQuiz,
} from "./episode-quiz";

const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ ja: `行${i}です`, en: `line ${i}` }));

function mc(kind: "meaning" | "line" | "story", extra: Record<string, unknown> = {}) {
  return { kind, prompt: "Q?", quote: "猫が好き", choices: ["a", "b", "c", "d"], answer: 1, explain: "because", ...extra };
}

const build = { kind: "build", prompt: "Build: I like cats", tiles: ["猫", "が", "好き"], explain: "x" };

function quiz(n: number) {
  return { questions: Array.from({ length: n }, (_, i) => (i % 4 === 3 ? build : mc("story"))) };
}

describe("normalizeQuizRequest", () => {
  it("rejects bodies without a known mode", () => {
    expect(normalizeQuizRequest(null)).toEqual({ error: "invalid_body" });
    expect(normalizeQuizRequest({ mode: "exam" })).toEqual({ error: "invalid_mode" });
  });

  it("needs enough distinct lines to generate", () => {
    const dup = Array.from({ length: 30 }, () => ({ ja: "同じ", en: "" }));
    expect(normalizeQuizRequest({ mode: "generate", lines: dup })).toEqual({ error: "too_few_lines" });
    expect(normalizeQuizRequest({ mode: "generate", lines: lines(11) })).toEqual({ error: "too_few_lines" });
  });

  it("clamps lines, line length, known words and title", () => {
    const long = [{ ja: "あ".repeat(500), en: "e".repeat(500) }, ...lines(300)];
    const out = normalizeQuizRequest({
      mode: "generate",
      title: "t".repeat(300),
      lines: long,
      known: Array.from({ length: 80 }, (_, i) => `w${i}`),
      direction: "weird",
    });
    if (!("req" in out) || out.req.mode !== "generate") throw new Error("expected generate");
    expect(out.req.lines).toHaveLength(MAX_QUIZ_LINES);
    expect(out.req.lines[0].ja).toHaveLength(200);
    expect(out.req.lines[0].en).toHaveLength(200);
    expect(out.req.known).toHaveLength(40);
    expect(out.req.title).toHaveLength(120);
    expect(out.req.direction).toBe("en-ja");
  });

  it("haru needs a sentence and bounds the score", () => {
    expect(normalizeQuizRequest({ mode: "haru", sentence: "  " })).toEqual({ error: "missing_sentence" });
    const out = normalizeQuizRequest({ mode: "haru", sentence: "猫が好き", score: 99, total: 12, words: ["猫", "猫", "犬"] });
    if (!("req" in out) || out.req.mode !== "haru") throw new Error("expected haru");
    expect(out.req.score).toBe(12);
    expect(out.req.words).toEqual(["猫", "犬"]);
  });
});

describe("sanitizeQuiz", () => {
  it("keeps valid questions and caps at the maximum", () => {
    const out = sanitizeQuiz(quiz(20));
    if ("error" in out) throw new Error(out.error);
    expect(out.questions).toHaveLength(MAX_QUESTIONS);
  });

  it("drops malformed questions and refuses a short quiz", () => {
    const bad = [
      mc("story", { answer: 4 }),
      mc("story", { choices: ["a", "a", "b", "c"] }),
      mc("story", { choices: ["a", "b", "c"] }),
      mc("line", { quote: "" }),
      { kind: "build", prompt: "x", tiles: ["一"], explain: "" },
      { kind: "build", prompt: "x", tiles: ["a", "a"], explain: "" },
      { kind: "essay", prompt: "x" },
      "nonsense",
    ];
    expect(sanitizeQuiz({ questions: [...bad, ...quiz(7).questions] })).toEqual({ error: "quiz_too_short" });
    const ok = sanitizeQuiz({ questions: [...bad, ...quiz(8).questions] });
    if ("error" in ok) throw new Error(ok.error);
    expect(ok.questions).toHaveLength(8);
  });

  it("keeps the word on meaning questions so a miss can become a card", () => {
    const out = sanitizeQuiz({
      questions: [mc("meaning", { word: { word: "猫", reading: "ねこ", gloss: "" } }), ...quiz(8).questions],
    });
    if ("error" in out) throw new Error(out.error);
    expect(out.questions[0].word).toEqual({ word: "猫", reading: "ねこ", gloss: "b" });
  });

  it("gives build questions a quote from their tiles", () => {
    const out = sanitizeQuiz(quiz(8));
    if ("error" in out) throw new Error(out.error);
    expect(out.questions.find((q) => q.kind === "build")?.quote).toBe("猫が好き");
  });
});

describe("sanitizeHaru", () => {
  it("requires a verdict and coerces ok", () => {
    expect(sanitizeHaru({ ok: true })).toEqual({ error: "openai_empty" });
    expect(sanitizeHaru({ ok: "yes", verdict: " Nice ", corrected: "猫が好きです", note: "", say: "いいね！" })).toEqual({
      ok: false,
      verdict: "Nice",
      corrected: "猫が好きです",
      note: "",
      say: "いいね！",
    });
  });
});

describe("runEpisodeQuiz", () => {
  afterEach(() => vi.unstubAllGlobals());

  function openAi(content: unknown) {
    return vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }], usage: {} }),
    } as unknown as Response);
  }

  it("returns validated questions", async () => {
    vi.stubGlobal("fetch", openAi(quiz(12)));
    const norm = normalizeQuizRequest({ mode: "generate", lines: lines(20) });
    if (!("req" in norm)) throw new Error("bad");
    const out = await runEpisodeQuiz("k", "gpt-4o-mini", norm.req);
    expect("questions" in out && out.questions).toHaveLength(12);
  });

  it("throws quiz_too_short when the model under-delivers", async () => {
    vi.stubGlobal("fetch", openAi(quiz(3)));
    const norm = normalizeQuizRequest({ mode: "generate", lines: lines(20) });
    if (!("req" in norm)) throw new Error("bad");
    await expect(runEpisodeQuiz("k", "gpt-4o-mini", norm.req)).rejects.toThrow("quiz_too_short");
  });
});
