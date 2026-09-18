"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  attributionFromSearch,
  isPublicLandingPath,
  ownedCampaignForPath,
  type FunnelAttribution,
} from "@/lib/funnel-attribution";

const ATTRIBUTION_KEY = "avc_funnel_attribution";
const LANDING_KEY = "avc_landing_view_sent";
const CWS_HOST = "chromewebstore.google.com";

function sessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage can be disabled; analytics must never affect navigation.
  }
}

function sendFeature(name: string, attribution: FunnelAttribution): void {
  const body = JSON.stringify({
    kind: "feature",
    name,
    utm_source: attribution.utmSource,
    utm_medium: attribution.utmMedium,
    utm_campaign: attribution.utmCampaign,
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    // fall through
  }
  void fetch("/api/track", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

function readAttribution(): FunnelAttribution {
  const current = attributionFromSearch(window.location.search);
  if (current.utmSource || current.utmMedium || current.utmCampaign) {
    sessionSet(ATTRIBUTION_KEY, JSON.stringify(current));
    return current;
  }
  try {
    const stored = JSON.parse(sessionGet(ATTRIBUTION_KEY) || "{}") as Partial<FunnelAttribution>;
    return {
      utmSource: stored.utmSource || "",
      utmMedium: stored.utmMedium || "",
      utmCampaign: stored.utmCampaign || "",
    };
  } catch {
    return { utmSource: "", utmMedium: "", utmCampaign: "" };
  }
}

/**
 * First-party pageview beacon.
 *
 * App-router client navigations never re-run a server component, so pageviews
 * after the first are invisible without a pathname effect like this one.
 *
 * Deliberately minimal: no cookie, no device id, no cross-site pixel. The
 * server derives country/city/device from the Cloudflare request, and identity
 * from the existing session — so this sends only the path and the referrer.
 *
 * The referrer has to travel in the body. The server used to read the `Referer`
 * header of this very beacon, which is always a page on our own domain, so
 * every pageview ever recorded reported animevocab.com as its own referrer and
 * acquisition attribution was uniformly self-referential. `document.referrer`
 * is the real one, and only on the first page of a visit; internal navigations
 * report the previous page on our own origin, which the server drops.
 */
export function PageviewTracker() {
  const pathname = usePathname();
  // React 18 StrictMode double-invokes effects in dev; without this the local
  // numbers are 2x and every debugging session starts with a false alarm.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastSent.current === pathname) return;
    // Only the first beacon of a visit can carry a real external referrer; on
    // a client-side navigation document.referrer is still the original
    // document's, which would re-attribute every later pageview to the same
    // source and inflate it.
    const isFirstOfVisit = lastSent.current === null;
    lastSent.current = pathname;

    const body = JSON.stringify({
      kind: "pageview",
      name: pathname,
      referrer: isFirstOfVisit ? document.referrer || "" : "",
    });
    // sendBeacon survives the unload that a normal fetch loses, and never
    // delays navigation. keepalive fetch is the fallback for older Safari.
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        return;
      }
    } catch {
      // fall through
    }
    void fetch("/api/track", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (!pathname) return;
    const attribution = readAttribution();
    if (isPublicLandingPath(pathname) && !sessionGet(LANDING_KEY)) {
      sessionSet(LANDING_KEY, "1");
      sendFeature("landing_view", attribution);
    }

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      let destination: URL;
      try {
        destination = new URL(anchor.href);
      } catch {
        return;
      }
      if (destination.hostname !== CWS_HOST) return;
      destination.searchParams.set("utm_source", "animevocab");
      destination.searchParams.set("utm_medium", "website");
      destination.searchParams.set("utm_campaign", ownedCampaignForPath(pathname));
      anchor.href = destination.toString();
      sendFeature("store_cta_click", attribution);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  return null;
}
