import { afterEach, describe, expect, it, vi } from "vitest";
import { loadOwnerDashboard } from "./owner-dashboard";
import {
  animeContextCacheSql,
  apiErrorsSql,
  apiRoutesSql,
  eventDistinctUsersSql,
  eventGroupSql,
  eventsByUserSql,
  featureBuildsSql,
  featureEventsSql,
  llmByUserSql,
  llmDistinctUsersSql,
  llmErrorsSql,
  llmFacetsSql,
  llmSeriesSql,
  proFunnelSql,
  sqlString,
  transcribeByUserSql,
  transcribeGroupSql,
  transcribeSeriesSql,
  transcribeTotalsSql,
  userClause,
  type UserScope,
} from "./telemetry-query";
import { eventColumn, llmColumn, transcribeColumn } from "./telemetry-schema";

/**
 * Issue #163. The owner was 45% of all listening and every panel counted it.
 * These pin the scope every /owner query takes: one learner, everyone but us,
 * or everyone.
 */

const OWNER = "user_owner1";
const TESTER = "user_tester2";
const EXCLUDE: UserScope = { exclude: [OWNER, TESTER] };

describe("userClause", () => {
  it("is empty for everyone", () => {
    expect(userClause("blob3", undefined)).toBe("");
    expect(userClause("blob3", { exclude: [] })).toBe("");
  });

  it("filters to a focus user", () => {
    expect(userClause("blob3", "user_42")).toBe(" AND blob3 = 'user_42'");
  });

  it("leaves each excluded id out, escaped, once", () => {
    expect(userClause("blob3", { exclude: [OWNER, "user_'x", OWNER] })).toBe(
      ` AND blob3 != '${OWNER}' AND blob3 != ${sqlString("user_'x")}`
    );
  });

  it("lets a focus win over excludes, so the owner can inspect themselves", () => {
    expect(userClause("blob3", { focus: OWNER, exclude: [OWNER] })).toBe(` AND blob3 = '${OWNER}'`);
  });
});

describe("every scoped query leaves excluded accounts out", () => {
  const llm = llmColumn("userId");
  const ev = eventColumn("userId");
  const tx = transcribeColumn("userId");
  const cases: [string, string, string][] = [
    ["llmFacetsSql", llmFacetsSql(24, EXCLUDE), llm],
    ["llmSeriesSql", llmSeriesSql(24, EXCLUDE), llm],
    ["llmErrorsSql", llmErrorsSql(24, 20, EXCLUDE), llm],
    ["llmByUserSql", llmByUserSql(24, 50, EXCLUDE), llm],
    ["llmDistinctUsersSql", llmDistinctUsersSql(24, EXCLUDE), llm],
    ["eventGroupSql", eventGroupSql("name", 24, "pageview", 25, EXCLUDE), ev],
    ["eventsByUserSql", eventsByUserSql(24, 50, EXCLUDE), ev],
    ["eventDistinctUsersSql", eventDistinctUsersSql(24, EXCLUDE), ev],
    ["apiRoutesSql", apiRoutesSql(24, EXCLUDE), ev],
    ["apiErrorsSql", apiErrorsSql(24, EXCLUDE), ev],
    ["featureEventsSql", featureEventsSql(24, EXCLUDE), ev],
    ["featureBuildsSql", featureBuildsSql(24, EXCLUDE), ev],
    ["animeContextCacheSql", animeContextCacheSql(24, EXCLUDE), ev],
    ["proFunnelSql", proFunnelSql(24, EXCLUDE), ev],
    ["transcribeTotalsSql", transcribeTotalsSql(24, EXCLUDE), tx],
    ["transcribeGroupSql", transcribeGroupSql("plan", 24, 8, EXCLUDE), tx],
    ["transcribeSeriesSql", transcribeSeriesSql(24, EXCLUDE), tx],
    ["transcribeByUserSql", transcribeByUserSql(24, 25, EXCLUDE), tx],
  ];

  for (const [name, sql, col] of cases) {
    it(`${name} excludes on ${col}`, () => {
      expect(sql).toContain(`${col} != '${OWNER}'`);
      expect(sql).toContain(`${col} != '${TESTER}'`);
      // The clause lands inside WHERE, before any grouping.
      const where = sql.indexOf("WHERE");
      expect(where).toBeGreaterThan(-1);
      expect(sql.indexOf(`${col} != '${OWNER}'`)).toBeGreaterThan(where);
      const group = sql.indexOf("GROUP BY");
      if (group > -1) expect(sql.indexOf(`${col} != '${OWNER}'`)).toBeLessThan(group);
    });
  }
});

describe("loadOwnerDashboard with an exclude list", () => {
  afterEach(() => {
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_ANALYTICS_API_TOKEN;
    vi.unstubAllGlobals();
  });

  const serve = () => {
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_ANALYTICS_API_TOKEN = "tok";
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        seen.push(String(init.body));
        return Response.json({ data: [] });
      })
    );
    return seen;
  };

  it("puts the exclusion on every query but the extension funnel, which has no user", async () => {
    const seen = serve();
    await loadOwnerDashboard(24, { exclude: [OWNER] });
    const funnel = seen.filter((s) => s.includes("FROM extension_funnel"));
    const rest = seen.filter((s) => !s.includes("FROM extension_funnel"));
    expect(funnel).toHaveLength(1);
    expect(funnel[0]).not.toContain(OWNER);
    expect(rest.length).toBeGreaterThan(20);
    for (const sql of rest) expect(sql).toContain(`!= '${OWNER}'`);
  });

  it("excludes nobody when asked for everyone", async () => {
    const seen = serve();
    await loadOwnerDashboard(24, { exclude: [] });
    for (const sql of seen) expect(sql).not.toContain("!= 'user_");
  });

  it("scopes every user-bearing query to the focus user on the drill-down", async () => {
    const seen = serve();
    await loadOwnerDashboard(24, "user_42");
    for (const sql of seen.filter((s) => !s.includes("FROM extension_funnel"))) {
      expect(sql).toContain("= 'user_42'");
    }
  });
});
