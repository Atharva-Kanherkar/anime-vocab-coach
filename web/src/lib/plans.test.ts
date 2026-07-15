import { describe, expect, it } from "vitest";
import {
  effectivePlan,
  giftMaxExpiresAt,
  maxGiftEntitlement,
  parseEntitlement,
} from "./plans";

describe("parseEntitlement", () => {
  it("defaults to free when metadata is missing", () => {
    expect(parseEntitlement(null)).toEqual({
      plan: "free",
      billingInterval: null,
      planExpiresAt: null,
    });
  });

  it("parses plan, interval, and expiry", () => {
    const e = parseEntitlement({
      plan: "max",
      billingInterval: "yearly",
      planExpiresAt: "2026-10-15T00:00:00.000Z",
    });
    expect(e).toEqual({
      plan: "max",
      billingInterval: "yearly",
      planExpiresAt: "2026-10-15T00:00:00.000Z",
    });
  });

  it("ignores invalid plan / interval", () => {
    expect(parseEntitlement({ plan: "enterprise", billingInterval: "weekly" })).toEqual({
      plan: "free",
      billingInterval: null,
      planExpiresAt: null,
    });
  });
});

describe("effectivePlan", () => {
  it("returns free when expired", () => {
    expect(
      effectivePlan(
        { plan: "max", billingInterval: "monthly", planExpiresAt: "2026-01-01T00:00:00.000Z" },
        Date.parse("2026-07-15T00:00:00.000Z")
      )
    ).toBe("free");
  });

  it("keeps paid plan before expiry", () => {
    expect(
      effectivePlan(
        { plan: "pro", billingInterval: "monthly", planExpiresAt: "2026-12-01T00:00:00.000Z" },
        Date.parse("2026-07-15T00:00:00.000Z")
      )
    ).toBe("pro");
  });

  it("keeps plan with no expiry", () => {
    expect(
      effectivePlan(
        { plan: "max", billingInterval: "yearly", planExpiresAt: null },
        Date.parse("2026-07-15T00:00:00.000Z")
      )
    ).toBe("max");
  });
});

describe("giftMaxExpiresAt / maxGiftEntitlement", () => {
  it("adds three UTC months", () => {
    expect(giftMaxExpiresAt(new Date("2026-07-15T12:00:00.000Z"))).toBe(
      "2026-10-15T12:00:00.000Z"
    );
  });

  it("builds a Max monthly gift", () => {
    const e = maxGiftEntitlement(new Date("2026-07-15T00:00:00.000Z"));
    expect(e.plan).toBe("max");
    expect(e.billingInterval).toBe("monthly");
    expect(e.planExpiresAt).toBe("2026-10-15T00:00:00.000Z");
  });
});
