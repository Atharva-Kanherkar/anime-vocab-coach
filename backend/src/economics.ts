import type { Env } from "./index";
import { PROVIDER_COST_USD_PER_MIN } from "./transcribe/types";

const PRICE_REGULAR_MONTHLY = 10;
const PRICE_REGULAR_YEARLY = 84;
const PRICE_PROMO_MONTHLY = 7;
const PRICE_PROMO_YEARLY = 59;

const LISTENING_SCENARIOS_HOURS = [5, 15, 45] as const;
const AI_SCENARIOS_CALLS = [20, 100, 300] as const;

function numberVar(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function paymentNet(env: Env, gross: number): number {
  const feeRate = numberVar(env.PAYMENT_FEE_RATE, 0.05);
  const fixedFee = numberVar(env.PAYMENT_FIXED_FEE_USD, 0.3);
  return gross - gross * feeRate - fixedFee;
}

function margin(netRevenue: number, cost: number): number {
  return netRevenue > 0 ? (netRevenue - cost) / netRevenue : 0;
}

export function economicsSnapshot(env: Env) {
  const capMinutes = numberVar(env.CAP_MINUTES, 2700);
  const aiCostUsdPerCall = numberVar(env.AI_COST_USD_PER_CALL, 0.002);
  const transcriptionCostUsdPerMinute = PROVIDER_COST_USD_PER_MIN.openai;

  const pricePoints = [
    { name: "regular-monthly", grossMrr: PRICE_REGULAR_MONTHLY },
    { name: "regular-yearly-normalized", grossMrr: PRICE_REGULAR_YEARLY / 12 },
    { name: "promo-monthly", grossMrr: PRICE_PROMO_MONTHLY },
    { name: "promo-yearly-normalized", grossMrr: PRICE_PROMO_YEARLY / 12 }
  ].map((price) => ({
    ...price,
    netMrr: money(paymentNet(env, price.grossMrr))
  }));

  const scenarios = pricePoints.flatMap((price) =>
    LISTENING_SCENARIOS_HOURS.flatMap((listeningHours) =>
      AI_SCENARIOS_CALLS.map((aiCalls) => {
        const transcriptionCost = listeningHours * 60 * transcriptionCostUsdPerMinute;
        const aiCost = aiCalls * aiCostUsdPerCall;
        const totalCost = transcriptionCost + aiCost;
        return {
          price: price.name,
          listeningHours,
          aiCalls,
          revenueUsd: price.netMrr,
          transcriptionCostUsd: money(transcriptionCost),
          aiCostUsd: money(aiCost),
          totalVariableCostUsd: money(totalCost),
          grossMargin: money(margin(price.netMrr, totalCost))
        };
      })
    )
  );

  return {
    assumptions: {
      paymentFeeRate: numberVar(env.PAYMENT_FEE_RATE, 0.05),
      paymentFixedFeeUsd: numberVar(env.PAYMENT_FIXED_FEE_USD, 0.3),
      transcriptionCostUsdPerMinute,
      aiCostUsdPerCall
    },
    planLimits: {
      proListeningMinutesPerMonth: capMinutes,
      proListeningHoursPerMonth: Math.round(capMinutes / 60),
      freeAiCallsPerMonth: numberVar(env.FREE_AI_CALLS_PER_MONTH, 5),
      proAiCallsPerMonth: numberVar(env.PRO_AI_CALLS_PER_MONTH, 300)
    },
    pricePoints,
    scenarios
  };
}
