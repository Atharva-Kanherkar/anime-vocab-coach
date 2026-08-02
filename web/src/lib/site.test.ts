import { describe, expect, it } from "vitest";
import { checkoutFor, checkoutWithContext, TIERS } from "./site";

describe("checkoutFor", () => {
  it("returns monthly Dodo links by default", () => {
    expect(checkoutFor("pro")).toBe(TIERS.pro.checkoutUrl);
    expect(checkoutFor("max", "monthly")).toBe(TIERS.max.checkoutUrl);
    expect(checkoutFor("free")).toBeNull();
  });

  it("returns yearly Dodo links when requested", () => {
    expect(checkoutFor("pro", "yearly")).toBe(TIERS.pro.yearlyCheckoutUrl);
    expect(checkoutFor("max", "yearly")).toBe(TIERS.max.yearlyCheckoutUrl);
  });
});

describe("tier limits", () => {
  const ORDER = ["free", "pro", "max"] as const;

  it("every tier caps both meters", () => {
    for (const id of ORDER) {
      expect(TIERS[id].aiCallsPerMonth).toBeGreaterThan(0);
      expect(TIERS[id].autoCallsPerMonth).toBeGreaterThan(0);
      expect(TIERS[id].listeningMinutes).toBeGreaterThan(0);
    }
  });

  it("never lets a paid tier offer less than a cheaper one", () => {
    for (let i = 1; i < ORDER.length; i++) {
      const lower = TIERS[ORDER[i - 1]];
      const higher = TIERS[ORDER[i]];
      expect(higher.aiCallsPerMonth).toBeGreaterThan(lower.aiCallsPerMonth);
      expect(higher.autoCallsPerMonth).toBeGreaterThan(lower.autoCallsPerMonth);
      expect(higher.listeningMinutes).toBeGreaterThanOrEqual(lower.listeningMinutes);
    }
  });

  // Background calls (word picking, pronunciation) fire far more often than
  // anything the learner asks for. If the auto bucket were the smaller of the
  // two, it would run dry first and degrade the experience while the advertised
  // allowance sat unused — the shape of the bug this split was meant to end.
  it("gives automatic calls more headroom than asked-for ones", () => {
    for (const id of ORDER) {
      expect(TIERS[id].autoCallsPerMonth).toBeGreaterThan(TIERS[id].aiCallsPerMonth);
    }
  });
});

describe("checkoutWithContext", () => {
  it("prefills email and redirect_url", () => {
    const url = checkoutWithContext(TIERS.pro.checkoutUrl, {
      email: "a@b.com",
      redirectUrl: "https://animevocab.com/app#billing",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("email")).toBe("a@b.com");
    expect(parsed.searchParams.get("redirect_url")).toBe("https://animevocab.com/app#billing");
  });
});
