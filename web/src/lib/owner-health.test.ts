import { afterEach, describe, expect, it, vi } from "vitest";
import { foldHealth, foldHealthUsers, healthMeaning, loadOwnerDashboard } from "./owner-dashboard";
import { extensionHealthSql, extensionHealthUsersSql, type HealthQueryRow } from "./telemetry-query";
import { eventColumn } from "./telemetry-schema";
import { HEALTH_EVENTS } from "./track-events";

/**
 * The Extension health panel on /owner. The failure behind it was found by
 * the owner, by accident, as a learner: these pin that the next one shows up
 * on the dashboard with its reason, its site, its build and who it hit.
 */

describe("extension health queries", () => {
  it("read health rows only, from their schema positions", () => {
    const sql = extensionHealthSql(24);
    expect(sql).toContain(`${eventColumn("kind")} = 'health'`);
    expect(sql).toContain(`${eventColumn("name")} AS name`);
    expect(sql).toContain(`${eventColumn("errorCode")} AS errorCode`);
    expect(sql).toContain(`${eventColumn("surface")} AS site`);
    expect(sql).toContain(`${eventColumn("clientVersion")} AS clientVersion`);
    expect(sql).toContain("GROUP BY name, errorCode, site, clientVersion");
    expect(sql).toContain("ORDER BY lastSeen DESC");
  });

  it("scope the learner list the same way, and leave the anonymous bucket out of it", () => {
    const sql = extensionHealthUsersSql(24, { exclude: ["user_owner"] });
    expect(sql).toContain(`${eventColumn("kind")} = 'health'`);
    expect(sql).toContain(`${eventColumn("userId")} != 'user_owner'`);
    expect(sql).toContain(`${eventColumn("userId")} != 'anon'`);
    expect(extensionHealthSql(24, "user_42")).toContain(`${eventColumn("userId")} = 'user_42'`);
  });
});

describe("foldHealth", () => {
  const row = (over: Partial<HealthQueryRow> = {}): HealthQueryRow => ({
    name: "subs_english_failed",
    errorCode: "network",
    site: "netflix",
    clientVersion: "0.7.2",
    events: "3" as unknown as number,
    users: "2" as unknown as number,
    anonEvents: "1" as unknown as number,
    firstSeen: "2026-11-13 02:50:00",
    lastSeen: "2026-11-13 03:00:00",
    ...over,
  });

  it("labels every event the extension can send", () => {
    for (const name of HEALTH_EVENTS) expect(healthMeaning(name)).not.toBe("");
  });

  it("counts learners without the anonymous bucket and keeps the build", () => {
    expect(foldHealth([row()])).toEqual([
      {
        name: "subs_english_failed",
        meaning: healthMeaning("subs_english_failed"),
        reason: "network",
        site: "netflix",
        build: "0.7.2",
        events: 3,
        users: 1,
        anonEvents: 1,
        firstSeen: "2026-11-13 02:50:00",
        lastSeen: "2026-11-13 03:00:00",
      },
    ]);
    expect(foldHealth([row({ errorCode: "", clientVersion: "" })])[0]).toMatchObject({ reason: "unknown", build: "" });
  });

  it("drops anonymous rows from the learner list", () => {
    expect(
      foldHealthUsers([
        { userId: "anon", events: 4, kinds: 1, lastSeen: "x" },
        { userId: "user_9", events: "2" as unknown as number, kinds: "2" as unknown as number, lastSeen: "y" },
      ])
    ).toEqual([{ userId: "user_9", events: 2, kinds: 2, lastSeen: "y" }]);
  });
});

describe("loadOwnerDashboard with the health queries", () => {
  afterEach(() => {
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_ANALYTICS_API_TOKEN;
    vi.unstubAllGlobals();
  });

  it("puts health rows and the learners behind them on the page, and a failure there breaks nothing else", async () => {
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_ANALYTICS_API_TOKEN = "tok";
    let failUsers = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const sql = String(init.body);
        if (sql.includes(`${eventColumn("kind")} = 'health'`) && sql.includes("AS kinds")) {
          if (failUsers) return new Response("bad query", { status: 400 });
          return Response.json({ data: [{ userId: "user_9", events: "2", kinds: "1", lastSeen: "2026-11-13 03:00:00" }] });
        }
        if (sql.includes(`${eventColumn("kind")} = 'health'`)) {
          return Response.json({
            data: [
              {
                name: "course_load_failed",
                errorCode: "course_502",
                site: "worker",
                clientVersion: "0.7.2",
                events: "2",
                users: "1",
                anonEvents: "0",
                firstSeen: "2026-11-13 02:50:00",
                lastSeen: "2026-11-13 03:00:00",
              },
            ],
          });
        }
        return Response.json({ data: [] });
      })
    );
    const data = await loadOwnerDashboard(24);
    expect(data.health.map((r) => [r.name, r.reason, r.site, r.build, r.events, r.users])).toEqual([
      ["course_load_failed", "course_502", "worker", "0.7.2", 2, 1],
    ]);
    expect(data.healthUsers.map((u) => u.userId)).toEqual(["user_9"]);

    failUsers = true;
    const partial = await loadOwnerDashboard(24);
    expect(partial.health).toHaveLength(1);
    expect(partial.healthUsers).toEqual([]);
    expect(partial.queryError).toContain("extension health users");
  });
});
