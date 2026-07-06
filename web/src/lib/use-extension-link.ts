"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type LinkState = "linking" | "linked" | "error";

let linkState: LinkState = "linking";
const listeners = new Set<() => void>();

function setLinkState(next: LinkState): void {
  if (linkState === next) return;
  linkState = next;
  listeners.forEach((l) => l());
}

async function broadcastToken(): Promise<void> {
  try {
    const res = await fetch("/api/sync/token", { method: "POST" });
    if (!res.ok) throw new Error(`token HTTP ${res.status}`);
    const { token } = (await res.json()) as { token?: string };
    if (!token) throw new Error("no token");
    window.postMessage({ source: "avc-web", type: "avc-sync-token", token }, window.location.origin);
    setLinkState("linked");
  } catch {
    setLinkState("error");
  }
}

/** Keeps the extension linked and returns whether a sync token was handed off. */
export function useExtensionLink(): { linked: boolean; state: LinkState; retry: () => void } {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => linkState,
    () => "linking" as LinkState
  );

  const retry = useCallback(() => {
    setLinkState("linking");
    void broadcastToken();
  }, []);

  useEffect(() => {
    const kick = window.setTimeout(() => void broadcastToken(), 0);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; type?: string } | null;
      if (data?.source === "avc-ext" && data.type === "avc-request-token") void broadcastToken();
    };
    window.addEventListener("message", onMessage);
    const timer = window.setInterval(() => void broadcastToken(), 20 * 60 * 1000);
    return () => {
      window.clearTimeout(kick);
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
  }, []);

  return { linked: state === "linked", state, retry };
}
