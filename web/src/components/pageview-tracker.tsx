"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * First-party pageview beacon.
 *
 * App-router client navigations never re-run a server component, so pageviews
 * after the first are invisible without a pathname effect like this one.
 *
 * Deliberately minimal: no cookie, no device id, no cross-site pixel. The
 * server derives country/city/device from the Cloudflare request, and identity
 * from the existing session — so this sends only the path.
 */
export function PageviewTracker() {
  const pathname = usePathname();
  // React 18 StrictMode double-invokes effects in dev; without this the local
  // numbers are 2x and every debugging session starts with a false alarm.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastSent.current === pathname) return;
    lastSent.current = pathname;

    const body = JSON.stringify({ kind: "pageview", name: pathname });
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

  return null;
}
