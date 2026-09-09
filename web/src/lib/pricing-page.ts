// Copy and derived tables for the public /pricing page.
//
// Everything a visitor reads about limits is DERIVED from TIERS (site.ts) and
// LOCALIZED_MONTHLY (localized-pricing.ts) rather than retyped, so a cap or a
// Dodo rule can never be raised in one place and left stale on the page that
// sells it. pricing-page.test.ts pins that derivation, plus the house copy
// rule (no long dashes in prose).

import { LOCALIZED_MONTHLY } from "./localized-pricing";
import { TIERS, type PlanId } from "./site";

export const PLAN_ORDER: PlanId[] = ["free", "pro", "max"];

function hours(minutes: number): string {
  return `${Math.round(minutes / 60)} hours`;
}

function count(n: number): string {
  return n.toLocaleString("en-US");
}

export const pricingCopy = {
  h1: "AnimeVocab pricing",
  lede:
    "The extension is free, forever, with no account. Paying only raises two meters: hosted Listening Mode minutes and AI coach messages. Everything else is included on every plan.",
  verdictTag: "Short version",
  verdict: `Start free. Free covers ${hours(TIERS.free.listeningMinutes)} of Listening Mode and ${count(TIERS.free.aiCallsPerMonth)} AI messages a month, which is most people. Upgrade the month you actually run out.`,
  plansHeading: "Three plans, two meters",
  plansSub:
    "Word cards, manga, SRS reviews, and cloud sync are never metered. They cost us nothing to run, so paywalling them would only slow your habit down.",
  tableHeading: "What each plan includes",
  tableSub: "Same product on every plan. The only differences are the two numbers at the top.",
  regionalHeading: "Regional pricing",
  regionalSub:
    "Pro and Max cost less in a few countries. The price is applied by our payment provider from your billing country, so the amount you see at checkout is the amount you pay.",
  regionalNote:
    "Yearly billing is not offered in these countries yet, because twelve regional months still cost less than the yearly USD price.",
  honestyHeading: "Where your money goes",
  honestyBody:
    "Listening Mode sends episode audio to a hosted transcription model, and the AI coach runs a reasoning model on the line you are stuck on. Those two are the real bill, which is why they are the two things we meter. Transcripts are cached and shared, so the first person to watch an episode pays for it and everyone after that does not.",
  faqHeading: "Pricing questions",
  closingHeading: "Start on Free. Upgrade when you hit a wall.",
  closingBody: "No account needed to install, and no card needed to learn your first hundred words.",
} as const;

/** Numeric USD amounts for structured data (schema.org Offers need numbers,
 * not "$8/mo"). Pinned against the TIERS labels by pricing-page.test.ts so a
 * price change cannot update the visible label and leave the markup stale. */
export const USD_PRICE: Record<PlanId, { monthly: number; yearly?: number }> = {
  free: { monthly: 0 },
  pro: { monthly: 8, yearly: 59 },
  max: { monthly: 16, yearly: 119 },
};

export type ComparisonRow = {
  label: string;
  /** Cell text per plan, keyed by plan id. */
  values: Record<PlanId, string>;
  note?: string;
};

/** The plan comparison table, built from TIERS so it cannot drift from the
 * caps the API actually enforces. */
export function comparisonRows(): ComparisonRow[] {
  const cell = (fn: (id: PlanId) => string): Record<PlanId, string> => ({
    free: fn("free"),
    pro: fn("pro"),
    max: fn("max"),
  });
  const same = (text: string): Record<PlanId, string> => cell(() => text);

  return [
    {
      label: "Price",
      values: cell((id) => {
        const tier = TIERS[id];
        return tier.yearlyLabel ? `${tier.priceLabel} or ${tier.yearlyLabel}` : tier.priceLabel;
      }),
    },
    {
      label: "Listening Mode",
      values: cell((id) => `${hours(TIERS[id].listeningMinutes)} / month`),
      note: "Hosted transcription for shows with no usable Japanese subtitles.",
    },
    {
      label: "AI coach messages",
      values: cell((id) => `${count(TIERS[id].aiCallsPerMonth)} / month`),
      note: "Only what you ask for: explain this line, memory hooks, chat, notebook summaries.",
    },
    {
      label: "Background AI",
      values: cell((id) => `${count(TIERS[id].autoCallsPerMonth)} / month`),
      note: "Word picking and pronunciation audio the extension fires by itself, on a separate meter so it can never eat your coach messages.",
    },
    { label: "Word cards, manga, and SRS reviews", values: same("Included") },
    { label: "Netflix, Crunchyroll, YouTube, and more", values: same("Included") },
    { label: "Cloud sync and backup", values: same("Included") },
    { label: "Anki export and local-only mode", values: same("Included") },
    {
      label: "Account required",
      values: { free: "Optional", pro: "Yes", max: "Yes" },
    },
  ];
}

/** Display names for the countries with Dodo localized-pricing rules. Keyed by
 * the same ISO codes as LOCALIZED_MONTHLY, which the test pins. */
const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  VN: "Vietnam",
  ID: "Indonesia",
  PH: "Philippines",
};

export type RegionalRow = { country: string; name: string; pro: string; max: string };

/** Every country with a localized monthly rule, for the static regional table.
 * Server-rendered for all visitors (unlike the geo-detected card prices) so the
 * page states the regional prices even when /api/geo says nothing. */
export function regionalRows(): RegionalRow[] {
  return Object.entries(LOCALIZED_MONTHLY).map(([country, rules]) => ({
    country,
    name: COUNTRY_NAMES[country] ?? country,
    pro: rules.pro,
    max: rules.max,
  }));
}

export const PRICING_FAQ: { question: string; answer: string }[] = [
  {
    question: "Is AnimeVocab really free?",
    answer: `Yes. The extension installs and works with no account and no card: word cards, spaced repetition, manga, and Anki export. A free account adds cloud sync, ${count(TIERS.free.aiCallsPerMonth)} AI coach messages a month, and ${hours(TIERS.free.listeningMinutes)} of Listening Mode.`,
  },
  {
    question: "What happens when I hit a monthly cap?",
    answer:
      "The metered feature pauses until the meter resets at the start of the next month. Nothing is deleted, reviews keep working, and you are never charged for going over.",
  },
  {
    question: "What is the difference between Pro and Max?",
    answer: `Listening Mode hours and AI messages, nothing else. Pro gives ${hours(TIERS.pro.listeningMinutes)} and ${count(TIERS.pro.aiCallsPerMonth)} messages a month; Max gives ${hours(TIERS.max.listeningMinutes)} and ${count(TIERS.max.aiCallsPerMonth)}. Max is for people who watch most evenings.`,
  },
  {
    question: "Can I cancel any time?",
    answer:
      "Yes. Cancel, change your card, or download invoices in the customer portal. Your plan runs to the end of the period you paid for, then drops back to Free with your cards and progress intact.",
  },
  {
    question: "Do you offer cheaper pricing in my country?",
    answer: `${regionalRows().map((r) => r.name).join(", ")} have lower monthly prices, applied automatically from your billing country at checkout.`,
  },
  {
    question: "Is my progress locked in if I stop paying?",
    answer:
      "No. Cards live on your device, sync is a copy rather than a cage, and Anki export is on every plan including Free. Stop paying and you keep everything you learned.",
  },
];
