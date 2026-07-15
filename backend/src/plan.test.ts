import { describe, expect, it } from "vitest";
import { effectivePlanFromProfile, normalizePlan } from "./plan";

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
