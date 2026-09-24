import { afterEach, describe, expect, it, vi } from "vitest";
import { UNKNOWN_SURFACE, foldProFunnel, loadOwnerDashboard } from "./owner-dashboard";
import { proFunnelSql, sqlString, type ProFunnelQueryRow } from "./telemetry-query";
import { eventColumn } from "./telemetry-schema";

/**
 * Issue #162. Pro was invisible, and nothing could say which prompt anyone had
 * seen. These pin the per-surface funnel: shown → clicked → checkout.
 */

describe("Pro funnel query", () => {
  it("reads every column from its schema position", () => {
    const sql = proFunnelSql(24);
    expect(sql).toContain(`${eventColumn("kind")} = 'feature'`);
    expect(sql).toContain(`${eventColumn("surface")} AS surface`);
    expect(sql).toContain(`${eventColumn("name")} AS name`);
    expect(sql).toContain(`COUNT(DISTINCT ${eventColumn("userId")})`);
    expect(sql).toContain("GROUP BY surface, name");
  });

  it("reads only the three funnel events", () => {
    expect(proFunnelSql(24)).toContain(
      `${eventColumn("name")} IN ('pro_prompt_shown', 'pro_prompt_clicked', 'pro_checkout_started')`
    );
  });

  it("weights counts and reports the anonymous bucket, with no mixed-type IF", () => {
    const sql = proFunnelSql(24);
    expect(sql).toContain("SUM(_sample_interval) AS events");
    expect(sql).toMatch(/SUM\(IF\(blob3 = 'anon' OR blob3 = '', _sample_interval, 0\)\) AS anonEvents/);
    expect(sql).not.toContain("NULL");
  });

  it("clamps the window", () => {
    expect(proFunnelSql(-5)).toContain("INTERVAL '24' HOUR");
    expect(proFunnelSql(24 * 365)).toContain("INTERVAL '2160' HOUR");
  });

  it("filters to the focus user, escaped, and only then", () => {
    expect(proFunnelSql(24, "user_'; DROP")).toContain(
      `${eventColumn("userId")} = ${sqlString("user_'; DROP")}`
    );
    expect(sqlString("user_'; DROP")).not.toBe("'user_'; DROP'");
    expect(proFunnelSql(24)).not.toContain(`AND ${eventColumn("userId")} = `);
  });
});

const row = (surface: string, name: string, events: number | string, users = 1, anonEvents = 0): ProFunnelQueryRow => ({
  surface,
  name,
  events: events as number,
  users,
  anonEvents,
});

describe("foldProFunnel", () => {
  it("pivots steps into one row per surface with rates", () => {
    const [r] = foldProFunnel([
      row("ext_milestone", "pro_prompt_shown", 40, 12),
      row("ext_milestone", "pro_prompt_clicked", 10, 8),
      row("ext_milestone", "pro_checkout_started", 2, 2),
    ]);
    expect(r).toEqual({
      surface: "ext_milestone",
      shown: { events: 40, users: 12 },
      clicked: { events: 10, users: 8 },
      checkout: { events: 2, users: 2 },
      clickRate: 0.25,
      checkoutRate: 0.2,
    });
  });

  it("leaves a rate null, not 0, when nothing is under it", () => {
    const [r] = foldProFunnel([row("app_billing", "pro_checkout_started", 1)]);
    expect(r!.clickRate).toBeNull();
    expect(r!.checkoutRate).toBeNull();
    const [s] = foldProFunnel([row("app_header", "pro_prompt_shown", 5)]);
    expect(s!.clickRate).toBe(0);
    expect(s!.checkoutRate).toBeNull();
  });

  it("discounts the anonymous bucket and coerces AE's string numbers", () => {
    const [r] = foldProFunnel([row("home", "pro_prompt_shown", "30", 4, 20)]);
    expect(r!.shown).toEqual({ events: 30, users: 3 });
  });

  it("labels a row with no surface, and ignores names that are not steps", () => {
    const out = foldProFunnel([row("", "pro_prompt_shown", 3), row("pricing", "word_saved", 9)]);
    expect(out.map((r) => r.surface)).toEqual([UNKNOWN_SURFACE]);
  });

  it("sorts by views, then checkouts", () => {
    const out = foldProFunnel([
      row("pricing", "pro_prompt_shown", 5),
      row("app_header", "pro_prompt_shown", 50),
      row("ext_popup", "pro_prompt_shown", 5),
      row("ext_popup", "pro_checkout_started", 1),
    ]);
    expect(out.map((r) => r.surface)).toEqual(["app_header", "ext_popup", "pricing"]);
  });
});

describe("loadOwnerDashboard with the Pro funnel query", () => {
  afterEach(() => {
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_ANALYTICS_API_TOKEN;
    vi.unstubAllGlobals();
  });

  const funnelLabel = `${eventColumn("surface")} AS surface`;
  const loopLabel = "'card_shown'";

  const serve = (funnel: "rows" | "fail") => {
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_ANALYTICS_API_TOKEN = "tok";
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const sql = String(init.body);
        seen.push(sql);
        if (sql.includes(funnelLabel)) {
          if (funnel === "fail") return new Response("bad query", { status: 400 });
          return Response.json({
            data: [
              { surface: "app_unlock", name: "pro_prompt_shown", events: "6", users: "5", anonEvents: "0" },
              { surface: "app_unlock", name: "pro_prompt_clicked", events: "2", users: "2", anonEvents: "0" },
            ],
          });
        }
        if (sql.includes(loopLabel) && sql.includes("AS label")) {
          return Response.json({ data: [{ label: "card_shown", events: "10", users: "2", anonEvents: "0" }] });
        }
        return Response.json({ data: [] });
      })
    );
    return seen;
  };

  it("folds the rows into proFunnel", async () => {
    serve("rows");
    const data = await loadOwnerDashboard(24 * 90);
    expect(data.proFunnel.map((r) => [r.surface, r.shown.events, r.clicked.events, r.clickRate])).toEqual([
      ["app_unlock", 6, 2, 2 / 6],
    ]);
  });

  it("a failing funnel query leaves the other panels intact and is named", async () => {
    serve("fail");
    const data = await loadOwnerDashboard(24);
    expect(data.proFunnel).toEqual([]);
    expect(data.learningLoop.map((r) => r.label)).toEqual(["card_shown"]);
    expect(data.queryError).toContain("pro funnel");
  });

  it("hands the focus user to the funnel query", async () => {
    const seen = serve("rows");
    await loadOwnerDashboard(24, "user_42");
    const sql = seen.find((s) => s.includes(funnelLabel))!;
    expect(sql).toContain(`${eventColumn("userId")} = 'user_42'`);
  });
});
