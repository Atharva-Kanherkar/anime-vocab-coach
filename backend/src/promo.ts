import type { Env } from "./index";
import { planLimitsSnapshot } from "./economics";

export function publicConfig(env: Env) {
  const planLimits = planLimitsSnapshot(env);
  return {
    // Baseline cap for a not-yet-signed-in viewer is the free tier; per-tier
    // caps are in planLimits and the real cap is returned per-user by /v1/session.
    capMinutes: planLimits.freeListeningMinutesPerMonth,
    planLimits,
    siteUrl: "https://animevocab.com"
  };
}
