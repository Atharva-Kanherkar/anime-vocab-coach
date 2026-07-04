"use client";

import { useEffect } from "react";
import { primeFxAudio } from "@/lib/fx-sounds";

/** Unlocks HTMLAudio on first user gesture so scroll SFX work (incl. iOS touch). */
export function FxAudioPrimer() {
  useEffect(() => {
    const prime = () => primeFxAudio();
    const opts: AddEventListenerOptions = { passive: true, capture: true };

    window.addEventListener("pointerdown", prime, opts);
    window.addEventListener("keydown", prime, opts);
    window.addEventListener("wheel", prime, opts);
    window.addEventListener("touchstart", prime, opts);
    window.addEventListener("touchend", prime, opts);

    return () => {
      window.removeEventListener("pointerdown", prime, opts);
      window.removeEventListener("keydown", prime, opts);
      window.removeEventListener("wheel", prime, opts);
      window.removeEventListener("touchstart", prime, opts);
      window.removeEventListener("touchend", prime, opts);
    };
  }, []);

  return null;
}
