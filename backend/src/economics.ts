import type { Env } from "./index";
import { aiCallsForPlan, capMinutesForPlan, numberVar } from "./plan";
import { PROVIDER_COST_USD_PER_MIN } from "./transcribe/types";

// Live pricing (USD). Free is $0; Pro/Max are the paid tiers.
const PRICE_PRO_MONTHLY = 8;
const PRICE_PRO_YEARLY = 59;
const PRICE_MAX_MONTHLY = 16;
const PRICE_MAX_YEARLY = 119;

const LISTENING_SCENARIOS_HOURS = [5, 15, 45] as const;
const AI_SCENARIOS_CALLS = [20, 100, 300] as const;

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function paymentNet(env: Env, gross: number): number {
  const feeRate = numberVar(env.PAYMENT_FEE_RATE, 0.05);
  const fixedFee = numberVar(env.PAYMENT_FIXED_FEE_USD, 0.3);
  return gross - gross * feeRate - fixedFee;
}

function percent(n: number): number {
  return Math.round(n * 10_000) / 100;
}

function marginPercent(netRevenue: number, cost: number): number {
  return netRevenue > 0 ? percent((netRevenue - cost) / netRevenue) : -100;
}

export function planLimitsSnapshot(env: Env) {
  const freeMinutes = capMinutesForPlan(env, "free");
  const proMinutes = capMinutesForPlan(env, "pro");
  const maxMinutes = capMinutesForPlan(env, "max");
  return {
    // Free-tier cap kept under the historical key so existing consumers that
    // read `capMinutes`/`proListening*` don't break; per-tier fields are added.
    freeListeningMinutesPerMonth: freeMinutes,
    freeListeningHoursPerMonth: Math.round(freeMinutes / 60),
    proListeningMinutesPerMonth: proMinutes,
    proListeningHoursPerMonth: Math.round(proMinutes / 60),
    maxListeningMinutesPerMonth: maxMinutes,
    maxListeningHoursPerMonth: Math.round(maxMinutes / 60),
    freeAiCallsPerMonth: aiCallsForPlan(env, "free"),
    proAiCallsPerMonth: aiCallsForPlan(env, "pro"),
    maxAiCallsPerMonth: aiCallsForPlan(env, "max")
  };
}

export function economicsSnapshot(env: Env) {
  const aiCostUsdPerCall = numberVar(env.AI_COST_USD_PER_CALL, 0.002);
  const transcriptionCostUsdPerMinute = PROVIDER_COST_USD_PER_MIN.openai;
  const planLimits = planLimitsSnapshot(env);

  const pricePoints = [
    { name: "pro-monthly", grossMrr: PRICE_PRO_MONTHLY },
    { name: "pro-yearly-normalized", grossMrr: PRICE_PRO_YEARLY / 12 },
    { name: "max-monthly", grossMrr: PRICE_MAX_MONTHLY },
    { name: "max-yearly-normalized", grossMrr: PRICE_MAX_YEARLY / 12 }
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
          grossMarginPercent: marginPercent(price.netMrr, totalCost)
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
    planLimits,
    pricePoints,
    scenarios
  };
}
