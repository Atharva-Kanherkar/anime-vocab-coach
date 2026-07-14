"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

// When the user signs out on the site, tell the extension's sync-bridge content
// script to drop its stored sync token immediately (rather than waiting for the
// token TTL or the next 401). Must be rendered inside <ClerkProvider>.
export function ExtensionSignoutBridge(): null {
  const { isSignedIn } = useAuth();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (isSignedIn) {
      wasSignedIn.current = true;
    } else if (isSignedIn === false && wasSignedIn.current) {
      wasSignedIn.current = false;
      window.postMessage({ source: "avc-web", type: "avc-sign-out" }, window.location.origin);
    }
  }, [isSignedIn]);

  return null;
}
