"use client";

// Client half of the funnel analytics: fires the allowlisted server-side
// counters (/api/ending/track, sendBeacon so navigation never loses one) and
// mirrors key steps to the Meta pixel for ad optimization.

import { useEffect, useRef } from "react";
import type { EndingEvent } from "@/lib/ending-funnel";

export function trackFunnel(event: EndingEvent): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ event });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/ending/track", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/ending/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    // analytics must never break the funnel
  }
}

/** Fire one funnel event when the page mounts (page-view style events). */
export function FunnelTracker({ event }: { event: EndingEvent }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackFunnel(event);
  }, [event]);
  return null;
}
