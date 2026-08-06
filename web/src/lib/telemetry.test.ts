import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_USAGE,
  MODEL_RATES,
  estimateCostUsd,
  isKnownModel,
  parseUsage,
  rateForModel,
} from "./llm-pricing";
import {
  authKindOf,
  deviceClass,
  recordLlmCall,
  recordUserEvent,
  requestFacts,
  setTelemetrySinksForTests,
  surfaceOf,
  type AnalyticsEngineDataset,
} from "./telemetry";
import {
  EVENT_BLOBS,
  EVENT_DOUBLES,
  LLM_BLOBS,
  LLM_DOUBLES,
  eventColumn,
  llmColumn,
} from "./telemetry-schema";
import {
  llmGroupSql,
  llmTotalsSql,
  sqlHours,
  sqlString,
  runQuery,
} from "./telemetry-query";
import { isTrackableEvent, normalizeTrackPath } from "./track-events";

function sink() {
  const writes: { blobs?: string[]; doubles?: number[]; indexes?: string[] }[] = [];
  const ae: AnalyticsEngineDataset = { writeDataPoint: (e) => void writes.push(e) };
  return { ae, writes };
}

/** Read a named blob back out of a captured write, using the same schema the
 * writer used — this is what catches a writer/reader position drift. */
function blobOf(
  write: { blobs?: string[] },
  field: string,
  names: readonly string[]
): string | undefined {
  return write.blobs?.[names.indexOf(field)];
}

afterEach(() => {
  setTelemetrySinksForTests(null, null);
  vi.restoreAllMocks();
});

describe("llm pricing", () => {
  it("prices a luna call from real usage", () => {
    // 1000 input, 5000 output → 1000*0.2/1e6 + 5000*1.2/1e6
    const cost = estimateCostUsd("gpt-5.6-luna", {
      inputTokens: 1000,
      outputTokens: 5000,
      reasoningTokens: 4500,
      cachedInputTokens: 0,
    });
    expect(cost).toBeCloseTo(0.0002 + 0.006, 6);
  });

  it("does not double-count reasoning tokens", () => {
    // reasoning_tokens is a SUBSET of completion_tokens; adding it again would
    // roughly double the reported cost of every reasoning call.
    const withReasoning = estimateCostUsd("gpt-5.6-luna", {
      inputTokens: 100,
      outputTokens: 1000,
      reasoningTokens: 900,
      cachedInputTokens: 0,
    });
    const without = estimateCostUsd("gpt-5.6-luna", {
      inputTokens: 100,
      outputTokens: 1000,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    });
    expect(withReasoning).toBe(without);
  });

  it("discounts cached input instead of adding it on top", () => {
    const half = estimateCostUsd("gpt-5.6-luna", {
      inputTokens: 1000,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 1000,
    });
    // All 1000 tokens at the cached rate, not 1000 full + 1000 cached.
    expect(half).toBeCloseTo((1000 * 0.02) / 1e6, 8);
  });

  it("never lets cached exceed total input", () => {
    const cost = estimateCostUsd("gpt-5.6-luna", {
      inputTokens: 10,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 9999,
    });
    expect(cost).toBeGreaterThanOrEqual(0);
  });

  it("resolves dated snapshots to the base model rate", () => {
    expect(rateForModel("gpt-5.6-luna-2026-07-09")).toEqual(MODEL_RATES["gpt-5.6-luna"]);
    expect(isKnownModel("gpt-5.6-luna-2026-07-09")).toBe(true);
  });

  it("reports 0 for an unknown model rather than guessing", () => {
    expect(isKnownModel("some-future-model")).toBe(false);
    expect(
      estimateCostUsd("some-future-model", {
        inputTokens: 1e6,
        outputTokens: 1e6,
        reasoningTokens: 0,
        cachedInputTokens: 0,
      })
    ).toBe(0);
  });

  it("parses OpenAI usage including reasoning and cached details", () => {
    expect(
      parseUsage({
        prompt_tokens: 350,
        completion_tokens: 4200,
        prompt_tokens_details: { cached_tokens: 128 },
        completion_tokens_details: { reasoning_tokens: 3900 },
      })
    ).toEqual({
      inputTokens: 350,
      outputTokens: 4200,
      reasoningTokens: 3900,
      cachedInputTokens: 128,
    });
  });

  it("treats missing or malformed usage as zero", () => {
    expect(parseUsage(undefined)).toEqual(EMPTY_USAGE);
    expect(parseUsage({ prompt_tokens: "many" })).toEqual(EMPTY_USAGE);
  });
});

