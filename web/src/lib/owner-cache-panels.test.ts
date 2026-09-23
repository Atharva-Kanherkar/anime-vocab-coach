import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UNSTAMPED_BUILD,
  foldCacheOutcome,
  foldExtensionBuilds,
  foldFeatureEvents,
  loadOwnerDashboard,
} from "./owner-dashboard";
import {
  animeContextCacheSql,
  featureBuildsSql,
  featureEventsSql,
  type FeatureEventRow,
} from "./telemetry-query";
import { EVENT_BLOBS, eventColumn } from "./telemetry-schema";
import { ANIME_CONTEXT_EVENT } from "./anime-context";
import {
  EXTENSION_LEARNING_LOOP_EVENTS,
  LEARNING_LOOP_EVENTS,
  SERVER_LEARNING_LOOP_EVENTS,
} from "./track-events";

/**
 * Issue #113: /owner carried one cache number under a label that named a
 * different cache. The failure mode both here and in the SQL is silent — a
 * mislabelled panel renders perfectly, and a column addressed by the wrong
 * blob index returns real-looking values for the wrong field.
 */

describe("anime-context cache query", () => {
  it("reads the columns the writer actually writes to", () => {
    const sql = animeContextCacheSql(24);
    expect(sql).toContain(`${eventColumn("kind")} = 'feature'`);
    expect(sql).toContain(`${eventColumn("name")} = '${ANIME_CONTEXT_EVENT}'`);
    expect(sql).toContain(`${eventColumn("status")} = 'hit'`);
    expect(sql).toContain(`${eventColumn("status")} = 'miss'`);
  });

  it("weights both counts, so sampling cannot skew the rate", () => {
    const sql = animeContextCacheSql(24);
    expect(sql).toContain("_sample_interval");
    // AE rejects a mixed-type IF outright, which would fail the whole panel.
    expect(sql).not.toContain("NULL");
  });

  it("clamps the window like every other panel", () => {
    expect(animeContextCacheSql(-5)).toContain("INTERVAL '24' HOUR");
    expect(animeContextCacheSql(24 * 365)).toContain("INTERVAL '2160' HOUR");
  });

  it("escapes the event name rather than interpolating it raw", () => {
    expect(animeContextCacheSql(24, undefined, "it's")).toContain("'it\\'s'");
  });

  it("filters to one learner for the drill-down view", () => {
    expect(animeContextCacheSql(24, "user_42")).toContain(`${eventColumn("userId")} = 'user_42'`);
    expect(animeContextCacheSql(24)).not.toContain(eventColumn("userId"));
  });
});

describe("learning-loop query", () => {
  it("groups feature rows by name with a per-event learner count", () => {
    const sql = featureEventsSql(24);
    expect(sql).toContain(`${eventColumn("kind")} = 'feature'`);
    expect(sql).toContain(`${eventColumn("name")} AS label`);
    expect(sql).toContain(`COUNT(DISTINCT ${eventColumn("userId")})`);
  });

  /**
   * `feature` also carries acquisition events and the anime-context cache
   * probe. A learning-loop panel that counted a marketing click alongside a
   * card review would answer a different question than its heading asks.
   */
  it("counts only the learning loop, not every feature row", () => {
    const sql = featureEventsSql(24);
    for (const name of LEARNING_LOOP_EVENTS) expect(sql).toContain(`'${name}'`);
    for (const name of ["landing_view", "store_cta_click", "anime_context", "coach_open"]) {
      expect(sql).not.toContain(`'${name}'`);
    }
  });

  it("filters to one learner for the drill-down view", () => {
    expect(featureEventsSql(24, "user_42")).toContain(`${eventColumn("userId")} = 'user_42'`);
    expect(featureEventsSql(24)).not.toContain("= 'user_42'");
  });

  it("escapes a focus user rather than interpolating it raw", () => {
    expect(featureEventsSql(24, "user_'; DROP")).toContain("'user_\\'; DROP'");
  });

  it("addresses userId by its schema position, not a hardcoded blob", () => {
    expect(eventColumn("userId")).toBe(`blob${EVENT_BLOBS.indexOf("userId") + 1}`);
  });
});

describe("foldCacheOutcome", () => {
  it("computes the rate over lookups, not over all traffic", () => {
    expect(foldCacheOutcome({ hits: 17, misses: 83 })).toEqual({
      present: true,
      hits: 17,
      misses: 83,
      hitRate: 0.17,
    });
  });

  it("separates 'never asked' from an honest 0%", () => {
    expect(foldCacheOutcome(undefined).present).toBe(false);
    expect(foldCacheOutcome({ hits: 0, misses: 4 })).toEqual({
      present: true,
      hits: 0,
      misses: 4,
      hitRate: 0,
    });
  });

  it("survives AE returning aggregates as strings", () => {
    expect(
      foldCacheOutcome({ hits: "3", misses: "1" } as unknown as { hits: number; misses: number })
        .hitRate
    ).toBe(0.75);
  });
});

