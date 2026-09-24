"use client";

import { useEffect, useState } from "react";
import { BillingToggle, PlanCards } from "@/components/plan-cards";
import { hasLocalizedPricing } from "@/lib/localized-pricing";
import { useVisitorCountry } from "@/lib/use-visitor-country";
import type { CheckoutInterval } from "@/lib/site";
import { proSurfaceFromSearch, rememberProSurface } from "@/lib/pro-funnel";

/**
 * The /pricing plan block: interval toggle plus the shared price cards.
 *
 * Renders monthly USD on the server and swaps in the regional price once
 * /api/geo answers, so the page is still correct (just not yet localized) for
 * crawlers and for visitors whose country cannot be resolved.
 */
export function PricingPlans() {
  const [interval, setInterval] = useState<CheckoutInterval>("monthly");
  const country = useVisitorCountry();
  // Dodo has monthly localized rules only, so the yearly toggle is hidden
  // rather than shown at a USD price that beats none of them.
  const localized = hasLocalizedPricing(country);
  const effectiveInterval: CheckoutInterval = localized ? "monthly" : interval;

  // A prompt elsewhere (the extension, /app) that sent the visitor here keeps
  // the credit for whatever checkout follows (#162).
  useEffect(() => {
    const from = proSurfaceFromSearch(window.location.search);
    if (from) rememberProSurface(from);
  }, []);

  return (
    <>
      {localized ? (
        <p className="price-ownership-note">
          Prices shown for your region. You will see the same price at checkout.
        </p>
      ) : (
        <BillingToggle interval={interval} onChange={setInterval} />
      )}
      <PlanCards surface="pricing" interval={effectiveInterval} country={country} localized={localized} />
    </>
  );
}
