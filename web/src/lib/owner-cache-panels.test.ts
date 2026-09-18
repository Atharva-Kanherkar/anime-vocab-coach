import { describe, expect, it } from "vitest";
import { foldCacheOutcome, foldFeatureEvents } from "./owner-dashboard";
import { animeContextCacheSql, featureEventsSql, type FeatureEventRow } from "./telemetry-query";
import { EVENT_BLOBS, eventColumn } from "./telemetry-schema";
import { ANIME_CONTEXT_EVENT } from "./anime-context";

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
    expect(animeContextCacheSql(24, "it's")).toContain("'it\\'s'");
  });
});

describe("learning-loop query", () => {
  it("groups feature rows by name with a per-event learner count", () => {
    const sql = featureEventsSql(24);
    expect(sql).toContain(`${eventColumn("kind")} = 'feature'`);
    expect(sql).toContain(`${eventColumn("name")} AS label`);
    expect(sql).toContain(`COUNT(DISTINCT ${eventColumn("userId")})`);
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
    expect(folded).toEqual({ label: "card_shown", events: 400, users: 4, anonEvents: 120 });
  });

  it("leaves the count alone when every row was identified", () => {
    const [folded] = foldFeatureEvents([row({ events: 40, users: 6, anonEvents: 0 })]);
    expect(folded!.users).toBe(6);
  });

  it("never reports a negative learner count", () => {
    const [folded] = foldFeatureEvents([row({ events: 9, users: 0, anonEvents: 9 })]);
    expect(folded!.users).toBe(0);
  });

  it("drops an unnamed row rather than rendering a blank label", () => {
    expect(foldFeatureEvents([row({ label: "" })])).toEqual([]);
  });
});
