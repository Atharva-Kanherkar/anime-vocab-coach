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
  externalReferrerHost,
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
  apiErrorsSql,
  proFunnelSql,
  apiRoutesSql,
  eventGroupSql,
  eventsByUserSql,
  extensionFunnelSql,
  featureBuildsSql,
  featureEventsSql,
  llmByUserSql,
  llmErrorsSql,
  llmFacetsSql,
  llmSeriesSql,
  mapLimit,
  type LlmFacetRow,
  llmGroupSql,
  llmTotalsSql,
  sqlHours,
  sqlString,
  runQuery,
} from "./telemetry-query";
import { isTrackableEvent, normalizeClientVersion, normalizeTrackPath } from "./track-events";
import {
  attributionFromSearch,
  isPublicLandingPath,
  normalizeUtm,
  ownedCampaignForPath,
} from "./funnel-attribution";
import { withApiTelemetry } from "./api-telemetry";
import { foldFacets, loadOwnerDashboard, summarizeFailures } from "./owner-dashboard";

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

  /**
   * Historical rows keep their positions forever, so a new field may only be
   * appended. Pinning the old thirteen is what stops a tidy-up reorder from
   * silently re-labelling two months of data.
   */
  it("appends clientVersion without moving any existing column (#159)", () => {
    expect(EVENT_BLOBS.slice(0, 13)).toEqual([
      "kind",
      "name",
      "userId",
      "plan",
      "country",
      "city",
      "referrerHost",
      "device",
      "authKind",
      "status",
      "utmSource",
      "utmMedium",
      "utmCampaign",
    ]);
    expect(eventColumn("clientVersion")).toBe("blob14");
  });

  it("appends errorCode after clientVersion, moving nothing (#160)", () => {
    expect(EVENT_BLOBS.slice(0, 14)).toEqual([
      "kind",
      "name",
      "userId",
      "plan",
      "country",
      "city",
      "referrerHost",
      "device",
      "authKind",
      "status",
      "utmSource",
      "utmMedium",
      "utmCampaign",
      "clientVersion",
    ]);
    expect(eventColumn("errorCode")).toBe("blob15");
  });

  it("appends surface after errorCode, moving nothing (#162)", () => {
    expect(EVENT_BLOBS.slice(0, 15)).toEqual([
      "kind",
      "name",
      "userId",
      "plan",
      "country",
      "city",
      "referrerHost",
      "device",
      "authKind",
      "status",
      "utmSource",
      "utmMedium",
      "utmCampaign",
      "clientVersion",
      "errorCode",
    ]);
    expect(eventColumn("surface")).toBe("blob16");
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
    expect(blobOf(w, "clientVersion", EVENT_BLOBS)).toBe("");
    expect(blobOf(w, "errorCode", EVENT_BLOBS)).toBe("");
    expect(blobOf(w, "surface", EVENT_BLOBS)).toBe("");
  });

  it("writes the surface on a Pro funnel row (#162)", async () => {
    const { ae, writes } = sink();
    setTelemetrySinksForTests(null, ae);
    await recordUserEvent({ kind: "feature", name: "pro_prompt_shown", surface: "app_unlock" });
    expect(blobOf(writes[0]!, "surface", EVENT_BLOBS)).toBe("app_unlock");
    expect(writes[0]!.blobs).toHaveLength(EVENT_BLOBS.length);
  });

  it("writes the reason on a failed api row (#160)", async () => {
    const { ae, writes } = sink();
    setTelemetrySinksForTests(null, ae);
    await recordUserEvent({ kind: "api", name: "/api/anime/context", status: 401, errorCode: "token_unknown" });
    expect(blobOf(writes[0]!, "status", EVENT_BLOBS)).toBe("401");
    expect(blobOf(writes[0]!, "errorCode", EVENT_BLOBS)).toBe("token_unknown");
    expect(writes[0]!.blobs).toHaveLength(EVENT_BLOBS.length);
  });

  it("writes the extension build version on a feature row", async () => {
    const { ae, writes } = sink();
    setTelemetrySinksForTests(null, ae);
    await recordUserEvent({ kind: "feature", name: "word_saved", userId: "user_9", clientVersion: "0.5.7" });
    expect(blobOf(writes[0]!, "clientVersion", EVENT_BLOBS)).toBe("0.5.7");
    expect(blobOf(writes[0]!, "userId", EVENT_BLOBS)).toBe("user_9");
  });
});