describe("telemetry schema", () => {
  it("maps fields to stable AE columns", () => {
    expect(llmColumn("model")).toBe("blob1");
    expect(llmColumn("costUsd")).toBe("double5");
    expect(eventColumn("kind")).toBe("blob1");
    expect(eventColumn("durationMs")).toBe("double1");
  });

  it("stays inside the AE limit of 20 blobs / 20 doubles", () => {
    expect(LLM_BLOBS.length).toBeLessThanOrEqual(20);
    expect(LLM_DOUBLES.length).toBeLessThanOrEqual(20);
    expect(EVENT_BLOBS.length).toBeLessThanOrEqual(20);
    expect(EVENT_DOUBLES.length).toBeLessThanOrEqual(20);
  });

  it("throws on an unknown field rather than silently mis-addressing", () => {
    expect(() => llmColumn("nope" as never)).toThrow(/unknown telemetry field/);
  });
});

describe("recordLlmCall", () => {
  it("writes values at the positions the reader expects", async () => {
    const { ae, writes } = sink();
    setTelemetrySinksForTests(ae, null);

    await recordLlmCall({
      model: "gpt-5.6-luna",
      operation: "explain",
      status: "ok",
      userId: "user_123",
      plan: "pro",
      effort: "max",
      country: "JP",
      surface: "extension",
      usage: {
        inputTokens: 1000,
        outputTokens: 2000,
        reasoningTokens: 1800,
        cachedInputTokens: 0,
      },
      latencyMs: 4200,
    });

    expect(writes).toHaveLength(1);
    const w = writes[0]!;
    expect(blobOf(w, "model", LLM_BLOBS)).toBe("gpt-5.6-luna");
    expect(blobOf(w, "operation", LLM_BLOBS)).toBe("explain");
    expect(blobOf(w, "userId", LLM_BLOBS)).toBe("user_123");
    expect(blobOf(w, "surface", LLM_BLOBS)).toBe("extension");
    expect(w.doubles?.[LLM_DOUBLES.indexOf("reasoningTokens")]).toBe(1800);
    expect(w.doubles?.[LLM_DOUBLES.indexOf("latencyMs")]).toBe(4200);
    // Cost computed from usage, not passed in.
    expect(w.doubles?.[LLM_DOUBLES.indexOf("costUsd")]).toBeCloseTo(0.0026, 6);
    expect(w.indexes).toEqual(["gpt-5.6-luna"]);
  });

  it("records a cached hit at zero cost with no tokens", async () => {
    const { ae, writes } = sink();
    setTelemetrySinksForTests(ae, null);
    await recordLlmCall({
      model: "gpt-5.6-luna",
      operation: "explain",
      status: "cached",
      costUsd: 0,
    });
    const w = writes[0]!;
    expect(blobOf(w, "status", LLM_BLOBS)).toBe("cached");
    expect(w.doubles?.[LLM_DOUBLES.indexOf("costUsd")]).toBe(0);
  });

  it("falls back to anon and never writes undefined", async () => {
    const { ae, writes } = sink();
    setTelemetrySinksForTests(ae, null);
    await recordLlmCall({ model: "m", operation: "o", status: "error" });
    const w = writes[0]!;
    expect(blobOf(w, "userId", LLM_BLOBS)).toBe("anon");
    expect(w.blobs?.every((b) => typeof b === "string")).toBe(true);
    expect(w.doubles?.every((d) => Number.isFinite(d))).toBe(true);
  });

  it("truncates a long blob instead of dropping the whole data point", async () => {
    const { ae, writes } = sink();
    setTelemetrySinksForTests(ae, null);
    await recordLlmCall({
      model: "m",
      operation: "o",
      status: "error",
      errorCode: "x".repeat(5000),
    });
    expect(blobOf(writes[0]!, "errorCode", LLM_BLOBS)!.length).toBe(256);
  });

  it("swallows a sink failure so telemetry cannot break a request", async () => {
    setTelemetrySinksForTests(
      {
        writeDataPoint: () => {
          throw new Error("AE down");
        },
      },
      null
    );
    await expect(
      recordLlmCall({ model: "m", operation: "o", status: "ok" })
    ).resolves.toBeUndefined();
  });

  it("is a no-op with no binding", async () => {
    setTelemetrySinksForTests(null, null);
    await expect(
      recordLlmCall({ model: "m", operation: "o", status: "ok" })
    ).resolves.toBeUndefined();
  });
});

