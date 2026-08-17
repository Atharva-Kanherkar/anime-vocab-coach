"use client";

import { useEffect, useState } from "react";

export const VISITOR_COUNTRY_KEY = "av:visitor-country";

/**
 * ISO country of the visitor, from /api/geo (Cloudflare IP geolocation).
 * Returns null until known and for visitors whose country cannot be resolved,
 * so callers treat null as "show the USD default". The answer is cached per
 * tab: one fetch, no matter how many components display a price.
 *
 * Only a successful JSON body is cached. HTTP errors and network failures
 * leave the store empty so the next mount retries — a transient 5xx must not
 * pin the tab to USD for the rest of the session.
 */
export async function loadVisitorCountry(): Promise<string | null> {
  let cached: string | null = null;
  try {
    cached = sessionStorage.getItem(VISITOR_COUNTRY_KEY);
  } catch {
    // sessionStorage can throw (private browsing); fall through to fetch.
  }
  // "" is a cached "unknown" — stay on the USD default without refetching.
  if (cached !== null) {
    return cached || null;
  }

  let resolved: string | null = null;
  try {
    const res = await fetch("/api/geo", { cache: "no-store" });
    if (!res.ok) {
      // Don't cache HTTP errors — retry next mount.
      return null;
    }
    const data: { country?: string | null } = await res.json();
    resolved = data?.country ?? null;
  } catch {
    // Geo is progressive enhancement — on failure the USD default stands.
    return null;
  }
  try {
    sessionStorage.setItem(VISITOR_COUNTRY_KEY, resolved ?? "");
  } catch {
    // Cache miss next mount is fine.
  }
  return resolved;
}

export function useVisitorCountry(): string | null {
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // Microtask deferral: the state update must not land synchronously in
      // the effect (react-hooks/set-state-in-effect), and the server-rendered
      // USD default must hydrate untouched before the country swaps in.
      await Promise.resolve();
      const resolved = await loadVisitorCountry();
      if (resolved && !cancelled) setCountry(resolved);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return country;
}
