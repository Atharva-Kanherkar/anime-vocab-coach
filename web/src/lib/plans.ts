// Plan entitlements: free | pro | max, with optional billing interval and expiry.
// Source of truth is Clerk publicMetadata; sync tokens + KV mirror it for the API Worker.

import { TIERS, type PlanId } from "@/lib/site";

export type { PlanId };
export type BillingInterval = "monthly" | "yearly";

export interface Entitlement {
  plan: PlanId;
  billingInterval: BillingInterval | null;
  /** ISO timestamp; null = no expiry (active paid sub or permanent grant). */
  planExpiresAt: string | null;
}

export const FREE_ENTITLEMENT: Entitlement = {
  plan: "free",
  billingInterval: null,
  planExpiresAt: null,
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "free" || value === "pro" || value === "max";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "yearly";
}

/** Parse Clerk publicMetadata (or any plain object) into an entitlement. */
export function parseEntitlement(metadata: unknown): Entitlement {
  if (!metadata || typeof metadata !== "object") return { ...FREE_ENTITLEMENT };
  const raw = metadata as Record<string, unknown>;
  const plan = isPlanId(raw.plan) ? raw.plan : "free";
  const billingInterval = isBillingInterval(raw.billingInterval) ? raw.billingInterval : null;
  let planExpiresAt: string | null = null;
  if (typeof raw.planExpiresAt === "string" && Number.isFinite(Date.parse(raw.planExpiresAt))) {
    planExpiresAt = new Date(Date.parse(raw.planExpiresAt)).toISOString();
  }
  return { plan, billingInterval, planExpiresAt };
}

/** Active plan after applying expiry (expired → free). */
export function effectivePlan(entitlement: Entitlement, now = Date.now()): PlanId {
  if (entitlement.plan === "free") return "free";
  if (entitlement.planExpiresAt) {
    const ends = Date.parse(entitlement.planExpiresAt);
    if (Number.isFinite(ends) && now >= ends) return "free";
  }
  return entitlement.plan;
}

export function aiCallsForPlan(plan: PlanId): number {
  return TIERS[plan].aiCallsPerMonth;
}

export function listeningMinutesForPlan(plan: PlanId): number {
  return TIERS[plan].listeningMinutes;
}

/** Clerk publicMetadata payload for a granted plan. */
export function entitlementToPublicMetadata(entitlement: Entitlement): Record<string, unknown> {
  return {
    plan: entitlement.plan,
    billingInterval: entitlement.billingInterval,
    planExpiresAt: entitlement.planExpiresAt,
  };
}

/** Three months from `now` (UTC), for the early-adopter Max gift. */
export function giftMaxExpiresAt(now = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() + 3);
  return d.toISOString();
}

export function maxGiftEntitlement(now = new Date()): Entitlement {
  return {
    plan: "max",
    billingInterval: "monthly",
    planExpiresAt: giftMaxExpiresAt(now),
  };
}

export function entitlementKey(userId: string): string {
  return `entitlement:user:${userId}:v1`;
}
