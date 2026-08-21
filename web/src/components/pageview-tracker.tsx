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

  return null;
}
