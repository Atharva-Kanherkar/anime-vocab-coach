"use client";

import { useEffect } from "react";
import { heroMobileImage, preloadHeroImages } from "@/lib/hero-images";
import type { HeroSlide } from "@/lib/slides";

export function HeroImagePreloader({ slides }: { slides: HeroSlide[] }) {
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const first = slides.slice(0, 3).flatMap((s) => {
      if (!s.image) return [];
      return mobile ? [heroMobileImage(s.image)!, s.image] : [s.image];
    });
    preloadHeroImages(first);

    const idle =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback
        : (cb: IdleRequestCallback) => window.setTimeout(cb, 400);

    const cancel =
      typeof cancelIdleCallback !== "undefined"
        ? cancelIdleCallback
        : (id: number) => window.clearTimeout(id);

    const id = idle(() => {
      const rest = slides.slice(3).flatMap((s) => {
        if (!s.image) return [];
        return mobile ? [heroMobileImage(s.image)!] : [s.image];
      });
      preloadHeroImages(rest);
    });

    return () => cancel(id as number);
  }, [slides]);

  return null;
}
