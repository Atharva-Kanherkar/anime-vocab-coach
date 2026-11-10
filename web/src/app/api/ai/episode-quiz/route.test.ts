import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route and the quiz lib are real; auth, the meter and OpenAI are stubbed.
const state = vi.hoisted(() => ({
  profile: null as { id: string; email: string | null } | null,
  plan: "free" as "free" | "pro" | "max",
  reserveOk: true,
  refunds: 0,
  reservations: 0,
}));
vi.mock("@/lib/auth", () => ({
  resolveProfile: async () => state.profile,
  resolvePlan: () => state.plan,
}));
vi.mock("@/lib/ai-store", () => ({
  currentMonth: () => "2026-11",
  quotaFor: async () => 300,
  getOpenAiKey: async () => "sk-test",
  getCoachConfig: async () => ({ model: "gpt-4o-mini" }),
  reserveUsage: async () => {
    state.reservations++;
    return { ok: state.reserveOk, used: 7, limit: 300, refund: async () => void state.refunds++ };
  },
}));
vi.mock("@/lib/request-identity", () => ({
  requestIdentity: async () => ({ userId: state.profile?.id ?? null, plan: null }),
  authFailureOf: () => null,
}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: {} }) }));

const { POST } = await import("./route");

const lines = Array.from({ length: 20 }, (_, i) => ({ ja: `行${i}`, en: `line ${i}` }));
const question = { kind: "story", prompt: "Q?", choices: ["a", "b", "c", "d"], answer: 0, explain: "x" };

function openAi(content: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    headers: new Headers(),
    json: async () => (ok ? { choices: [{ message: { content: JSON.stringify(content) } }], usage: {} } : { error: {} }),
  } as unknown as Response);
}

const call = (body: unknown) =>
  POST(
    new Request("https://animevocab.com/api/ai/episode-quiz", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer avc_st_abc" },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  state.profile = { id: "user_1", email: null };
  state.plan = "free";
  state.reserveOk = true;
  state.refunds = 0;
  state.reservations = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/ai/episode-quiz", () => {
  it("401s without an account", async () => {
    state.profile = null;
    expect((await call({ mode: "generate", lines })).status).toBe(401);
  });

  it("gives a free learner a quiz and spends one AI call", async () => {
    vi.stubGlobal("fetch", openAi({ questions: Array(12).fill(question) }));
    const res = await call({ mode: "generate", title: "Frieren", lines });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { questions: unknown[]; plan: string };
    expect(body.questions).toHaveLength(12);
    expect(body.plan).toBe("free");
    expect(state.reservations).toBe(1);
  });

  it("keeps Haru for Pro and Max", async () => {
    const fetchSpy = openAi({ ok: true, verdict: "Nice", corrected: "猫が好き", note: "", say: "いいね" });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await call({ mode: "haru", sentence: "猫が好き", words: ["猫"], score: 9, total: 12 });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "pro_required" });
    expect(state.reservations).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    state.plan = "pro";
    const paid = await call({ mode: "haru", sentence: "猫が好き", words: ["猫"], score: 9, total: 12 });
    expect(paid.status).toBe(200);
    expect(((await paid.json()) as { haru: { verdict: string } }).haru.verdict).toBe("Nice");
  });

  it("429s when the allowance is spent", async () => {
    state.reserveOk = false;
    const res = await call({ mode: "generate", lines });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toBe("ai_quota_exhausted");
  });

  it("refunds the call when the model fails or under-delivers", async () => {
    vi.stubGlobal("fetch", openAi(null, false));
    expect((await call({ mode: "generate", lines })).status).toBe(502);
    vi.stubGlobal("fetch", openAi({ questions: [question] }));
    const short = await call({ mode: "generate", lines });
    expect(short.status).toBe(502);
    expect(((await short.json()) as { error: string }).error).toBe("quiz_too_short");
    expect(state.refunds).toBe(2);
  });

  it("400s on too few lines before spending anything", async () => {
    const res = await call({ mode: "generate", lines: lines.slice(0, 5) });
    expect(res.status).toBe(400);
    expect(state.reservations).toBe(0);
  });
});
