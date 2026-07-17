import { describe, expect, it } from "vitest";
import {
  billingMetadataPatch,
  effectivePlan,
  giftMaxExpiresAt,
  isPaidSubscription,
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

  it("fails CLOSED to free on a corrupt expiry — never permanent paid access", () => {
    expect(parseEntitlement({ plan: "max", planExpiresAt: "not-a-date" })).toEqual({
      plan: "free",
      billingInterval: null,
      planExpiresAt: null,
    });
    expect(parseEntitlement({ plan: "pro", planExpiresAt: 12345 })).toEqual({
      plan: "free",
      billingInterval: null,
      planExpiresAt: null,
    });
  });

  it("normalizes parseable non-ISO expiry to ISO", () => {
    expect(parseEntitlement({ plan: "max", planExpiresAt: "2026-10-15" }).planExpiresAt).toBe(
      "2026-10-15T00:00:00.000Z"
    );
  });

  it("treats explicit null expiry as no expiry", () => {
    expect(parseEntitlement({ plan: "pro", planExpiresAt: null }).planExpiresAt).toBeNull();
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

  it("treats the exact expiry instant as expired", () => {
    const t = "2026-10-15T00:00:00.000Z";
    expect(
      effectivePlan({ plan: "max", billingInterval: null, planExpiresAt: t }, Date.parse(t))
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

  it("fails CLOSED to free on an unparseable expiry (e.g. a corrupt token profile)", () => {
    expect(
      effectivePlan(
        { plan: "max", billingInterval: null, planExpiresAt: "garbage" },
        Date.parse("2026-07-15T00:00:00.000Z")
      )
    ).toBe("free");
  });
});

describe("isPaidSubscription", () => {
  it("is true for a paid plan with no expiry (Dodo-managed)", () => {
    expect(isPaidSubscription({ plan: "pro", billingInterval: "yearly", planExpiresAt: null })).toBe(
      true
    );
  });

  it("is false for gifts (expiry set) and free", () => {
    expect(
      isPaidSubscription({
        plan: "max",
        billingInterval: null,
        planExpiresAt: "2026-10-15T00:00:00.000Z",
      })
    ).toBe(false);
    expect(isPaidSubscription({ plan: "free", billingInterval: null, planExpiresAt: null })).toBe(
      false
    );
  });
});

describe("billingMetadataPatch", () => {
  it("clears gift expiry and records billing interval on paid events", () => {
    expect(billingMetadataPatch("pro", "yearly")).toEqual({
      plan: "pro",
      planExpiresAt: null,
      billingInterval: "yearly",
    });
    expect(billingMetadataPatch("max")).toEqual({
      plan: "max",
      planExpiresAt: null,
      billingInterval: null,
    });
  });

  it("also clears billingInterval on terminal (free) events", () => {
    expect(billingMetadataPatch("free")).toEqual({
      plan: "free",
      planExpiresAt: null,
      billingInterval: null,
    });
  });
});

describe("giftMaxExpiresAt / maxGiftEntitlement", () => {
  it("adds three UTC months", () => {
    expect(giftMaxExpiresAt(new Date("2026-07-15T12:00:00.000Z"))).toBe(
      "2026-10-15T12:00:00.000Z"
    );
  });

  it("clamps month-end overflow to the target month's last day", () => {
    // Nov 30 + 3mo would be "Feb 30" — clamp to Feb 28, never roll into March.
    expect(giftMaxExpiresAt(new Date("2026-11-30T10:00:00.000Z"))).toBe(
      "2027-02-28T10:00:00.000Z"
    );
    // Jan 31 + 3mo would be "Apr 31" — clamp to Apr 30.
    expect(giftMaxExpiresAt(new Date("2027-01-31T00:00:00.000Z"))).toBe(
      "2027-04-30T00:00:00.000Z"
    );
    // Leap year: Nov 29 2027 + 3mo lands on Feb 29 2028 exactly (no clamp needed).
    expect(giftMaxExpiresAt(new Date("2027-11-29T00:00:00.000Z"))).toBe(
      "2028-02-29T00:00:00.000Z"
    );
  });

  it("builds a Max gift with expiry and NO fabricated billing interval", () => {
    const e = maxGiftEntitlement(new Date("2026-07-15T00:00:00.000Z"));
    expect(e.plan).toBe("max");
    expect(e.billingInterval).toBeNull();
    expect(e.planExpiresAt).toBe("2026-10-15T00:00:00.000Z");
    // A gift must never look like a paid subscription.
    expect(isPaidSubscription(e)).toBe(false);
  });
});