describe("normalizeClientVersion", () => {
  it("keeps a manifest-shaped version", () => {
    for (const v of ["0.5.7", "1", "1.2.3.4", "10.0.12"]) expect(normalizeClientVersion(v)).toBe(v);
  });

  it("collapses anything else to empty, since it becomes a GROUP BY label", () => {
    for (const v of [
      "",
      "1.0.0-beta",
      "1..2",
      "1.2.3.4.5",
      "123456.1",
      " 0.5.7",
      "<script>",
      "'; DROP TABLE avc_events; --",
      42,
      null,
      undefined,
      {},
    ]) {
      expect(normalizeClientVersion(v)).toBe("");
    }
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

  it("accepts only the site funnel vocabulary", () => {
    for (const event of [
      "landing_view",
      "store_cta_click",
      "mobile_capture_shown",
      "mobile_capture_submitted",
    ]) {
      expect(isTrackableEvent(event)).toBe(true);
    }
    expect(isTrackableEvent("landing_view_with_email")).toBe(false);
  });

  it("normalizes bounded campaign attribution without arbitrary query data", () => {
    expect(attributionFromSearch("?utm_source=Instagram&utm_medium=reel&utm_campaign=Format_One&email=x@y.test"))
      .toEqual({ utmSource: "instagram", utmMedium: "reel", utmCampaign: "format_one" });
    expect(normalizeUtm("spaces are not allowed")).toBe("");
    expect(normalizeUtm("x".repeat(120))).toHaveLength(80);
  });

  it("classifies public landings and creates stable owned-link campaigns", () => {
    expect(isPublicLandingPath("/learn-japanese-with-anime")).toBe(true);
    expect(isPublicLandingPath("/app/cards")).toBe(false);
    expect(isPublicLandingPath("/api/track")).toBe(false);
    expect(ownedCampaignForPath("/")).toBe("homepage");
    expect(ownedCampaignForPath("/ja/learn-japanese")).toBe("learn-japanese");
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

  it("classifies 403 as an auth problem, not a generic failure", async () => {
    // The distinction drives the UI: a rejected token needs different
    // instructions from a dataset that does not exist yet.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
        text: async () => "forbidden",
      } as unknown as Response)
    );
    const out = await runQuery("SELECT 1", { accountId: "a", apiToken: "t" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("unauthorized");
  });

  it("still reports an unknown dataset as query_failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () => "table avc_llm not found",
      } as unknown as Response)
    );
    const out = await runQuery("SELECT 1", { accountId: "a", apiToken: "t" });
    if (!out.ok) {
      expect(out.reason).toBe("query_failed");
      expect(out.detail).toContain("not found");
    }
  });
});

describe("running in production with no analytics read token", () => {
  // The token only enables the dashboard's READS. Merging without it must
  // leave the site completely unaffected, and /owner must explain itself
  // rather than error.

  it("dashboard reports not-configured instead of throwing", async () => {
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_ANALYTICS_API_TOKEN;
    const data = await loadOwnerDashboard(24);
    expect(data.configured).toBe(false);
    expect(data.queryError).toBeNull();
    expect(data.totals.calls).toBe(0);
    expect(data.byModel).toEqual([]);
  });

  it("makes no network call when unconfigured", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await loadOwnerDashboard(24);
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("wrapped route still returns the handler's response", async () => {
    const wrapped = withApiTelemetry("/api/x", async () => new Response("ok", { status: 200 }));
    const res = await wrapped(new Request("https://animevocab.com/api/x", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("a throw while gathering facts cannot swallow the response", async () => {
    // Simulate the finally block's inputs blowing up.
    const hostile = new Request("https://animevocab.com/api/x", { method: "POST" });
    Object.defineProperty(hostile, "headers", {
      get() { throw new Error("boom"); },
    });
    const wrapped = withApiTelemetry("/api/x", async () => new Response("ok", { status: 201 }));
    const res = await wrapped(hostile);
    expect(res.status).toBe(201);
  });

  it("still rethrows a handler error unchanged", async () => {
    const wrapped = withApiTelemetry("/api/x", async () => {
      throw new Error("handler_exploded");
    });
    await expect(
      wrapped(new Request("https://animevocab.com/api/x", { method: "POST" }))
    ).rejects.toThrow("handler_exploded");
  });
});

describe("SQL API throttling and failure classification", () => {
  it("caps concurrency so the dashboard cannot self-DoS the SQL API", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 11 }, (_, i) => i);
    const out = await mapLimit(items, 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return n * 2;
    });
    expect(peak).toBeLessThanOrEqual(2);
    // Order must survive the pool, since callers index results positionally.
    expect(out).toEqual(items.map((n) => n * 2));
  });

  it("retries a 429 and succeeds", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        calls++;
        if (calls === 1) {
          return { ok: false, status: 429, headers: new Headers(), text: async () => "limited" } as unknown as Response;
        }
        return { ok: true, status: 200, headers: new Headers(), json: async () => ({ data: [{ x: 1 }] }) } as unknown as Response;
      })
    );
    const out = await runQuery<{ x: number }>("SELECT 1", { accountId: "a", apiToken: "t" });
    expect(out.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("does NOT retry a 401 — the token is wrong, retrying burns quota", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => '{"errors":[{"code":10000}]}',
    } as unknown as Response);
    vi.stubGlobal("fetch", f);
    const out = await runQuery("SELECT 1", { accountId: "a", apiToken: "bad" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("unauthorized");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("reports rate_limited only after exhausting retries", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers(),
      text: async () => "limited",
    } as unknown as Response);
    vi.stubGlobal("fetch", f);
    const out = await runQuery("SELECT 1", { accountId: "a", apiToken: "t" });
    if (!out.ok) expect(out.reason).toBe("rate_limited");
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("groups identical failures instead of repeating them per panel", () => {
    const summary = summarizeFailures([
      { label: "totals", reason: "unauthorized" },
      { label: "by model", reason: "unauthorized" },
      { label: "series", reason: "rate_limited" },
    ]);
    expect(summary).toContain("unauthorized (2: totals, by model)");
    expect(summary).toContain("rate_limited (1: series)");
    expect(summarizeFailures([])).toBeNull();
  });
});

