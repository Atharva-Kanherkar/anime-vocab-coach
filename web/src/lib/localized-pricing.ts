import type { PlanId } from "./site";

// Display mirror of the Dodo localized-pricing rules configured in the
// merchant dashboard. Dodo resolves the real charge from the buyer's billing
// country at checkout; this map only makes the landing page and billing panel
// SHOW that price, so the discount can do its marketing work before checkout.
// Keep the amounts in lockstep with the dashboard rules — Dodo, not this file,
// decides what is charged.
//
// Monthly only, deliberately: no yearly rules exist in Dodo yet, and the USD
// yearly price converts to MORE than 12 localized months, so callers must hide
// the yearly option for these countries rather than advertise it as a saving.
export const LOCALIZED_MONTHLY: Record<string, { pro: string; max: string }> = {
  IN: { pro: "₹299/mo", max: "₹599/mo" },
  VN: { pro: "₫95,000/mo", max: "₫189,000/mo" },
  ID: { pro: "Rp59,000/mo", max: "Rp119,000/mo" },
  PH: { pro: "₱199/mo", max: "₱399/mo" },
};

export function hasLocalizedPricing(country: string | null | undefined): boolean {
  return !!country && country.toUpperCase() in LOCALIZED_MONTHLY;
}

/** The localized monthly price label for a paid plan, or null when the
 * visitor's country has no Dodo rule (callers fall back to the USD label). */
export function localizedMonthlyLabel(
  plan: PlanId,
  country: string | null | undefined
): string | null {
  if (!country || plan === "free") return null;
  return LOCALIZED_MONTHLY[country.toUpperCase()]?.[plan] ?? null;
}

/** CF-IPCountry header value to a usable ISO code: uppercases and rejects
 * Cloudflare's sentinels ("XX" unknown, "T1" Tor) and anything not two letters. */
export function normalizeCfCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const country = raw.toUpperCase();
  return /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null;
}
