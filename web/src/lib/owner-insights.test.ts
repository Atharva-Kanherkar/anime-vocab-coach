import { afterEach, describe, expect, it, vi } from "vitest";
import { buildInsightsDigest, runOwnerInsights } from "./owner-insights";
import { EMPTY_CACHE, EMPTY_TRANSCRIBE, type OwnerDashboardData, type WindowOption } from "./owner-dashboard";
import { EMPTY_HISTORY, type OwnerHistory } from "./owner-history";

const WIN: WindowOption = { hours: 12, label: "12h" };

function baseData(over: Partial<OwnerDashboardData> = {}): OwnerDashboardData {
  return {
    configured: true,
    queryError: null,
    authFailed: false,
    rateLimited: false,
    totals: {
      calls: 0,
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      avgLatencyMs: 0,
      errors: 0,
      cachedHits: 0,
      users: 0,
      cacheHitRate: 0,
      errorRate: 0,
    },
    byModel: [],
    byOperation: [],
    bySurface: [],
    byEffort: [],
    errors: [],
    series: [],
    topUsers: [],
    pages: [],
    countries: [],
    referrers: [],
    devices: [],
    apiRoutes: [],
    eventUsers: [],
    extensionFunnel: [],
    transcribe: EMPTY_TRANSCRIBE,
    eventUserCount: 0,
    learningLoop: [],
    extensionBuilds: [],
    animeContextCache: EMPTY_CACHE,
    apiErrors: [],
    proFunnel: [],
    ...over,
  };
}

function mockOpenAi(content: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  } as unknown as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildInsightsDigest", () => {
  it("names the window and scope", () => {
    const digest = buildInsightsDigest(WIN, baseData(), null);
    expect(digest).toContain("Window: last 12h");
    expect(digest).toContain("all users");
  });

  it("tells the model which builds the learning loop came from (#159)", () => {
    const digest = buildInsightsDigest(
      WIN,
      baseData({
        extensionBuilds: [
          { label: "unstamped (≤ 0.5.6)", events: 3, users: 1, anonEvents: 2, identifiedEvents: 1 },
        ],
      }),
      null
    );
    expect(digest).toContain("Extension builds sending learning-loop events");
    expect(digest).toContain("unstamped (≤ 0.5.6): 3 events, 1 learners");
    expect(buildInsightsDigest(WIN, baseData(), null)).not.toContain("Extension builds");
  });

  it("tells the model why routes failed, not just how often (#160)", () => {
    const digest = buildInsightsDigest(
      WIN,
      baseData({
        apiErrors: [
          {
            route: "/api/anime/context",
            status: "401",
            meaning: "unauthorized",
            authKind: "sync_token",
            reason: "token_unknown",
            calls: 250,
            users: 0,
            anonCalls: 250,
            firstSeen: "2026-08-07 10:00:00",
            lastSeen: "2026-09-22 18:00:00",
          },
        ],
      }),
      null
    );
    expect(digest).toContain("## API errors by status");
    expect(digest).toContain(
      "/api/anime/context 401 unauthorized (auth sync_token, reason token_unknown): 250 calls, 0 learners, last 2026-09-22 18:00"
    );
    expect(buildInsightsDigest(WIN, baseData(), null)).not.toContain("API errors by status");
  });

  it("names the focus user instead of 'all users' on a drill-down", () => {
    const digest = buildInsightsDigest(WIN, baseData(), null, "user_42");
    expect(digest).toContain("single user user_42");
    expect(digest).not.toContain("all users");
  });

  it("reports LLM totals grounded in the actual numbers", () => {
    const digest = buildInsightsDigest(
      WIN,
      baseData({
        totals: {
          calls: 1000,
          cost: 12.5,
          inputTokens: 500,
          outputTokens: 200,
          reasoningTokens: 50,
          cachedInputTokens: 100,
          avgLatencyMs: 820,
          errors: 40,
          cachedHits: 300,
          users: 17,
          cacheHitRate: 0.3,
          errorRate: 0.04,
        },
      }),
      null
    );
    expect(digest).toContain("1,000 calls");
    expect(digest).toContain("17 distinct users");
    expect(digest).toContain("$12.50 spend");
    expect(digest).toContain("4.0% (40 failed)");
  });

  it("caps a long group breakdown rather than listing everything", () => {
    const byModel = Array.from({ length: 20 }, (_, i) => ({
      label: `model-${i}`,
      calls: 20 - i,
      cost: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      avgLatencyMs: 0,
      errors: 0,
    }));
    const digest = buildInsightsDigest(WIN, baseData({ byModel }), null);
    expect(digest).toContain("model-0");
    expect(digest).toContain("model-5");
    expect(digest).not.toContain("model-6");
  });

  it("summarizes a time series in O(1) lines instead of one line per bucket", () => {
    const series = Array.from({ length: 90 }, (_, i) => ({
      bucket: `2026-08-${String(i + 1).padStart(2, "0")}`,
      calls: i === 45 ? 500 : 10,
      cost: 0,
    }));
    const digest = buildInsightsDigest(WIN, baseData({ series }), null);
    expect(digest).toContain("90 buckets");
    expect(digest).toContain("peak 2026-08-46: 500 calls");
    // The digest describes the series, it does not enumerate all 90 buckets.
    expect(digest.split("\n").length).toBeLessThan(60);
  });

  it("omits top-users and funnel sections on a single-user drill-down", () => {
    const digest = buildInsightsDigest(
      WIN,
      baseData({
        topUsers: [{ userId: "u1", plan: "pro", calls: 5, cost: 1, outputTokens: 1, reasoningTokens: 0, errors: 0, lastSeen: "" }],
        extensionFunnel: [{ label: "install", value: 3 }],
      }),
      null,
      "user_42"
    );
    expect(digest).not.toContain("Top users by spend");
    expect(digest).not.toContain("Extension install funnel");
  });

  it("flags Listening Mode as absent rather than inventing zeros", () => {
    const digest = buildInsightsDigest(WIN, baseData(), null);
    expect(digest).toContain("no transcription recorded in this window");
  });

  it("includes all-time history only when available", () => {
    const history: OwnerHistory = { ...EMPTY_HISTORY, available: true, totalUsers: 42, activeLast30: 9, neverActive: 3 };
    const digest = buildInsightsDigest(WIN, baseData(), history);
    expect(digest).toContain("42 total signups");

    const digestNoHistory = buildInsightsDigest(WIN, baseData(), null);
    expect(digestNoHistory).not.toContain("total signups");
  });

  it("surfaces a partial-failure note so the model treats those panels as unknown", () => {
    const digest = buildInsightsDigest(WIN, baseData({ queryError: "unauthorized (2: pages, countries)" }), null);
    expect(digest).toContain("some panels failed to load");
    expect(digest).toContain("Treat those as unknown, not zero");
  });
});

