"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

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

// ── Page-load singleton controller ──────────────────────────────────────────
// Three components mount useExtensionLink() on /app. The old hook ran the full
// effect per instance — each with its own 2s ping interval, message listener,
// and token broadcast. The extension answers every ping with two messages and
// each reply minted a brand-new KV-backed sync token, so one open tab produced
// up to ~18 token mints every 2 seconds. That burned the free-tier KV write
// budget in minutes (the outages) and forced the Cloudflare paid upgrade.
//
// This controller runs ONCE per page load no matter how many components mount
// the hook. It stops pinging the instant the extension answers, and broadcasts
// the sync token only once per load (the 20-min refresh aside). Combined with
// the server-side idempotent-per-user token, mints drop from ~18/2s to ~1/load.
let controllerStarted = false;
let pingTimer: number | null = null;
let missingTimer: number | null = null;
let tokenBroadcast = false;

function stopPinging(): void {
  if (pingTimer !== null) {
    window.clearInterval(pingTimer);
    pingTimer = null;
  }
}

function startPinging(): void {
  if (pingTimer !== null) return;
  pingExtension();
  pingTimer = window.setInterval(() => {
    // Once linked there is nothing left to detect — stop, don't ping forever.
    if (linkState === "installed") {
      stopPinging();
      return;
    }
    pingExtension();
  }, 2000);
}

function scheduleMissingCheck(): void {
  if (missingTimer !== null) window.clearTimeout(missingTimer);
  missingTimer = window.setTimeout(() => {
    if (linkState === "checking") setLinkState("missing");
  }, 8000);
}

async function broadcastToken(force = false): Promise<void> {
  // Once per page load: repeated extension signals must not each mint a token.
  // `force` is used only by the periodic refresh to keep a fresh, TTL'd token.
  if (tokenBroadcast && !force) return;
  tokenBroadcast = true;
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
    tokenBroadcast = false; // allow a later attempt (retry, or the next refresh)
    if (linkState === "installed") setLinkState("error");
  }
}

function markInstalled(): void {
  if (missingTimer !== null) {
    window.clearTimeout(missingTimer);
    missingTimer = null;
  }
  stopPinging(); // the extension answered — no reason to keep pinging
  setLinkState("installed");
  void broadcastToken();
}

function isExtensionSignal(type: string | undefined): boolean {
  return type === "avc-request-token" || type === "avc-ext-present";
}

function onExtensionMessage(e: MessageEvent): void {
  if (e.source !== window || e.origin !== window.location.origin) return;
  const data = e.data as { source?: string; type?: string } | null;
  if (data?.source === "avc-ext" && isExtensionSignal(data.type)) {
    markInstalled();
  }
}

function startController(): void {
  if (controllerStarted) return;
  controllerStarted = true;

  // One listener, one ping loop, one refresh — shared by every hook consumer.
  window.addEventListener("message", onExtensionMessage);
  startPinging();
  scheduleMissingCheck();

  // Long-interval refresh keeps the extension's token fresh (and, with the new
  // server-side TTL, alive). One mint per 20 minutes is not the runaway loop.
  window.setInterval(() => {
    if (linkState === "installed") void broadcastToken(true);
  }, 20 * 60 * 1000);
}

/** Detects the Chrome extension and keeps its sync token fresh. */
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

  useEffect(() => {
    // The controller is intentionally page-load scoped (shared by every hook
    // consumer) with no per-mount teardown — that is precisely what stops the
    // N-components → N-intervals → N-mints fan-out that caused the outages.
    startController();
  }, []);

  const retry = useCallback(() => {
    setLinkState("checking");
    tokenBroadcast = false;
    startPinging();
    scheduleMissingCheck();
  }, []);

  return {
    installed: state === "installed",
    state,
    retry,
  };
}
