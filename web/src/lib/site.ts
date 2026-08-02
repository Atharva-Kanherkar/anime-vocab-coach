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

/** Dodo's unified customer portal — cancel, invoices, payment method. */
export const DODO_CUSTOMER_PORTAL_URL = "https://customer.dodopayments.com";

export function isStoreInstallAvailable(): boolean {
  return !!CHROME_STORE_URL;
}

/** Where every install / "Add to Chrome" CTA points. Store link once approved,
 * in-app Help guide until then. */
export function installUrl(): string {
  return CHROME_STORE_URL || `${SITE_URL}/app#help`;
}

// ── Tiers ────────────────────────────────────────────────────────────────
// Canonical free / pro / max limits. Live gating reads Clerk publicMetadata
// (see resolvePlan in auth.ts). Checkout URLs point at live Dodo products.
export type PlanId = "free" | "pro" | "max";
export type CheckoutInterval = "monthly" | "yearly";

export interface PricingTier {
  id: PlanId;
  name: string;
  priceLabel: string;
  yearlyLabel?: string;
  /** Monthly cap on AI the learner *asks* for: explain, memory hooks, chat,
   * notebook summaries. This is the number the pricing page advertises, so
   * nothing the learner didn't request may be charged against it. */
  aiCallsPerMonth: number;
  /** Separate monthly cap for AI the extension fires on its own — smart word
   * picking and pronunciation audio. These are cheap, heavily cached, and
   * invisible; metering them against `aiCallsPerMonth` meant a learner could
   * burn the whole advertised allowance without ever opening the coach. */
  autoCallsPerMonth: number;
  /** Monthly Listening-Mode minutes. */
  listeningMinutes: number;
  blurb: string;
  perks: string[];
  /** Dodo monthly checkout link. Empty/REPLACE = not purchasable yet. */
  checkoutUrl: string;
  /** Dodo yearly checkout link. Empty/REPLACE = yearly not wired yet. */
  yearlyCheckoutUrl?: string;
}

export const TIERS: Record<PlanId, PricingTier> = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    aiCallsPerMonth: 300,
    autoCallsPerMonth: 1200,
    listeningMinutes: 600, // 10h
    blurb: "The whole game, on the house.",
    perks: [
      "Full extension: capture, SRS reviews, cards & manga",
      "10 hours of Listening Mode / month",
      "300 AI coach + chat messages / month",
      "Cloud sync & backup",
    ],
    checkoutUrl: "", // free — no checkout
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "$8/mo",
    yearlyLabel: "$59/year",
    aiCallsPerMonth: 2500,
    autoCallsPerMonth: 8000,
    listeningMinutes: 1200, // 20h
    blurb: "For the nightly binge-learner.",
    perks: ["20 hours of Listening Mode / month", "2,500 AI messages / month", "Everything in Free"],
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NjC6UgznpQBcuqEgqQvh",
    yearlyCheckoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NjC7U0M47YSNH1im6hK1",
  },
  max: {
    id: "max",
    name: "Max",
    priceLabel: "$16/mo",
    yearlyLabel: "$119/year",
    aiCallsPerMonth: 6000,
    autoCallsPerMonth: 15000,
    listeningMinutes: 3600, // 60h
    blurb: "For the marathoner. Effectively unlimited.",
    perks: ["60 hours of Listening Mode / month", "6,000 AI messages / month", "Priority on new card styles"],
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NjC6keUai2ij7peo7bOr",
    yearlyCheckoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NjC6vrfhe4ejCgC8mOXH",
  },
};

function isLiveCheckoutUrl(url: string | undefined): url is string {
  return !!url && !url.includes("REPLACE_");
}

/** A tier's checkout URL for the given billing interval, if wired. */
export function checkoutFor(
  id: PlanId,
  interval: CheckoutInterval = "monthly"
): string | null {
  const tier = TIERS[id];
  const url = interval === "yearly" ? tier.yearlyCheckoutUrl : tier.checkoutUrl;
  return isLiveCheckoutUrl(url) ? url : null;
}

/** Prefill email + bounce back to the app after Dodo checkout. */
export function checkoutWithContext(
  url: string,
  opts?: { email?: string | null; redirectUrl?: string | null }
): string {
  const u = new URL(url);
  if (opts?.email) u.searchParams.set("email", opts.email);
  if (opts?.redirectUrl) u.searchParams.set("redirect_url", opts.redirectUrl);
  return u.toString();
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
