// Plan entitlements: free | pro | max, with optional billing interval and expiry.
// Source of truth is Clerk publicMetadata; sync tokens mirror it for the API Worker.
//
// Field semantics (keep in sync with backend/src/plan.ts effectivePlanFromProfile):
//   plan            — the tier the user holds.
//   billingInterval — Dodo billing cycle; null for gifts and free.
//   planExpiresAt   — ISO end date for GIFTS only. Paid subscriptions are always
//                     null here (Dodo webhooks own their lifecycle), so an active
//                     paid sub can be recognized as plan !== free && planExpiresAt === null.

import type { PlanId } from "@/lib/site";

export type { PlanId };
export type BillingInterval = "monthly" | "yearly";

export interface Entitlement {
  plan: PlanId;
  billingInterval: BillingInterval | null;
  /** ISO timestamp; null = no expiry (active paid sub or free). Set only by gifts. */
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

/** Parse Clerk publicMetadata (or any plain object) into an entitlement.
 * A present-but-unparseable expiry fails CLOSED to free: corrupt gift metadata
 * must never become permanent paid access. */
export function parseEntitlement(metadata: unknown): Entitlement {
  if (!metadata || typeof metadata !== "object") return { ...FREE_ENTITLEMENT };
  const raw = metadata as Record<string, unknown>;
  const plan = isPlanId(raw.plan) ? raw.plan : "free";
  const billingInterval = isBillingInterval(raw.billingInterval) ? raw.billingInterval : null;
  let planExpiresAt: string | null = null;
  if (raw.planExpiresAt != null) {
    const t = typeof raw.planExpiresAt === "string" ? Date.parse(raw.planExpiresAt) : NaN;
    if (!Number.isFinite(t)) return { ...FREE_ENTITLEMENT };
    planExpiresAt = new Date(t).toISOString();
  }
  return { plan, billingInterval, planExpiresAt };
}

/** Active plan after applying expiry (expired or unparseable expiry → free). */
export function effectivePlan(entitlement: Entitlement, now = Date.now()): PlanId {
  if (entitlement.plan === "free") return "free";
  if (entitlement.planExpiresAt != null) {
    const ends = Date.parse(entitlement.planExpiresAt);
    if (!Number.isFinite(ends) || now >= ends) return "free";
  }
  return entitlement.plan;
}

/** True when the entitlement is an active paid subscription (Dodo-managed, no
 * gift expiry). Gifts must never overwrite these. */
export function isPaidSubscription(entitlement: Entitlement): boolean {
  return entitlement.plan !== "free" && entitlement.planExpiresAt === null;
}

/** Clerk publicMetadata patch for a granted plan. Clerk shallow-merges
 * publicMetadata and deletes keys set to null, so sending only these keys is
 * race-free against concurrent writers of unrelated keys. */
export function entitlementToPublicMetadata(entitlement: Entitlement): Record<string, unknown> {
  return {
    plan: entitlement.plan,
    billingInterval: entitlement.billingInterval,
    planExpiresAt: entitlement.planExpiresAt,
  };
}

/** Clerk publicMetadata patch for a Dodo billing event. Billing owns the plan:
 * it always clears any gift expiry (paid users are metered by their sub, and a
 * terminal event means free — never a resurrected gift). Pass billingInterval
 * on paid events when known from the product id (monthly vs yearly). */
export function billingMetadataPatch(
  plan: PlanId,
  billingInterval: BillingInterval | null = null
): Record<string, unknown> {
  return {
    plan,
    planExpiresAt: null,
    billingInterval: plan === "free" ? null : billingInterval,
  };
}

/** Three months from `now` (UTC), for the early-adopter Max gift. Month-end
 * dates clamp to the target month's last day (Nov 30 + 3mo → Feb 28/29), so a
 * gift is never longer than three calendar months. */
export function giftMaxExpiresAt(now = new Date()): string {
  const d = new Date(now.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 3);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString();
}

export function maxGiftEntitlement(now = new Date()): Entitlement {
  return {
    plan: "max",
    // A gift is not a billing relationship — never fabricate an interval.
    billingInterval: null,
    planExpiresAt: giftMaxExpiresAt(now),
  };
}
