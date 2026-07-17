"use client";

import { useMemo, useState } from "react";
import {
  DODO_CUSTOMER_PORTAL_URL,
  SITE_URL,
  TIERS,
  checkoutFor,
  checkoutWithContext,
  type CheckoutInterval,
  type PlanId,
} from "@/lib/site";
import type { BillingInterval } from "@/lib/plans";

export type BillingPanelProps = {
  plan: PlanId;
  billingInterval: BillingInterval | null;
  planExpiresAt: string | null;
  email: string | null;
};

function planTitle(plan: PlanId): string {
  return TIERS[plan].name;
}

function intervalLabel(interval: BillingInterval | null): string | null {
  if (interval === "yearly") return "Yearly";
  if (interval === "monthly") return "Monthly";
  return null;
}

function giftLabel(planExpiresAt: string | null): string | null {
  if (!planExpiresAt) return null;
  const t = Date.parse(planExpiresAt);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BillingPanel({
  plan,
  billingInterval,
  planExpiresAt,
  email,
}: BillingPanelProps) {
  const [interval, setInterval] = useState<CheckoutInterval>("yearly");
  const giftUntil = giftLabel(planExpiresAt);
  const isGift = plan !== "free" && !!planExpiresAt;
  const isPaid = plan !== "free" && !planExpiresAt;

  const upgradeTargets = useMemo(() => {
    const ids: PlanId[] = [];
    if (plan === "free") ids.push("pro", "max");
    else if (plan === "pro") ids.push("max");
    return ids;
  }, [plan]);

  const redirectUrl = `${SITE_URL}/app#billing`;

  return (
    <section className="av-card p-6 sm:p-8" aria-label="Billing">
      <p className="av-eyebrow">Billing</p>
      <h2 className="mt-2 font-jpround text-[clamp(22px,3vw,28px)] font-black leading-tight">
        Your plan
      </h2>
      <p className="mt-2 max-w-[52ch] text-sm text-ink2">
        Upgrade here, or manage payment method and cancellation in the Dodo customer portal.
      </p>

      <div className="mt-6 border-2 border-ink bg-bg px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-jpround text-xl font-black">{planTitle(plan)}</p>
          {isPaid && intervalLabel(billingInterval) && (
            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink2">
              {intervalLabel(billingInterval)}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink2">
          {plan === "free" && "Free tier — full extension, capped AI + Listening Mode."}
          {isPaid &&
            (billingInterval === "yearly" && TIERS[plan].yearlyLabel
              ? `Billed yearly at ${TIERS[plan].yearlyLabel}.`
              : billingInterval === "monthly"
                ? `Billed monthly at ${TIERS[plan].priceLabel}.`
                : `Active ${TIERS[plan].name} subscription.`)}
          {isGift && giftUntil && `Complimentary Max access until ${giftUntil}.`}
        </p>
        <ul className="mt-3 grid gap-1.5 text-sm text-ink2">
          {TIERS[plan].perks.slice(0, 3).map((perk) => (
            <li key={perk}>· {perk}</li>
          ))}
        </ul>
      </div>

      {upgradeTargets.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="av-eyebrow mb-0">Upgrade</h3>
            <div className="billing-toggle billing-toggle--app" role="group" aria-label="Billing interval">
              <button
                type="button"
                className={interval === "monthly" ? "is-active" : ""}
                aria-pressed={interval === "monthly"}
                onClick={() => setInterval("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={interval === "yearly" ? "is-active" : ""}
                aria-pressed={interval === "yearly"}
                onClick={() => setInterval("yearly")}
              >
                Yearly <span className="billing-toggle__save">save ~38%</span>
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {upgradeTargets.map((id) => {
              const tier = TIERS[id];
              const base = checkoutFor(id, interval);
              const href = base
                ? checkoutWithContext(base, { email, redirectUrl })
                : null;
              const price =
                interval === "yearly" && tier.yearlyLabel ? tier.yearlyLabel : tier.priceLabel;
              return (
                <div key={id} className="border-2 border-ink bg-panel p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-jpround text-lg font-black">{tier.name}</h4>
                    <span className="text-sm font-extrabold">{price}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink2">{tier.blurb}</p>
                  <ul className="mt-3 grid gap-1 text-sm text-ink2">
                    {tier.perks.slice(0, 2).map((perk) => (
                      <li key={perk}>· {perk}</li>
                    ))}
                  </ul>
                  {href ? (
                    <a
                      className="av-btn av-btn-primary mt-4 inline-flex"
                      href={href}
                      rel="noopener noreferrer"
                    >
                      Get {tier.name}
                    </a>
                  ) : (
                    <span className="mt-4 inline-block text-sm text-ink2">{tier.name} coming soon</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {plan === "max" && !isGift && (
        <p className="mt-6 text-sm text-ink2">You&apos;re on Max — thanks for supporting AnimeVocab.</p>
      )}

      <div className="mt-8 border-t-2 border-ink pt-6">
        <h3 className="av-eyebrow">Manage subscription</h3>
        <p className="mt-2 max-w-[52ch] text-sm text-ink2">
          Cancel, update your card, or download invoices in Dodo&apos;s customer portal
          {email ? ` (sign in with ${email})` : ""}.
        </p>
        <a
          className="av-btn av-btn-ghost mt-4 inline-flex"
          href={DODO_CUSTOMER_PORTAL_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open customer portal
        </a>
      </div>
    </section>
  );
}