describe("faceted LLM rollup", () => {
  const row = (over: Partial<LlmFacetRow>): LlmFacetRow => ({
    model: "gpt-5.6-luna",
    operation: "explain",
    surface: "web",
    effort: "max",
    status: "ok",
    calls: 0,
    cost: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
    latencySum: 0,
    ...over,
  });

  it("folds one query into totals and four breakdowns", () => {
    const f = foldFacets([
      row({ calls: 10, cost: 0.02, outputTokens: 1000, reasoningTokens: 800, latencySum: 20000 }),
      row({ operation: "hooks", calls: 5, cost: 0.01, outputTokens: 500, latencySum: 10000 }),
      row({ surface: "extension", model: "gpt-4.1-nano", calls: 2, cost: 0.001, latencySum: 400 }),
    ]);
    expect(f.totals.calls).toBe(17);
    expect(f.totals.cost).toBeCloseTo(0.031, 6);
    expect(f.byOperation.map((r) => r.label).sort()).toEqual(["explain", "hooks"]);
    expect(f.byModel.find((r) => r.label === "gpt-4.1-nano")?.calls).toBe(2);
    expect(f.bySurface.find((r) => r.label === "extension")?.calls).toBe(2);
    expect(f.byEffort[0]!.label).toBe("max");
  });

  it("excludes cached hits from average latency", () => {
    const f = foldFacets([
      row({ status: "ok", calls: 1, latencySum: 4000 }),
      row({ status: "cached", calls: 9, latencySum: 0 }),
    ]);
    // 4000ms over the single provider call, not spread across all ten.
    expect(f.totals.avgLatencyMs).toBe(4000);
    expect(f.totals.cacheHitRate).toBeCloseTo(0.9, 6);
  });

  it("derives error rate from status rows", () => {
    const f = foldFacets([
      row({ status: "ok", calls: 8 }),
      row({ status: "error", calls: 2 }),
    ]);
    expect(f.totals.errors).toBe(2);
    expect(f.totals.errorRate).toBeCloseTo(0.2, 6);
  });

  it("flags a model with no known rate", () => {
    const f = foldFacets([row({ model: "gpt-9-unknown", calls: 1 })]);
    expect(f.byModel[0]!.unpricedModel).toBe(true);
  });
});