describe("recordUserEvent", () => {
  it("writes a pageview with geo and device", async () => {
    const { ae, writes } = sink();
    setTelemetrySinksForTests(null, ae);
    await recordUserEvent({
      kind: "pageview",
      name: "/app/cards",
      userId: "user_9",
      country: "IN",
      city: "Pune",
      device: "mobile",
      status: 200,
    });
    const w = writes[0]!;
    expect(blobOf(w, "kind", EVENT_BLOBS)).toBe("pageview");
    expect(blobOf(w, "name", EVENT_BLOBS)).toBe("/app/cards");
    expect(blobOf(w, "country", EVENT_BLOBS)).toBe("IN");
    expect(blobOf(w, "status", EVENT_BLOBS)).toBe("200");
    expect(w.indexes).toEqual(["pageview"]);
  });
});

describe("request facts", () => {
  it("classifies devices", () => {
    expect(deviceClass("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(deviceClass("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)")).toBe("desktop");
    expect(deviceClass("Googlebot/2.1")).toBe("bot");
    expect(deviceClass(null)).toBe("unknown");
  });

  it("reduces a referrer to its host and ignores a malformed one", () => {
    const withRef = new Request("https://animevocab.com/", {
      headers: { referer: "https://news.ycombinator.com/item?id=1#x" },
    });
    expect(requestFacts(withRef).referrerHost).toBe("news.ycombinator.com");

    const bad = new Request("https://animevocab.com/", { headers: { referer: "notaurl" } });
    expect(requestFacts(bad).referrerHost).toBe("");
  });

  it("reads country from the Cloudflare header when cf is absent", () => {
    const req = new Request("https://animevocab.com/", { headers: { "cf-ipcountry": "JP" } });
    expect(requestFacts(req).country).toBe("JP");
  });

  it("detects the extension's sync-token surface", () => {
    const ext = new Request("https://animevocab.com/api/ai/coach", {
      method: "POST",
      headers: { authorization: "Bearer avc_st_abc123" },
    });
    expect(authKindOf(ext)).toBe("sync_token");
    expect(surfaceOf(ext)).toBe("extension");

    const web = new Request("https://animevocab.com/api/ai/coach", {
      method: "POST",
      headers: { cookie: "__session=abc" },
    });
    expect(authKindOf(web)).toBe("clerk");
    expect(surfaceOf(web)).toBe("web");

    const anon = new Request("https://animevocab.com/");
    expect(authKindOf(anon)).toBe("none");
  });
});

describe("track event allowlist", () => {
  it("accepts known events only", () => {
    expect(isTrackableEvent("coach_open")).toBe(true);
    expect(isTrackableEvent("arbitrary_string")).toBe(false);
    expect(isTrackableEvent(42)).toBe(false);
  });

  it("collapses record ids so cardinality stays bounded", () => {
    expect(normalizeTrackPath("/app/cards/9f2b1c8d4e5a6b7c")).toBe("/app/cards/:id");
    expect(normalizeTrackPath("/app/notebooks/abc123XYZ")).toBe("/app/notebooks/:id");
    expect(normalizeTrackPath("/e/550e8400-e29b-41d4-a716-446655440000")).toBe("/e/:id");
    expect(normalizeTrackPath("/m/Kj8sPq2mZx")).toBe("/m/:id");
  });

  it("keeps SEO landing pages and blog slugs intact", () => {
    // These ARE the page identity and are the whole point of the traffic
    // panel — an id heuristic wide enough to catch this app's ids would
    // collapse every one of them into "/:id".
    expect(normalizeTrackPath("/learn-japanese-netflix-anime")).toBe(
      "/learn-japanese-netflix-anime"
    );
    expect(normalizeTrackPath("/vs-migaku")).toBe("/vs-migaku");
    expect(normalizeTrackPath("/blog/how-to-learn-kanji")).toBe("/blog/how-to-learn-kanji");
    expect(normalizeTrackPath("/ja/anime-vocabulary")).toBe("/ja/anime-vocabulary");
    expect(normalizeTrackPath("/")).toBe("/");
  });

  it("strips query strings, which can carry PII and campaign noise", () => {
    expect(normalizeTrackPath("/pricing?email=a@b.com&utm_source=x")).toBe("/pricing");
    expect(normalizeTrackPath("https://animevocab.com/app?tab=cards")).toBe("/app");
  });

  it("rejects paths that are not same-site", () => {
    expect(normalizeTrackPath("//evil.com/steal")).toBeNull();
    expect(normalizeTrackPath("app/cards")).toBeNull();
    expect(normalizeTrackPath("")).toBeNull();
    expect(normalizeTrackPath("javascript:alert(1)")).toBeNull();
  });

  it("caps absurdly deep paths", () => {
    expect(normalizeTrackPath("/a/b/c/d/e/f/g/h/i/j")).toBe("/:deep");
  });
});

describe("telemetry query builders", () => {
  it("escapes quotes in an interpolated user id", () => {
    expect(sqlString("user_'; DROP TABLE x --")).toBe("'user_\\'; DROP TABLE x --'");
    expect(sqlString("back\\slash")).toBe("'back\\\\slash'");
  });

  it("passes an escaped user filter into the query", () => {
    const sql = llmTotalsSql(24, "o'brien");
    expect(sql).toContain("blob3 = 'o\\'brien'");
  });

  it("clamps the window to a sane integer", () => {
    expect(sqlHours(NaN)).toBe(24);
    expect(sqlHours(-5)).toBe(24);
    expect(sqlHours(1e9)).toBe(24 * 90);
    expect(sqlHours(168)).toBe(168);
  });

  it("weights every aggregate by the sample interval", () => {
    // AE samples under load; an unweighted COUNT under-reports both traffic
    // and spend, which is worse than showing nothing.
    const sql = llmTotalsSql(24);
    expect(sql).toContain("SUM(_sample_interval) AS calls");
    expect(sql).toContain("* _sample_interval) AS cost");
    expect(sql).not.toMatch(/COUNT\(\*\)/);
  });

  it("buckets hourly for short windows and daily for long ones", async () => {
    const { llmSeriesSql } = await import("./telemetry-query");
    expect(llmSeriesSql(24)).toContain("toStartOfHour");
    expect(llmSeriesSql(24 * 30)).toContain("toDate");
  });

  it("bounds the row limit no matter what is asked for", () => {
    expect(llmGroupSql("model", 24, 1e6)).toContain("LIMIT 200");
    expect(llmGroupSql("model", 24, -3)).toContain("LIMIT 1");
  });

  it("reports not_configured instead of throwing when creds are absent", async () => {
    const out = await runQuery("SELECT 1", null);
    expect(out).toEqual({ ok: false, reason: "not_configured" });
  });

  it("surfaces an API failure as query_failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "forbidden",
      } as unknown as Response)
    );
    const out = await runQuery("SELECT 1", { accountId: "a", apiToken: "t" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("query_failed");
  });
});
