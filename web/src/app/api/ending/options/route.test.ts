import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No Cloudflare binding: ending-store falls back to its in-process Map, so the
// real counters run. OpenAI is the only thing faked.
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => {
    throw new Error("no cf in tests");
  },
}));
vi.mock("@/lib/ai-store", () => ({ getOpenAiKey: async () => "sk-test" }));
vi.mock("@/lib/auth", () => ({ resolveProfile: async () => null }));

const { POST } = await import("./route");
const { DEFAULT_ENDING_OPTIONS_PER_IP_PER_DAY } = await import("@/lib/ending-funnel");
const { currentStatsDay, globalOptionsSpentForTests } = await import("@/lib/ending-store");

const openaiCalls = vi.fn();
const options = [1, 2, 3].map((i) => ({ id: `o${i}`, title: `T${i}`, blurb: "b", tone: "Heartfelt", premiseBeat: "p" }));

beforeEach(() => {
  openaiCalls.mockClear();
  vi.stubGlobal("fetch", async (url: string) => {
    openaiCalls(url);
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify({ styleKey: "spirit", options }) } }] }),
      { status: 200 }
    );
  });
});
afterEach(() => vi.unstubAllGlobals());

const ask = (ip: string) =>
  POST(
    new Request("https://animevocab.com/api/ending/options", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify({ title: "Frieren" }),
    })
  );

describe("/api/ending/options budget (ISO 25010 security: resistance)", () => {
  it("serves an anonymous caller up to the daily budget, then 429s without calling OpenAI", async () => {
    for (let i = 0; i < DEFAULT_ENDING_OPTIONS_PER_IP_PER_DAY; i++) {
      expect((await ask("203.0.113.7")).status).toBe(200);
    }
    const blocked = await ask("203.0.113.7");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: "options_limit", needsLogin: true });
    expect(openaiCalls).toHaveBeenCalledTimes(DEFAULT_ENDING_OPTIONS_PER_IP_PER_DAY);
  });

  it("budgets each caller separately", async () => {
    expect((await ask("198.51.100.9")).status).toBe(200);
  });
});

describe("one caller cannot spend everyone's global allowance (PR #172 review, finding 3)", () => {
  it("refused calls do not count against the global budget", async () => {
    const day = currentStatsDay();
    const globalBefore = await globalOptionsSpentForTests(day);
    // Room for exactly this caller's allowance plus one fresh caller.
    process.env.ENDING_OPTIONS_GLOBAL_PER_DAY = String(globalBefore + DEFAULT_ENDING_OPTIONS_PER_IP_PER_DAY + 1);
    try {
      // 100 calls from one hammering caller: 15 allowed, 85 refused.
      const statuses = [];
      for (let i = 0; i < 100; i++) statuses.push((await ask("192.0.2.66")).status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(DEFAULT_ENDING_OPTIONS_PER_IP_PER_DAY);
      expect((await globalOptionsSpentForTests(day)) - globalBefore).toBe(DEFAULT_ENDING_OPTIONS_PER_IP_PER_DAY);
      // A fresh caller is still served.
      expect((await ask("192.0.2.77")).status).toBe(200);
    } finally {
      delete process.env.ENDING_OPTIONS_GLOBAL_PER_DAY;
    }
  });

  it("a caller refused by the global limit gets its own unit back", async () => {
    process.env.ENDING_OPTIONS_GLOBAL_PER_DAY = "0";
    try {
      const res = await ask("192.0.2.88");
      expect(res.status).toBe(429);
      expect(await res.json()).toMatchObject({ error: "capacity" });
    } finally {
      delete process.env.ENDING_OPTIONS_GLOBAL_PER_DAY;
    }
    // With capacity back, the same caller still has its full allowance.
    const statuses = [];
    for (let i = 0; i < DEFAULT_ENDING_OPTIONS_PER_IP_PER_DAY; i++) statuses.push((await ask("192.0.2.88")).status);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });
});
