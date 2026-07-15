// Subscription tiers and their server-enforced listening/AI caps.
//
// The user's plan travels on the sync-token profile (written by the web app
// from Clerk `publicMetadata.plan` when the token is minted), so the Worker can
// enforce per-tier caps without talking to Clerk on every request. An unknown
// or missing plan is always treated as "free" — the safe, cheapest tier.

import type { Env } from "./index";

export type Plan = "free" | "pro" | "max";

export function normalizePlan(value: unknown): Plan {
  return value === "pro" || value === "max" ? value : "free";
}

/** Apply gift expiry stamped on the sync-token profile (expired → free). */
export function effectivePlanFromProfile(
  profile: { plan?: unknown; planExpiresAt?: string | null },
  now = Date.now()
): Plan {
  const plan = normalizePlan(profile.plan);
  if (plan === "free") return "free";
  if (profile.planExpiresAt) {
    const ends = Date.parse(profile.planExpiresAt);
    if (Number.isFinite(ends) && now >= ends) return "free";
  }
  return plan;
}

/** Parse an env var as a number, falling back to a sane default when unset or
 * malformed. Using the raw `Number(env.X)` silently disabled caps (NaN) when a
 * var was missing or typo'd — always go through here. */
export function numberVar(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim();
  const n = trimmed ? Number(trimmed) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Monthly listening-minute cap for a plan. CAP_MINUTES is the free-tier
 * default (kept for back-compat); pro/max read their own vars. */
export function capMinutesForPlan(env: Env, plan: Plan): number {
  if (plan === "pro") return numberVar(env.PRO_CAP_MINUTES, 1200);
  if (plan === "max") return numberVar(env.MAX_CAP_MINUTES, 3600);
  return numberVar(env.CAP_MINUTES, 480);
}

/** Monthly AI-call cap for a plan. */
export function aiCallsForPlan(env: Env, plan: Plan): number {
  if (plan === "pro") return numberVar(env.PRO_AI_CALLS_PER_MONTH, 150);
  if (plan === "max") return numberVar(env.MAX_AI_CALLS_PER_MONTH, 600);
  return numberVar(env.FREE_AI_CALLS_PER_MONTH, 40);
}