describe("foldFeatureEvents", () => {
  const row = (over: Partial<FeatureEventRow>): FeatureEventRow => ({
    label: "card_shown",
    events: 0,
    users: 0,
    anonEvents: 0,
    ...over,
  });

  it("discounts the shared anonymous bucket from the learner count", () => {
    const [folded] = foldFeatureEvents([row({ events: 400, users: 5, anonEvents: 120 })]);
    expect(folded).toEqual({
      label: "card_shown",
      events: 400,
      users: 4,
      anonEvents: 120,
      identifiedEvents: 280,
    });
  });

  /**
   * "Per learner" divides this, not `events`. Charging anonymous activity to
   * the learners who happen to be linked reports `install_first_run` — which
   * is anonymous by definition — as dozens of installs per learner.
   */
  it("keeps anonymous activity out of the per-learner numerator", () => {
    const [folded] = foldFeatureEvents([row({ events: 31, users: 1, anonEvents: 31 })]);
    expect(folded!.identifiedEvents).toBe(0);
    expect(folded!.users).toBe(0);
  });

  it("leaves the count alone when every row was identified", () => {
    const [folded] = foldFeatureEvents([row({ events: 40, users: 6, anonEvents: 0 })]);
    expect(folded!.users).toBe(6);
  });

  it("never reports a negative learner count or a negative numerator", () => {
    const [folded] = foldFeatureEvents([row({ events: 9, users: 0, anonEvents: 12 })]);
    expect(folded!.users).toBe(0);
    expect(folded!.identifiedEvents).toBe(0);
  });

  it("drops an unnamed row rather than rendering a blank label", () => {
    expect(foldFeatureEvents([row({ label: "" })])).toEqual([]);
  });
});

/**
 * #159: the Learning loop panel read near-zero for two months because the
 * Web Store package predated the events, and nothing on /owner could say so.
 */
describe("extension builds panel", () => {
  const row = (over: Partial<FeatureEventRow>): FeatureEventRow => ({
    label: "0.5.7",
    events: 0,
    users: 0,
    anonEvents: 0,
    ...over,
  });

  it("groups the same learning-loop rows by clientVersion", () => {
    const sql = featureBuildsSql(24);
    expect(sql).toContain(`${eventColumn("clientVersion")} AS label`);
    expect(sql).toContain(`${eventColumn("kind")} = 'feature'`);
    for (const name of EXTENSION_LEARNING_LOOP_EVENTS) expect(sql).toContain(`'${name}'`);
    expect(sql).not.toContain("'landing_view'");
  });

  it("leaves out the sync route's rows, which never carry a version", () => {
    for (const name of SERVER_LEARNING_LOOP_EVENTS) {
      expect(featureBuildsSql(24)).not.toContain(`'${name}'`);
      expect(featureEventsSql(24)).toContain(`'${name}'`);
    }
  });

  it("honours the focus user like the Learning loop panel", () => {
    expect(featureBuildsSql(24, "user_42")).toContain(`${eventColumn("userId")} = 'user_42'`);
    expect(featureBuildsSql(24)).not.toContain("= 'user_42'");
  });

  it("names the unstamped bucket instead of dropping it — it is the finding", () => {
    const folded = foldExtensionBuilds([
      row({ label: "0.5.7", events: 40, users: 3, anonEvents: 10 }),
      row({ label: "", events: 12, users: 2, anonEvents: 12 }),
    ]);
    expect(folded.map((r) => r.label)).toEqual(["0.5.7", UNSTAMPED_BUILD]);
    expect(folded[0]!.users).toBe(2);
    expect(folded[1]!.users).toBe(1);
  });
});

describe("loadOwnerDashboard with the builds query", () => {
  afterEach(() => {
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CF_ANALYTICS_API_TOKEN;
    vi.unstubAllGlobals();
  });

  const serve = (builds: "rows" | "fail") => {
    process.env.CF_ACCOUNT_ID = "acct";
    process.env.CF_ANALYTICS_API_TOKEN = "tok";
    const buildsLabel = `${eventColumn("clientVersion")} AS label`;
    const loopLabel = `${eventColumn("name")} AS label`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const sql = String(init.body);
        if (sql.includes(buildsLabel)) {
          if (builds === "fail") return new Response("bad query", { status: 400 });
          return Response.json({
            data: [
              { label: "0.5.7", events: "5", users: "2", anonEvents: "0" },
              { label: "", events: "3", users: "1", anonEvents: "3" },
            ],
          });
        }
        if (sql.includes(loopLabel) && sql.includes("'word_saved'")) {
          return Response.json({
            data: [{ label: "word_saved", events: "5", users: "2", anonEvents: "0" }],
          });
        }
        return Response.json({ data: [] });
      })
    );
  };

  it("shows which builds the learning loop came from", async () => {
    serve("rows");
    const data = await loadOwnerDashboard(24);
    expect(data.extensionBuilds.map((r) => [r.label, r.events, r.users])).toEqual([
      ["0.5.7", 5, 2],
      [UNSTAMPED_BUILD, 3, 0],
    ]);
    expect(data.learningLoop.map((r) => r.label)).toEqual(["word_saved"]);
  });

  it("a failing builds query leaves the Learning loop panel intact", async () => {
    serve("fail");
    const data = await loadOwnerDashboard(24);
    expect(data.extensionBuilds).toEqual([]);
    expect(data.learningLoop.map((r) => r.label)).toEqual(["word_saved"]);
    expect(data.queryError).toContain("extension builds");
  });
});