describe("runOwnerInsights", () => {
  it("parses a well-formed response", async () => {
    vi.stubGlobal(
      "fetch",
      mockOpenAi(
        JSON.stringify({
          summary: "Spend is flat, errors ticked up on one model.",
          insights: ["gpt-x error rate is 3x the rest"],
          actions: ["Check gpt-x's recent error codes"],
        })
      )
    );
    const out = await runOwnerInsights("sk-test", "gpt-4.1-nano", "digest text");
    expect(out.summary).toContain("Spend is flat");
    expect(out.insights).toEqual(["gpt-x error rate is 3x the rest"]);
    expect(out.actions).toEqual(["Check gpt-x's recent error codes"]);
  });

  it("drops non-string entries and caps list length", async () => {
    const insights = [...Array(20)].map((_, i) => `insight ${i}`);
    vi.stubGlobal("fetch", mockOpenAi(JSON.stringify({ summary: "", insights: [...insights, 5, null], actions: [] })));
    const out = await runOwnerInsights("sk-test", "gpt-4.1-nano", "digest text");
    expect(out.insights).toHaveLength(8);
    expect(out.insights[0]).toBe("insight 0");
  });

  it("throws on unparseable JSON", async () => {
    vi.stubGlobal("fetch", mockOpenAi("not json"));
    await expect(runOwnerInsights("sk-test", "gpt-4.1-nano", "digest text")).rejects.toThrow("openai_bad_json");
  });

  it("throws when the model returns nothing usable", async () => {
    vi.stubGlobal("fetch", mockOpenAi(JSON.stringify({ summary: "", insights: [], actions: [] })));
    await expect(runOwnerInsights("sk-test", "gpt-4.1-nano", "digest text")).rejects.toThrow("openai_empty");
  });

  it("throws a shaped error on an OpenAI HTTP failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({ error: { message: "boom" } }),
      } as unknown as Response)
    );
    await expect(runOwnerInsights("sk-test", "gpt-4.1-nano", "digest text")).rejects.toThrow("openai_500");
    errorSpy.mockRestore();
  });
});

describe("Pro funnel in the digest (#162)", () => {
  it("lists each surface with its steps and rates, n beside them", () => {
    const digest = buildInsightsDigest(
      WIN,
      baseData({
        proFunnel: [
          {
            surface: "ext_milestone",
            shown: { events: 40, users: 12 },
            clicked: { events: 10, users: 8 },
            checkout: { events: 0, users: 0 },
            clickRate: 0.25,
            checkoutRate: 0,
          },
          {
            surface: "app_billing",
            shown: { events: 0, users: 0 },
            clicked: { events: 0, users: 0 },
            checkout: { events: 1, users: 1 },
            clickRate: null,
            checkoutRate: null,
          },
        ],
      }),
      null
    );
    expect(digest).toContain("## Pro funnel");
    expect(digest).toContain("ext_milestone: shown 40 (12 learners), clicked 10, checkout 0");
    expect(digest).toMatch(/click rate 25(\.0)?% of 40/);
    expect(digest).toContain("app_billing");
    expect(digest).toContain("click rate no data yet");
  });

  it("omits the section when there is nothing to say", () => {
    expect(buildInsightsDigest(WIN, baseData(), null)).not.toContain("## Pro funnel");
  });
});
