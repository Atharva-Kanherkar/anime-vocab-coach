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

async function broadcastToken(): Promise<void> {
  try {
    const res = await fetch("/api/sync/token", { method: "POST" });
    if (!res.ok) throw new Error(`token HTTP ${res.status}`);
    const { token } = (await res.json()) as { token?: string };
    if (!token) throw new Error("no token");
    window.postMessage({ source: "avc-web", type: "avc-sync-token", token }, window.location.origin);
  } catch {
    if (linkState === "installed") setLinkState("error");
  }
}

function markInstalled(): void {
  setLinkState("installed");
  void broadcastToken();
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

  const scheduleMissingCheck = useCallback(() => {
    if (missingTimer.current) window.clearTimeout(missingTimer.current);
    missingTimer.current = window.setTimeout(() => {
      if (linkState === "checking") setLinkState("missing");
    }, 2500);
  }, []);

  const retry = useCallback(() => {
    setLinkState("checking");
    scheduleMissingCheck();
    void broadcastToken();
  }, [scheduleMissingCheck]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; type?: string } | null;
      if (data?.source === "avc-ext" && data.type === "avc-request-token") {
        if (missingTimer.current) window.clearTimeout(missingTimer.current);
        markInstalled();
      }
    };
    window.addEventListener("message", onMessage);
    scheduleMissingCheck();

    const refreshTimer = window.setInterval(() => {
      if (linkState === "installed") void broadcastToken();
    }, 20 * 60 * 1000);

    return () => {
      window.removeEventListener("message", onMessage);
      if (missingTimer.current) window.clearTimeout(missingTimer.current);
      window.clearInterval(refreshTimer);
    };
  }, [scheduleMissingCheck]);

  return {
    installed: state === "installed",
    state,
    retry,
  };
}
