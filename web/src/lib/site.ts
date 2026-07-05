export const SITE_URL = "https://animevocab.com";
export const GITHUB_URL = "https://github.com/Atharva-Kanherkar/anime-vocab-coach";
export const SPONSOR_URL = "https://github.com/sponsors/Atharva-Kanherkar";

export const promoConfig = {
  endUtc: "2026-08-03T23:59:59.000Z",
  regularLabel: "$10/month or $84/year",
  promoLabel: "$7/month or $59/year",
  checkoutUrl: "https://checkout.dodopayments.com/buy/REPLACE_PRODUCT_ID",
  promoCheckoutUrl: "https://checkout.dodopayments.com/buy/REPLACE_PROMO_PRODUCT_ID",
  apiBase: "https://api.animevocab.com",
} as const;

export type PromoState = {
  active: boolean;
  daysLeft: number;
  checkoutUrl: string;
  regularLabel: string;
  promoLabel: string;
  /** False while the Dodo product ids are still placeholders — don't show a
   * checkout link that dead-ends on REPLACE_PRODUCT_ID. */
  checkoutConfigured: boolean;
};

export function getPromoState(now = Date.now()): PromoState {
  const ends = Date.parse(promoConfig.endUtc);
  const active = now < ends;
  const daysLeft = active ? Math.max(0, Math.ceil((ends - now) / 86400000)) : 0;
  const checkoutUrl = active ? promoConfig.promoCheckoutUrl : promoConfig.checkoutUrl;
  return {
    active,
    daysLeft,
    checkoutUrl,
    regularLabel: promoConfig.regularLabel,
    promoLabel: promoConfig.promoLabel,
    checkoutConfigured: !checkoutUrl.includes("REPLACE_"),
  };
}