describe("generated SQL matches the Analytics Engine dialect", () => {
  // Every query the dashboard can issue. Anything added must be listed here.
  const allQueries = (): { label: string; sql: string }[] => [
    { label: "facets", sql: llmFacetsSql(24) },
    { label: "facets/user", sql: llmFacetsSql(24, "u_1") },
    { label: "series", sql: llmSeriesSql(24) },
    { label: "series/long", sql: llmSeriesSql(24 * 30) },
    { label: "errors", sql: llmErrorsSql(24) },
    { label: "byUser", sql: llmByUserSql(24) },
    { label: "group", sql: llmGroupSql("model", 24) },
    { label: "events", sql: eventGroupSql("name", 24, "pageview") },
    { label: "apiRoutes", sql: apiRoutesSql(24) },
    { label: "apiRoutes/user", sql: apiRoutesSql(24, "u_1") },
    { label: "apiErrors", sql: apiErrorsSql(24) },
    { label: "apiErrors/user", sql: apiErrorsSql(24, "u_1") },
    { label: "proFunnel", sql: proFunnelSql(24) },
    { label: "proFunnel/user", sql: proFunnelSql(24, "u_1") },
    { label: "eventUsers", sql: eventsByUserSql(24) },
    { label: "funnel", sql: extensionFunnelSql(24) },
    { label: "learningLoop", sql: featureEventsSql(24) },
    { label: "extensionBuilds", sql: featureBuildsSql(24, "u_1") },
  ];

  it("never calls min/max on a blob (String) column", () => {
    // AE rejects this outright: "cannot use the String type as argument 1 in
    // max". argMax(blobN, timestamp) is the supported way to carry a string
    // through a GROUP BY.
    for (const { label, sql } of allQueries()) {
      expect(sql, `${label} must not min/max a blob`).not.toMatch(/\b(?:max|min)\s*\(\s*blob\d+/i);
    }
  });

  it("uses argMax against timestamp when carrying a string through a group", () => {
    expect(llmByUserSql(24)).toMatch(/argMax\(blob\d+, timestamp\) AS plan/);
    const ev = eventsByUserSql(24);
    expect(ev).toMatch(/argMax\(blob\d+, timestamp\) AS plan/);
    expect(ev).toMatch(/argMax\(blob\d+, timestamp\) AS country/);
    expect(ev).toMatch(/argMax\(blob\d+, timestamp\) AS device/);
  });

  it("only uses aggregate functions AE actually supports", () => {
    const supported = new Set([
      "count", "sum", "avg", "min", "max", "quantileexactweighted",
      "argmax", "argmin", "first_value", "last_value", "topk",
      "topkweighted", "countif", "sumif", "avgif",
      // non-aggregate helpers used in SELECT/GROUP BY
      "if", "tostartofhour", "todate", "interval", "now",
      // `name IN (...)` is an operator, not a call, but reads like one to the
      // pattern below; the learning-loop queries have used it since #111.
      "in",
    ]);
    for (const { label, sql } of allQueries()) {
      for (const m of sql.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)) {
        expect(supported, `${label} uses unsupported function ${m[1]}()`).toContain(
          m[1]!.toLowerCase()
        );
      }
    }
  });

  it("still weights every aggregate by the sample interval", () => {
    for (const { label, sql } of allQueries()) {
      if (!/SUM\(/i.test(sql)) continue;
      expect(sql, `${label} must weight counts`).toContain("_sample_interval");
    }
  });
});

/**
 * Attribution regression pin.
 *
 * Every pageview in the first two weeks of telemetry recorded
 * `animevocab.com` as its own referrer (439 of 439), because the server read
 * the `Referer` header of the /api/track beacon, and that header is always the
 * page that fired the beacon. The product had no acquisition data at all and
 * nothing failed to make that visible. These tests pin the two halves of the
 * fix: our own hosts collapse to "", and a real external host survives.
 */
describe("externalReferrerHost", () => {
  it("drops our own domain, so self-referral reads as unknown not as a source", () => {
    expect(externalReferrerHost("https://animevocab.com/blog")).toBe("");
    expect(externalReferrerHost("https://www.animevocab.com/")).toBe("");
    expect(externalReferrerHost("http://localhost:3000/app")).toBe("");
  });

  it("drops our own subdomains, including preview deploys", () => {
    expect(externalReferrerHost("https://preview.animevocab.com/x")).toBe("");
  });

  it("keeps a real external host", () => {
    expect(externalReferrerHost("https://www.google.com/search?q=migaku+alternative")).toBe(
      "www.google.com"
    );
    expect(externalReferrerHost("https://old.reddit.com/r/LearnJapanese/")).toBe("old.reddit.com");
  });

  it("lower-cases the host so one source is not split across rows", () => {
    expect(externalReferrerHost("https://News.YCombinator.com/item?id=1")).toBe(
      "news.ycombinator.com"
    );
  });

  it("returns empty for a direct visit", () => {
    expect(externalReferrerHost("")).toBe("");
    expect(externalReferrerHost("   ")).toBe("");
  });

  it("rejects non-web schemes, which are not acquisition sources", () => {
    expect(externalReferrerHost("chrome-extension://abcdef/popup.html")).toBe("");
    expect(externalReferrerHost("data:text/html,<b>x</b>")).toBe("");
    expect(externalReferrerHost("file:///Users/x/index.html")).toBe("");
  });

  it("survives hostile input without throwing, since any client can post it", () => {
    for (const bad of [
      "not a url",
      "://",
      "https://",
      "'; DROP TABLE avc_events; --",
      "<script>alert(1)</script>",
    ]) {
      expect(() => externalReferrerHost(bad)).not.toThrow();
      expect(externalReferrerHost(bad)).toBe("");
    }
  });

  it("bounds the stored host so dashboard cardinality cannot be flooded", () => {
    const long = `https://${"a".repeat(500)}.com/`;
    expect(externalReferrerHost(long).length).toBeLessThanOrEqual(128);
  });
});
