import { describe, expect, it } from "vitest";
import { aiCallsForPlan, capMinutesForPlan, effectivePlanFromProfile, normalizePlan } from "./plan";

const NOW = Date.parse("2026-07-15T00:00:00.000Z");

describe("normalizePlan", () => {
  it("coerces unknown values to free", () => {
    expect(normalizePlan(undefined)).toBe("free");
    expect(normalizePlan("enterprise")).toBe("free");
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("max")).toBe("max");
  });
});

// Mirrors web/src/lib/plans.ts effectivePlan — if these semantics change on
// one side, change them on both.
describe("effectivePlanFromProfile", () => {
  it("downgrades an expired gift to free", () => {
    expect(
      effectivePlanFromProfile({ plan: "max", planExpiresAt: "2026-01-01T00:00:00.000Z" }, NOW)
    ).toBe("free");
  });

  it("treats the exact expiry instant as expired", () => {
    expect(
      effectivePlanFromProfile({ plan: "max", planExpiresAt: "2026-07-15T00:00:00.000Z" }, NOW)
    ).toBe("free");
  });

  it("keeps a gifted plan before expiry", () => {
    expect(
      effectivePlanFromProfile({ plan: "max", planExpiresAt: "2026-10-15T00:00:00.000Z" }, NOW)
    ).toBe("max");
  });

  it("keeps a paid plan with no expiry", () => {
    expect(effectivePlanFromProfile({ plan: "pro", planExpiresAt: null }, NOW)).toBe("pro");
    expect(effectivePlanFromProfile({ plan: "pro" }, NOW)).toBe("pro");
  });

  it("fails CLOSED to free on an unparseable expiry", () => {
    expect(effectivePlanFromProfile({ plan: "max", planExpiresAt: "garbage" }, NOW)).toBe("free");
  });

  it("is free for free regardless of expiry", () => {
    expect(
      effectivePlanFromProfile({ plan: "free", planExpiresAt: "2099-01-01T00:00:00.000Z" }, NOW)
    ).toBe("free");
  });
});

// These defaults only apply when a wrangler var is missing or malformed, which
// is precisely when a stale value does the most damage: it silently reinstates
// the old, much smaller caps on a deploy that looks fine. Pin them to the
// numbers advertised in web/src/lib/site.ts.
describe("cap defaults when env vars are absent", () => {
  const empty = {} as Parameters<typeof capMinutesForPlan>[0];

  it("falls back to the advertised listening caps", () => {
    expect(capMinutesForPlan(empty, "free")).toBe(600);
    expect(capMinutesForPlan(empty, "pro")).toBe(1200);
    expect(capMinutesForPlan(empty, "max")).toBe(3600);
  });

  it("falls back to the advertised AI caps", () => {
    expect(aiCallsForPlan(empty, "free")).toBe(300);
    expect(aiCallsForPlan(empty, "pro")).toBe(2500);
    expect(aiCallsForPlan(empty, "max")).toBe(6000);
  });

  it("ignores a malformed var rather than uncapping the plan", () => {
    const bad = { CAP_MINUTES: "not-a-number", FREE_AI_CALLS_PER_MONTH: "" } as Parameters<
      typeof capMinutesForPlan
    >[0];
    expect(capMinutesForPlan(bad, "free")).toBe(600);
    expect(aiCallsForPlan(bad, "free")).toBe(300);
  });

  it("still honours a var that is set", () => {
    const env = { CAP_MINUTES: "900", PRO_AI_CALLS_PER_MONTH: "4000" } as Parameters<
      typeof capMinutesForPlan
    >[0];
    expect(capMinutesForPlan(env, "free")).toBe(900);
    expect(aiCallsForPlan(env, "pro")).toBe(4000);
  });
});
