import { describe, expect, it } from "vitest";
// The report command uses this same dependency-free module directly in Node.
// @ts-expect-error JavaScript module intentionally has no separate declaration file.
import { buildFunnelCounts, conversion } from "../scripts/funnel-report.mjs";

describe("weekly funnel report", () => {
  it("combines site, extension, and external CWS/payment counts", () => {
    expect(buildFunnelCounts(
      { landing_view: 100, store_cta_click: 30 },
      { signup_completed: 12, first_card_created: 9, first_srs_review: 5, checkout_started: 2 },
      { installs: 20, payers: 1 }
    )).toMatchObject({
      landing_view: 100,
      store_cta_click: 30,
      cws_installs: 20,
      signup_completed: 12,
      first_card_created: 9,
      first_srs_review: 5,
      checkout_started: 2,
      payers: 1,
    });
  });

  it("keeps missing external inputs explicit and avoids division errors", () => {
    const counts = buildFunnelCounts({}, {});
    expect(counts.cws_installs).toBeNull();
    expect(counts.payers).toBeNull();
    expect(buildFunnelCounts({}, {}, { installs: Number.NaN }).cws_installs).toBeNull();
    expect(conversion(0, 2)).toBeNull();
    expect(conversion(null, 2)).toBeNull();
    expect(conversion(20, 5)).toBe(0.25);
  });
});
