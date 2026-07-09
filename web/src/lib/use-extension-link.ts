"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

type LinkState = "checking" | "installed" | "missing" | "error";

let linkState: LinkState = "checking";
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function setLinkState(next: LinkState): void {
  if (linkState === next) return;
  linkState = next;
  emit();
}

function pingExtension(): void {
  window.postMessage({ source: "avc-web", type: "avc-ping-extension" }, window.location.origin);
}

async function broadcastToken(): Promise<void> {
  try {
    const res = await fetch("/api/sync/token", { method: "POST" });
    if (!res.ok) throw new Error(`token HTTP ${res.status}`);
    const { token, profile } = (await res.json()) as {
      token?: string;
      profile?: { email?: string | null; name?: string | null };
    };
    if (!token) throw new Error("no token");
    window.postMessage(
      { source: "avc-web", type: "avc-sync-token", token, profile: profile ?? null },
      window.location.origin
    );
  } catch {
    if (linkState === "installed") setLinkState("error");
  }
}

function markInstalled(): void {
  setLinkState("installed");
  void broadcastToken();
}

function isExtensionSignal(type: string | undefined): boolean {
  return type === "avc-request-token" || type === "avc-ext-present";
}

/** Detects the Chrome extension and keeps sync token fresh. */
export function useExtensionLink(): {
  installed: boolean;
  state: LinkState;
  retry: () => void;
} {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => linkState,
    () => "checking" as LinkState
  );

  const missingTimer = useRef<number | null>(null);
  const pingTimer = useRef<number | null>(null);

  const clearMissingTimer = useCallback(() => {
    if (missingTimer.current) {
      window.clearTimeout(missingTimer.current);
      missingTimer.current = null;
    }
  }, []);

  const scheduleMissingCheck = useCallback(() => {
    clearMissingTimer();
    missingTimer.current = window.setTimeout(() => {
      if (linkState === "checking") setLinkState("missing");
    }, 8000);
  }, [clearMissingTimer]);

  const retry = useCallback(() => {
    setLinkState("checking");
    pingExtension();
    scheduleMissingCheck();
  }, [scheduleMissingCheck]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; type?: string } | null;
      if (data?.source === "avc-ext" && isExtensionSignal(data.type)) {
        clearMissingTimer();
        markInstalled();
      }
    };
    window.addEventListener("message", onMessage);

    pingExtension();
    pingTimer.current = window.setInterval(pingExtension, 2000);
    scheduleMissingCheck();

    const refreshTimer = window.setInterval(() => {
      if (linkState === "installed") void broadcastToken();
    }, 20 * 60 * 1000);

    return () => {
      window.removeEventListener("message", onMessage);
      clearMissingTimer();
      if (pingTimer.current) window.clearInterval(pingTimer.current);
      window.clearInterval(refreshTimer);
    };
  }, [clearMissingTimer, scheduleMissingCheck]);

  return {
    installed: state === "installed",
    state,
    retry,
  };
}
