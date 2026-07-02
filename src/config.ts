// Launch promotion — global window, same for every user.
// After PROMO_END_UTC the flag turns off everywhere (extension, site, API)
// without a new release. Set the Dodo promo checkout URL in config / Worker vars.

/** ISO-8601 UTC instant when launch pricing ends (30 days from ship). */
export const PROMO_END_UTC = "2026-08-03T23:59:59.000Z";

export const CHECKOUT_URL =
  "https://checkout.dodopayments.com/buy/REPLACE_PRODUCT_ID";

/** Dodo checkout for the discounted launch product (create in Dodo dashboard). */
export const PROMO_CHECKOUT_URL =
  "https://checkout.dodopayments.com/buy/REPLACE_PROMO_PRODUCT_ID";

export const PRO_REGULAR = {
  monthlyUsd: 10,
  yearlyUsd: 84,
  label: "$10/month or $84/year"
} as const;

export const PRO_PROMO = {
  monthlyUsd: 7,
  yearlyUsd: 59,
  label: "$7/month or $59/year"
} as const;

export interface PromoState {
  active: boolean;
  endsAt: string;
  daysLeft: number;
  checkoutUrl: string;
  priceLabel: string;
  regularLabel: string;
}

export function promoState(now = Date.now()): PromoState {
  const ends = Date.parse(PROMO_END_UTC);
  const active = now < ends;
  const daysLeft = active ? Math.max(0, Math.ceil((ends - now) / 86400000)) : 0;
  return {
    active,
    endsAt: PROMO_END_UTC,
    daysLeft,
    checkoutUrl: active ? PROMO_CHECKOUT_URL : CHECKOUT_URL,
    priceLabel: active ? PRO_PROMO.label : PRO_REGULAR.label,
    regularLabel: PRO_REGULAR.label
  };
}

export function promoBannerText(state: PromoState): string | null {
  if (!state.active) return null;
  const dayWord = state.daysLeft === 1 ? "day" : "days";
  return `Launch pricing — ${PRO_PROMO.label} (${state.daysLeft} ${dayWord} left)`;
}

// Cloudflare Worker URL — update after `wrangler deploy` in backend/.
export const BACKEND_URL = "https://avc-api.example.workers.dev";

export const PRO_HOURS_PER_MONTH = 45;
