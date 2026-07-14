export const SITE_URL = "https://animevocab.com";
export const GITHUB_URL = "https://github.com/Atharva-Kanherkar/anime-vocab-coach";
export const SPONSOR_URL = "https://github.com/sponsors/Atharva-Kanherkar";

// Chrome Web Store listing. Paste the store URL here to flip every "Add to
// Chrome" CTA across the whole site at once. While empty, installUrl() falls
// back to the in-app Help guide (load-unpacked).
export const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/animevocab-learn-japanese/lkjbomofgfonjjbemobacegffepbdnel";

/** Direct download of the packed extension (built in CI → web/public/downloads/). */
export const EXTENSION_DOWNLOAD_URL = `${SITE_URL}/downloads/animevocab-chrome-extension.zip`;
export const CHROME_EXTENSIONS_URL = "chrome://extensions";

export function isStoreInstallAvailable(): boolean {
  return !!CHROME_STORE_URL;
}

/** Where every install / "Add to Chrome" CTA points. Store link once approved,
 * in-app Help guide until then. */
export function installUrl(): string {
  return CHROME_STORE_URL || `${SITE_URL}/app#help`;
}

// ── Tiers ────────────────────────────────────────────────────────────────
// The three plans. `free` is live now (everyone is free until billing lands —
// see resolvePlan in auth.ts). `pro`/`max` are defined and priced, but their
// checkout is GATED: `checkoutUrl` is a Dodo placeholder that 404s until the
// real product id is pasted in. Going live after Dodo approval = swap the two
// REPLACE_* ids below, nothing else.
export type PlanId = "free" | "pro" | "max";

export interface PricingTier {
  id: PlanId;
  name: string;
  priceLabel: string;
  yearlyLabel?: string;
  /** Monthly AI-call cap (coach + chat + pick-word share this pool). */
  aiCallsPerMonth: number;
  /** Monthly Listening-Mode minutes. */
  listeningMinutes: number;
  blurb: string;
  perks: string[];
  /** Dodo checkout link. Empty/REPLACE = not purchasable yet (see checkoutFor). */
  checkoutUrl: string;
}

export const TIERS: Record<PlanId, PricingTier> = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    aiCallsPerMonth: 40,
    listeningMinutes: 480, // 8h
    blurb: "The whole game, on the house.",
    perks: [
      "Full extension: capture, SRS reviews, cards & manga",
      "8 hours of Listening Mode / month",
      "40 AI coach + chat messages / month",
      "Cloud sync & backup",
    ],
    checkoutUrl: "", // free — no checkout
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "$8/mo",
    yearlyLabel: "$59/year",
    aiCallsPerMonth: 150,
    listeningMinutes: 1200, // 20h
    blurb: "For the nightly binge-learner.",
    perks: ["20 hours of Listening Mode / month", "150 AI messages / month", "Everything in Free"],
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NjC6UgznpQBcuqEgqQvh",
  },
  max: {
    id: "max",
    name: "Max",
    priceLabel: "$16/mo",
    yearlyLabel: "$119/year",
    aiCallsPerMonth: 600,
    listeningMinutes: 3600, // 60h
    blurb: "For the marathoner. Effectively unlimited.",
    perks: ["60 hours of Listening Mode / month", "600 AI messages / month", "Priority on new card styles"],
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NjC6keUai2ij7peo7bOr",
  },
};

/** A tier's checkout URL if it's really wired (Dodo id pasted), else null. */
export function checkoutFor(id: PlanId): string | null {
  const url = TIERS[id].checkoutUrl;
  return url && !url.includes("REPLACE_") ? url : null;
}

export const promoConfig = {
  endUtc: "2026-08-03T23:59:59.000Z",
  regularLabel: "$8/month or $59/year",
  promoLabel: "$8/month or $59/year",
  checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NjC6UgznpQBcuqEgqQvh",
  promoCheckoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NjC6UgznpQBcuqEgqQvh",
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
