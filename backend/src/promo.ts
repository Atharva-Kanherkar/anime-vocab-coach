import type { Env } from "./index";

const PRO_REGULAR = { monthlyUsd: 10, yearlyUsd: 84, label: "$10/month or $84/year" };
const PRO_PROMO = { monthlyUsd: 7, yearlyUsd: 59, label: "$7/month or $59/year" };

export function promoState(env: Env, now = Date.now()) {
  const ends = Date.parse(env.PROMO_END_UTC || "1970-01-01T00:00:00.000Z");
  const active = now < ends;
  const daysLeft = active ? Math.max(0, Math.ceil((ends - now) / 86400000)) : 0;
  return {
    active,
    endsAt: env.PROMO_END_UTC,
    daysLeft,
    checkoutUrl: active && env.PROMO_CHECKOUT_URL ? env.PROMO_CHECKOUT_URL : env.CHECKOUT_URL,
    priceLabel: active ? PRO_PROMO.label : PRO_REGULAR.label,
    regularLabel: PRO_REGULAR.label,
    promoLabel: PRO_PROMO.label,
    capMinutes: Number(env.CAP_MINUTES)
  };
}

export function publicConfig(env: Env) {
  const promo = promoState(env);
  return {
    promo,
    checkoutUrl: promo.checkoutUrl,
    capMinutes: promo.capMinutes,
    planLimits: {
      proListeningMinutesPerMonth: Number(env.CAP_MINUTES),
      freeAiCallsPerMonth: Number(env.FREE_AI_CALLS_PER_MONTH || 5),
      proAiCallsPerMonth: Number(env.PRO_AI_CALLS_PER_MONTH || 300)
    },
    siteUrl: "https://animevocab.com"
  };
}
