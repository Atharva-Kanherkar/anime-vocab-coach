"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "av:visitor-country";

/**
 * ISO country of the visitor, from /api/geo (Cloudflare IP geolocation).
 * Returns null until known and for visitors whose country cannot be resolved,
 * so callers treat null as "show the USD default". The answer is cached per
 * tab: one fetch, no matter how many components display a price.
 */
export function useVisitorCountry(): string | null {
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // Microtask deferral: the state update must not land synchronously in
      // the effect (react-hooks/set-state-in-effect), and the server-rendered
      // USD default must hydrate untouched before the country swaps in.
      await Promise.resolve();

      let cached: string | null = null;
      try {
        cached = sessionStorage.getItem(STORAGE_KEY);
      } catch {
        // sessionStorage can throw (private browsing); fall through to fetch.
      }
      // "" is a cached "unknown" — stay on the USD default without refetching.
      if (cached !== null) {
        if (cached && !cancelled) setCountry(cached);
        return;
      }

      let resolved: string | null = null;
      try {
        const res = await fetch("/api/geo");
        const data: { country?: string | null } | null = res.ok ? await res.json() : null;
        resolved = data?.country ?? null;
      } catch {
        // Geo is progressive enhancement — on failure the USD default stands.
        return;
      }
      try {
        sessionStorage.setItem(STORAGE_KEY, resolved ?? "");
      } catch {
        // Cache miss next mount is fine.
      }
      if (resolved && !cancelled) setCountry(resolved);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return country;
}
