import { afterEach, describe, expect, it, vi } from "vitest";
import { UNRECORDED_REASON, foldApiErrors, loadOwnerDashboard, statusMeaning } from "./owner-dashboard";
import {
  API_ERROR_CONDITION,
  apiErrorsSql,
  apiRoutesSql,
  type ApiErrorQueryRow,
} from "./telemetry-query";
import { eventColumn } from "./telemetry-schema";

/**
 * Issue #160. /owner said /api/anime/context failed 295 times in 90 days and
 * nothing about why, although the status was on every row. These pin the
 * breakdown, and the one predicate it shares with the column it explains.
 */

describe("API errors query", () => {
  it("reads every column from its schema position", () => {
    const sql = apiErrorsSql(24);
    expect(sql).toContain(`${eventColumn("kind")} = 'api'`);
    expect(sql).toContain(`${eventColumn("name")} AS route`);
    expect(sql).toContain(`${eventColumn("status")} AS status`);
    expect(sql).toContain(`${eventColumn("authKind")} AS authKind`);
    expect(sql).toContain(`${eventColumn("errorCode")} AS errorCode`);
    expect(sql).toContain(`COUNT(DISTINCT ${eventColumn("userId")})`);
    expect(sql).toContain("GROUP BY route, status, authKind, errorCode");
  });

  it("counts only failures, with the API routes panel's own predicate", () => {
    expect(API_ERROR_CONDITION).toBe(`${eventColumn("status")} >= '400'`);
    expect(apiErrorsSql(24)).toContain(`AND ${API_ERROR_CONDITION}`);
    // The breakdown must sum to the 4xx/5xx cell it explains.
    expect(apiRoutesSql(24)).toContain(`SUM(if(${API_ERROR_CONDITION}, 1, 0) * _sample_interval) AS errors`);
  });

  it("weights counts, and reports the anonymous bucket so it can be discounted", () => {
    const sql = apiErrorsSql(24);
    expect(sql).toContain("SUM(_sample_interval) AS events");
    expect(sql).toMatch(/SUM\(IF\(blob3 = 'anon' OR blob3 = '', _sample_interval, 0\)\) AS anonEvents/);
    // AE rejects a mixed-type IF outright, which would fail the whole panel.
    expect(sql).not.toContain("NULL");
  });

  it("says when each failure started and stopped", () => {
    const sql = apiErrorsSql(24);
    expect(sql).toContain("MIN(timestamp) AS firstSeen");
    expect(sql).toContain("MAX(timestamp) AS lastSeen");
  });

  it("clamps the window and bounds the row count", () => {
    expect(apiErrorsSql(-5)).toContain("INTERVAL '24' HOUR");
    expect(apiErrorsSql(24 * 365)).toContain("INTERVAL '2160' HOUR");
    expect(apiErrorsSql(24, undefined, 1e6)).toContain("LIMIT 200");
    expect(apiErrorsSql(24, undefined, -3)).toContain("LIMIT 1");
  });
});

describe("API panels on the drill-down view", () => {
  it("both filter to the focus user, escaped", () => {
    for (const sql of [apiRoutesSql(24, "user_'; DROP"), apiErrorsSql(24, "user_'; DROP")]) {
      expect(sql).toContain(`${eventColumn("userId")} = 'user_\\'; DROP'`);
    }
  });

  it("neither filters without one", () => {
    // The anon-bucket count also names userId, so look for the WHERE filter.
    const userFilter = new RegExp(`AND\\s+${eventColumn("userId")} = '`);
    for (const sql of [apiRoutesSql(24), apiErrorsSql(24)]) expect(sql).not.toMatch(userFilter);
    expect(apiErrorsSql(24, "u_1")).toMatch(userFilter);
  });
});

