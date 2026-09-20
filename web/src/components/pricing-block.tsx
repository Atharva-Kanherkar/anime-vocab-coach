"use client";

import { useState } from "react";
import { hasLocalizedPricing } from "@/lib/localized-pricing";
import type { CheckoutInterval } from "@/lib/site";
import { useVisitorCountry } from "@/lib/use-visitor-country";
import { BillingToggle, PlanCards } from "@/components/plan-cards";

export function PricingBlock() {
  const [billingInterval, setBillingInterval] = useState<CheckoutInterval>("monthly");
  const country = useVisitorCountry();
  // Dodo has monthly rules only for these countries, so yearly (which would be
  // the USD price, worse than 12 localized months) is hidden, not advertised.
  const localized = hasLocalizedPricing(country);
  const effectiveInterval: CheckoutInterval = localized ? "monthly" : billingInterval;

  return (
    <>
      {localized ? (
        <p className="hero__body" style={{ fontSize: "0.85em", opacity: 0.85 }}>
          Prices shown for your region. You&apos;ll see the same price at checkout.
        </p>
      ) : (
        <BillingToggle interval={billingInterval} onChange={setBillingInterval} />
      )}
      <PlanCards
        interval={effectiveInterval}
        country={country}
        localized={localized}
        perkLimit={3}
        className="hero__pricing"
      />
    </>
  );
}
