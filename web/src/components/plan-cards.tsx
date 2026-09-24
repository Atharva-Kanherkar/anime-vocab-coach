"use client";

import { useEffect, useRef } from "react";
import { TIERS, checkoutFor, installUrl, type CheckoutInterval } from "@/lib/site";
import { localizedMonthlyLabel } from "@/lib/localized-pricing";
import { PLAN_ORDER } from "@/lib/pricing-page";
import { trackCheckoutClick, trackProShownOnce, type ProSurface } from "@/lib/pro-funnel";

/** Billing interval switch. Callers hide it for countries with localized
 * pricing, where Dodo has monthly rules only. */
export function BillingToggle({
  interval,
  onChange,
  variant,
}: {
  interval: CheckoutInterval;
  onChange: (interval: CheckoutInterval) => void;
  variant?: "app";
}) {
  return (
    <div
      className={"billing-toggle" + (variant === "app" ? " billing-toggle--app" : "")}
      role="group"
      aria-label="Billing interval"
    >
      <button
        type="button"
        className={interval === "monthly" ? "is-active" : ""}
        aria-pressed={interval === "monthly"}
        onClick={() => onChange("monthly")}
      >
        Monthly
      </button>
      <button
        type="button"
        className={interval === "yearly" ? "is-active" : ""}
        aria-pressed={interval === "yearly"}
        onClick={() => onChange("yearly")}
      >
        Yearly <span className="billing-toggle__save">save ~38%</span>
      </button>
    </div>
  );
}

/**
 * The Free / Pro / Max price cards. Shared by the homepage pricing slide and
 * /pricing so the two surfaces can never advertise different prices, perks, or
 * checkout links.
 *
 * `interval` must already be resolved to the effective one (monthly in
 * localized countries); `country` drives the regional label per card.
 * `surface` is the Pro funnel label for this placement (#162).
 */
export function PlanCards({
  interval,
  country,
  localized,
  perkLimit,
  className,
  surface,
}: {
  surface: ProSurface;
  interval: CheckoutInterval;
  country: string | null;
  /** True when the visitor's country has a Dodo localized monthly rule. */
  localized: boolean;
  /** Show only the first N perks (the homepage slide has fixed height). */
  perkLimit?: number;
  className?: string;
}) {
  // Shown means seen. The homepage mounts every slide at once, so counting on
  // mount would credit the pricing slide with every visitor to the site.
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = grid.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackProShownOnce(surface);
          io.disconnect();
        }
      },
      // Low on purpose: stacked on a phone the grid is taller than the screen.
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [surface]);

  return (
    <div ref={grid} className={"price-grid price-grid--three" + (className ? ` ${className}` : "")}>
      {PLAN_ORDER.map((id) => {
        const tier = TIERS[id];
        const isPro = id === "pro";
        const url = id === "free" ? null : checkoutFor(id, interval);
        const regional = localizedMonthlyLabel(id, country);
        const amount =
          id === "free"
            ? tier.priceLabel
            : localized && regional
              ? regional
              : interval === "yearly" && tier.yearlyLabel
                ? tier.yearlyLabel
                : tier.priceLabel;
        // The alternate interval, as a secondary line. Hidden in localized
        // countries: their yearly price is the USD one, which is worse than
        // twelve localized months, so showing it would read as a penalty.
        const sub =
          id === "free" || localized
            ? null
            : interval === "yearly"
              ? tier.priceLabel
              : tier.yearlyLabel ?? null;
        const perks = perkLimit ? tier.perks.slice(0, perkLimit) : tier.perks;

        return (
          <div key={id} className={"price-card" + (isPro ? " price-card-pro" : "")}>
            {isPro && <span className="pro-tag">Popular</span>}
            <h3>{tier.name}</h3>
            <p className="amount-row">
              <span className="amount">{amount}</span>
              {sub && <span className="price-sub">or {sub}</span>}
            </p>
            <ul>
              {perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
            {id === "free" ? (
              <a className="btn btn-line" href={installUrl()} rel="noopener noreferrer">
                Add to Chrome
              </a>
            ) : url ? (
              <a
                className="btn btn-accent"
                href={url}
                rel="noopener noreferrer"
                onClick={() => trackCheckoutClick(surface)}
              >
                Get {tier.name}
              </a>
            ) : (
              <span
                className="btn btn-accent"
                aria-disabled="true"
                style={{ opacity: 0.6, cursor: "default" }}
              >
                {tier.name} coming soon
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
