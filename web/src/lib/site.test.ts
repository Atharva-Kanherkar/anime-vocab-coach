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
