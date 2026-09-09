import { describe, expect, it } from "vitest";
import {
  PLAN_ORDER,
  PRICING_FAQ,
  USD_PRICE,
  comparisonRows,
  pricingCopy,
  regionalRows,
} from "./pricing-page";
import { LOCALIZED_MONTHLY } from "./localized-pricing";
import { pricingJsonLd } from "./seo";
import { TIERS } from "./site";

/** Every string a visitor reads on /pricing. */
function visibleCopy(): string[] {
  return [
    ...Object.values(pricingCopy),
    ...PRICING_FAQ.flatMap((item) => [item.question, item.answer]),
    ...comparisonRows().flatMap((row) => [
      row.label,
      row.note ?? "",
      ...Object.values(row.values),
    ]),
    ...regionalRows().flatMap((row) => [row.name, row.pro, row.max]),
  ];
}

describe("pricing page copy", () => {
  // House rule: long dashes read as machine-written. Hyphens are fine.
  it("uses no em or en dashes", () => {
    for (const text of visibleCopy()) {
      expect(text, text).not.toMatch(/[—–]/);
    }
  });

  it("quotes the free caps from TIERS in the summary", () => {
    expect(pricingCopy.verdict).toContain(
      `${Math.round(TIERS.free.listeningMinutes / 60)} hours`
    );
    expect(pricingCopy.verdict).toContain(TIERS.free.aiCallsPerMonth.toLocaleString("en-US"));
  });

  it("keeps the plan-count heading true", () => {
    // "Three plans, two meters" is prose; a fourth tier must not slip past it.
    expect(PLAN_ORDER).toHaveLength(3);
    expect(pricingCopy.plansHeading.startsWith("Three plans")).toBe(true);
  });

  it("never advertises a price the site does not charge", () => {
    // The page quotes prices from TIERS and LOCALIZED_MONTHLY only; a bare
    // dollar amount typed into the copy would be the drift this guards.
    const priceLabels = PLAN_ORDER.flatMap((id) =>
      [TIERS[id].priceLabel, TIERS[id].yearlyLabel].filter(Boolean)
    );
    for (const text of [...Object.values(pricingCopy), ...PRICING_FAQ.map((f) => f.answer)]) {
      for (const match of text.match(/\$\d[\d,.]*/g) ?? []) {
        expect(
          priceLabels.some((label) => label!.includes(match)),
          `${match} in "${text}" is not a TIERS price`
        ).toBe(true);
      }
    }
  });
});

describe("comparison table", () => {
  const rows = comparisonRows();

  it("covers every plan in every row", () => {
    expect(rows.length).toBeGreaterThan(4);
    for (const row of rows) {
      for (const id of PLAN_ORDER) {
        expect(row.values[id], `${row.label}/${id}`).toBeTruthy();
      }
    }
  });

  it("derives the metered rows from TIERS", () => {
    const row = (label: string) => rows.find((r) => r.label === label)!;
    for (const id of PLAN_ORDER) {
      const tier = TIERS[id];
      expect(row("Listening Mode").values[id]).toBe(
        `${Math.round(tier.listeningMinutes / 60)} hours / month`
      );
      expect(row("AI coach messages").values[id]).toBe(
        `${tier.aiCallsPerMonth.toLocaleString("en-US")} / month`
      );
      expect(row("Background AI").values[id]).toBe(
        `${tier.autoCallsPerMonth.toLocaleString("en-US")} / month`
      );
      expect(row("Price").values[id]).toContain(tier.priceLabel);
    }
  });

  it("keeps the unmetered features identical across plans", () => {
    // The pricing promise: cards, SRS, manga, and sync are never paywalled.
    for (const label of [
      "Word cards, manga, and SRS reviews",
      "Cloud sync and backup",
      "Anki export and local-only mode",
    ]) {
      const values = comparisonRows().find((r) => r.label === label)!.values;
      expect(new Set(Object.values(values)).size).toBe(1);
    }
  });
});

describe("regional table", () => {
  it("lists every country with a Dodo rule, by name", () => {
    const rows = regionalRows();
    expect(rows.map((r) => r.country).sort()).toEqual(Object.keys(LOCALIZED_MONTHLY).sort());
    for (const row of rows) {
      // A new Dodo country must get a display name, not ship as "VN".
      expect(row.name, row.country).not.toBe(row.country);
      expect(row.pro).toBe(LOCALIZED_MONTHLY[row.country].pro);
      expect(row.max).toBe(LOCALIZED_MONTHLY[row.country].max);
    }
  });

  it("names those countries in the FAQ answer about cheaper regions", () => {
    const answer = PRICING_FAQ.find((f) => f.question.includes("cheaper"))!.answer;
    for (const row of regionalRows()) expect(answer).toContain(row.name);
  });
});

describe("pricing structured data", () => {
  const jsonLd = pricingJsonLd();

  it("prices its offers from the numbers in the visible labels", () => {
    for (const id of PLAN_ORDER) {
      const usd = USD_PRICE[id];
      expect(TIERS[id].priceLabel).toContain(String(usd.monthly));
      if (usd.yearly) expect(TIERS[id].yearlyLabel).toContain(String(usd.yearly));
    }
  });

  it("offers one monthly price per plan and yearly only where wired", () => {
    const names = jsonLd.offers.map((offer) => offer.name);
    expect(names).toContain("Free monthly");
    expect(names).not.toContain("Free yearly");
    for (const id of ["pro", "max"] as const) {
      expect(names).toContain(`${TIERS[id].name} monthly`);
      expect(names).toContain(`${TIERS[id].name} yearly`);
    }
  });

  it("quotes USD amounts that match the plans", () => {
    for (const offer of jsonLd.offers) {
      expect(offer.priceCurrency).toBe("USD");
      expect(Number(offer.price)).not.toBeNaN();
    }
    const pro = jsonLd.offers.find((o) => o.name === "Pro monthly")!;
    expect(pro.price).toBe(String(USD_PRICE.pro.monthly));
  });
});
