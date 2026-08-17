import { describe, expect, it } from "vitest";
import {
  LOCALIZED_MONTHLY,
  hasLocalizedPricing,
  localizedMonthlyLabel,
  normalizeCfCountry,
} from "./localized-pricing";

describe("localizedMonthlyLabel", () => {
  // These amounts mirror the rules configured in the Dodo dashboard on
  // 2026-08-18. If this test fails because the map changed, make sure the
  // dashboard changed FIRST — the site must never advertise a price Dodo
  // will not charge.
  it("mirrors the Dodo dashboard rules exactly", () => {
    expect(localizedMonthlyLabel("pro", "IN")).toBe("₹299/mo");
    expect(localizedMonthlyLabel("max", "IN")).toBe("₹599/mo");
    expect(localizedMonthlyLabel("pro", "VN")).toBe("₫95,000/mo");
    expect(localizedMonthlyLabel("max", "VN")).toBe("₫189,000/mo");
    expect(localizedMonthlyLabel("pro", "ID")).toBe("Rp59,000/mo");
    expect(localizedMonthlyLabel("max", "ID")).toBe("Rp119,000/mo");
    expect(localizedMonthlyLabel("pro", "PH")).toBe("₱199/mo");
    expect(localizedMonthlyLabel("max", "PH")).toBe("₱399/mo");
  });

  it("is case-insensitive on the country code", () => {
    expect(localizedMonthlyLabel("pro", "in")).toBe("₹299/mo");
    expect(hasLocalizedPricing("vn")).toBe(true);
  });

  it("returns null for free plans and countries without rules", () => {
    expect(localizedMonthlyLabel("free", "IN")).toBeNull();
    expect(localizedMonthlyLabel("pro", "US")).toBeNull();
    expect(localizedMonthlyLabel("pro", "BR")).toBeNull();
    expect(localizedMonthlyLabel("pro", null)).toBeNull();
    expect(localizedMonthlyLabel("pro", undefined)).toBeNull();
  });

  it("hasLocalizedPricing agrees with the rule set", () => {
    for (const country of Object.keys(LOCALIZED_MONTHLY)) {
      expect(hasLocalizedPricing(country)).toBe(true);
    }
    expect(hasLocalizedPricing("US")).toBe(false);
    expect(hasLocalizedPricing(null)).toBe(false);
  });

  // Yearly is deliberately absent: Dodo has monthly rules only, and the USD
  // yearly price converts to more than 12 localized months. Every label being
  // "/mo" is what lets the UI safely hide the yearly toggle in these countries.
  it("carries monthly labels only", () => {
    for (const rules of Object.values(LOCALIZED_MONTHLY)) {
      expect(rules.pro.endsWith("/mo")).toBe(true);
      expect(rules.max.endsWith("/mo")).toBe(true);
    }
  });
});

describe("normalizeCfCountry", () => {
  it("uppercases valid ISO codes", () => {
    expect(normalizeCfCountry("in")).toBe("IN");
    expect(normalizeCfCountry("VN")).toBe("VN");
  });

  it("rejects Cloudflare sentinels and junk", () => {
    expect(normalizeCfCountry("XX")).toBeNull(); // unknown location
    expect(normalizeCfCountry("T1")).toBeNull(); // Tor exit
    expect(normalizeCfCountry("")).toBeNull();
    expect(normalizeCfCountry(null)).toBeNull();
    expect(normalizeCfCountry(undefined)).toBeNull();
    expect(normalizeCfCountry("USA")).toBeNull();
  });
});
