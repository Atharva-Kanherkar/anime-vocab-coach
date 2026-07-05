import type { Env } from "./index";
import { planLimitsSnapshot } from "./economics";

export function publicConfig(env: Env) {
  const planLimits = planLimitsSnapshot(env);
  return {
    capMinutes: planLimits.proListeningMinutesPerMonth,
    planLimits,
    siteUrl: "https://animevocab.com"
  };
}
