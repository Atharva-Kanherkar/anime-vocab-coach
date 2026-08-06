import { afterEach, describe, expect, it, vi } from "vitest";
import { runNotebookSummary } from "./notebook-ai";
import { runWordPick, type WordPickRequest } from "./word-picker";
import type { Notebook } from "./notebooks";

function mockOpenAi(content: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  } as unknown as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reasoning-model callers", () => {
  it("uses low-effort reasoning fields for automatic word picks", async () => {
    const fetchMock = mockOpenAi({ word: "見る" });
    vi.stubGlobal("fetch", fetchMock);
    const req: WordPickRequest = {
      line: "前を見て。",
      learnerLevel: 5,
      candidates: [{ word: "見る", reading: "みる", gloss: "to see", level: 5 }],
    };

    await runWordPick("sk-test", "gpt-5.6-luna", req);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      model: "gpt-5.6-luna",
      reasoning_effort: "low",
      max_completion_tokens: 2040,
    });
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("uses the configured reasoning effort for notebook summaries", async () => {
    const fetchMock = mockOpenAi({ weakSpots: ["verbs"], reviewPrompts: ["Use 見る in a sentence."] });
    vi.stubGlobal("fetch", fetchMock);
    const notebook: Notebook = {
      id: "n1",
      name: "Episode one",
      createdAt: "2026-08-06T00:00:00Z",
      updatedAt: "2026-08-06T00:00:00Z",
      entries: [{
        id: "e1",
        kind: "word",
        word: "見る",
        reading: "みる",
        gloss: "to see",
        line: null,
        note: null,
        title: null,
        level: 5,
        tags: [],
        createdAt: "2026-08-06T00:00:00Z",
      }],
    };

    await runNotebookSummary("sk-test", "gpt-5.6-luna", notebook, "max");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reasoning_effort).toBe("max");
    expect(body.max_completion_tokens).toBe(25_600);
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("preserves classic sampling fields for a non-reasoning override", async () => {
    const fetchMock = mockOpenAi({ word: "見る" });
    vi.stubGlobal("fetch", fetchMock);
    const req: WordPickRequest = {
      line: "前を見て。",
      learnerLevel: 5,
      candidates: [{ word: "見る", reading: "みる", gloss: "to see", level: 5 }],
    };

    await runWordPick("sk-test", "gpt-4.1-nano", req);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ temperature: 0.2, max_tokens: 40 });
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body).not.toHaveProperty("max_completion_tokens");
  });
});