describe("foldApiErrors", () => {
  const row = (over: Partial<ApiErrorQueryRow>): ApiErrorQueryRow => ({
    route: "/api/anime/context",
    status: "401",
    authKind: "sync_token",
    errorCode: "",
    events: 0,
    users: 0,
    anonEvents: 0,
    firstSeen: "2026-08-07 10:00:00",
    lastSeen: "2026-09-22 18:00:00",
    ...over,
  });

  it("names the reason on rows from before it was recorded", () => {
    const [folded] = foldApiErrors([row({ events: 250, users: 1, anonEvents: 250 })]);
    expect(folded).toEqual({
      route: "/api/anime/context",
      status: "401",
      meaning: "unauthorized",
      authKind: "sync_token",
      reason: UNRECORDED_REASON,
      calls: 250,
      // A dead link's 401 has no user: all anonymous is zero learners, not one.
      users: 0,
      anonCalls: 250,
      firstSeen: "2026-08-07 10:00:00",
      lastSeen: "2026-09-22 18:00:00",
    });
  });

  it("keeps a recorded reason and counts identified learners", () => {
    const [folded] = foldApiErrors([
      row({ route: "/api/ai/pick-word", status: "429", errorCode: "auto_quota_exhausted", events: 12, users: 2 }),
    ]);
    expect(folded!.reason).toBe("auto_quota_exhausted");
    expect(folded!.meaning).toBe("quota or rate limit");
    expect(folded!.users).toBe(2);
  });

  it("survives AE returning aggregates as strings", () => {
    const [folded] = foldApiErrors([
      row({ events: "7", users: "3", anonEvents: "2" } as unknown as Partial<ApiErrorQueryRow>),
    ]);
    expect(folded!.calls).toBe(7);
    expect(folded!.users).toBe(2);
    expect(folded!.anonCalls).toBe(2);
  });
});

describe("statusMeaning", () => {
  it("reads the statuses these routes actually send", () => {
    expect(statusMeaning("400")).toBe("bad request");
    expect(statusMeaning("401")).toBe("unauthorized");
    expect(statusMeaning("429")).toBe("quota or rate limit");
    expect(statusMeaning("502")).toBe("upstream failed");
    expect(statusMeaning("503")).toBe("not configured");
  });

  it("falls back by class, and never reads an object key as a meaning", () => {
    expect(statusMeaning("418")).toBe("client error");
    expect(statusMeaning("504")).toBe("server error");
    expect(statusMeaning("constructor")).toBe("unknown");
    expect(statusMeaning("")).toBe("unknown");
  });
});

describe("loadOwnerDashboard with the API errors query", () => {
  afterEach(() => {
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_ANALYTICS_API_TOKEN;
    vi.unstubAllGlobals();
  });

  const errorsLabel = `${eventColumn("authKind")} AS authKind`;
  const routesLabel = `${eventColumn("name")} AS label`;

  const serve = (errors: "rows" | "fail") => {
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_ANALYTICS_API_TOKEN = "tok";
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const sql = String(init.body);
        seen.push(sql);
        if (sql.includes(errorsLabel)) {
          if (errors === "fail") return new Response("bad query", { status: 400 });
          return Response.json({
            data: [
              {
                route: "/api/anime/context",
                status: "401",
                authKind: "sync_token",
                errorCode: "",
                events: "250",
                users: "1",
                anonEvents: "250",
                firstSeen: "2026-08-07 10:00:00",
                lastSeen: "2026-09-22 18:00:00",
              },
            ],
          });
        }
        if (sql.includes(routesLabel) && sql.includes(`${eventColumn("kind")} = 'api'`)) {
          return Response.json({
            data: [{ label: "/api/anime/context", events: "4338", latencySum: "0", errors: "295" }],
          });
        }
        return Response.json({ data: [] });
      })
    );
    return seen;
  };

  it("folds the error rows into apiErrors", async () => {
    serve("rows");
    const data = await loadOwnerDashboard(24 * 90);
    expect(data.apiErrors.map((r) => [r.route, r.status, r.authKind, r.reason, r.calls, r.users])).toEqual([
      ["/api/anime/context", "401", "sync_token", UNRECORDED_REASON, 250, 0],
    ]);
    expect(data.apiRoutes.map((r) => [r.label, r.errors])).toEqual([["/api/anime/context", 295]]);
  });

  it("a failing errors query leaves API routes intact", async () => {
    serve("fail");
    const data = await loadOwnerDashboard(24);
    expect(data.apiErrors).toEqual([]);
    expect(data.apiRoutes.map((r) => r.label)).toEqual(["/api/anime/context"]);
    expect(data.queryError).toContain("api errors");
  });

  it("hands the focus user to both API queries", async () => {
    const seen = serve("rows");
    await loadOwnerDashboard(24, "user_42");
    const api = seen.filter((sql) => sql.includes(`${eventColumn("kind")} = 'api'`));
    expect(api).toHaveLength(2);
    for (const sql of api) expect(sql).toContain(`${eventColumn("userId")} = 'user_42'`);
  });
});
