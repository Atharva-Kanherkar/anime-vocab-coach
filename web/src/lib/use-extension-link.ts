"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  retryDelayMs,
  shouldAutoRetry,
  tokenErrorFor,
  type PresenceState,
  type TokenError,
  type TokenState,
} from "./extension-link-status";

/** Kept for callers that still read `state`; "error" is no longer produced. */
type LinkState = PresenceState | "error";

// Presence and token health are tracked apart (issue #133). Collapsing them
// meant a failed mint rendered "Could not link extension" at a learner whose
// extension was linked and syncing on a token it minted itself.
let presenceState: PresenceState = "checking";
let tokenState: TokenState = "idle";
let tokenError: TokenError | null = null;
/** What the extension told us about its own token, when it told us. */
let extensionLinked: boolean | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  refreshSnapshot();
  listeners.forEach((l) => l());
}

function setPresence(next: PresenceState): void {
  if (presenceState === next) return;
  presenceState = next;
  emit();
}

function setToken(state: TokenState, error: TokenError | null): void {
  if (tokenState === state && tokenError?.message === error?.message) return;
  tokenState = state;
  tokenError = error;
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
    if (presenceState === "installed") {
      stopPinging();
      return;
    }
    pingExtension();
  }, 2000);
}

function scheduleMissingCheck(): void {
  if (missingTimer !== null) window.clearTimeout(missingTimer);
  missingTimer = window.setTimeout(() => {
    if (presenceState === "checking") setPresence("missing");
  }, 8000);
}

/** Retries already spent on the current failure. Reset by a success or a
 * fresh user-initiated attempt, so a later transient blip gets its own budget. */
let retryAttempts = 0;
let retryTimer: number | null = null;
/** One mint in flight at a time: the #123 storm is not to be reintroduced. */
let mintInFlight = false;

function cancelRetry(): void {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/** A transient failure should clear itself rather than leave a banner up. */
function scheduleRetry(error: TokenError): void {
  if (!shouldAutoRetry(error, retryAttempts)) return;
  const delay = retryDelayMs(retryAttempts);
  if (delay === undefined) return;
  retryAttempts += 1;
  cancelRetry();
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    tokenBroadcast = false;
    void broadcastToken();
  }, delay);
}

async function broadcastToken(force = false): Promise<void> {
  // Once per page load: repeated extension signals must not each mint a token.
  // `force` is used only by the periodic refresh to keep a fresh, TTL'd token.
  if (tokenBroadcast && !force) return;
  if (mintInFlight) return;
  tokenBroadcast = true;
  mintInFlight = true;
  // Status is carried out of the try so the failure can be classified by what
  // actually happened instead of collapsing into one unexplained banner.
  let status: number | null = null;
  try {
    const res = await fetch("/api/sync/token", { method: "POST" });
    status = res.status;
    if (!res.ok) throw new Error(`token HTTP ${res.status}`);
    // plan rides along so the extension popup can name the tier; it has always
    // been in the response, and the extension now stores it (#123).
    const { token, profile } = (await res.json()) as {
      token?: string;
      profile?: { email?: string | null; name?: string | null; plan?: string | null };
    };
    if (!token) throw new Error("no token");
    window.postMessage(
      { source: "avc-web", type: "avc-sync-token", token, profile: profile ?? null },
      window.location.origin
    );
    retryAttempts = 0;
    cancelRetry();
    setToken("ok", null);
  } catch {
    tokenBroadcast = false; // allow a later attempt (retry, or the next refresh)
    // A 200 that carried no token is a broken response, not an HTTP failure.
    const error = tokenErrorFor(status !== null && status >= 200 && status < 300 ? 500 : status);
    setToken("failed", error);
    scheduleRetry(error);
  } finally {
    mintInFlight = false;
  }
}

function markInstalled(): void {
  if (missingTimer !== null) {
    window.clearTimeout(missingTimer);
    missingTimer = null;
  }
  stopPinging(); // the extension answered — no reason to keep pinging
  setPresence("installed");
  void broadcastToken();
}

function isExtensionSignal(type: string | undefined): boolean {
  return type === "avc-request-token" || type === "avc-ext-present";
}

function onExtensionMessage(e: MessageEvent): void {
  if (e.source !== window || e.origin !== window.location.origin) return;
  const data = e.data as { source?: string; type?: string; linked?: unknown } | null;
  if (data?.source === "avc-ext" && isExtensionSignal(data.type)) {
    // Newer extension builds say whether they already hold a sync token. An
    // older build sends nothing, and that stays unknown rather than false.
    if (typeof data.linked === "boolean") {
      if (extensionLinked !== data.linked) {
        extensionLinked = data.linked;
        emit();
      }
    }
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
    if (presenceState === "installed") void broadcastToken(true);
  }, 20 * 60 * 1000);
}

export function notifyExtensionLinkSignedIn(): void {
  // Clerk can complete sign-in without a full page reload. If the first token
  // request ran while signed out it returned 401, stopped the ping loop, and
  // left this page stuck in "Could not link" forever. A signed-in transition
  // is authoritative: reopen detection and allow exactly one fresh token POST.
  startController();
  tokenBroadcast = false;
  retryAttempts = 0;
  cancelRetry();
  setToken("idle", null);
  setPresence("checking");
  startPinging();
  scheduleMissingCheck();
}

export interface ExtensionLink {
  installed: boolean;
  /** Presence only. Never reports a token failure; read `tokenState` for that. */
  state: LinkState;
  tokenState: TokenState;
  tokenError: TokenError | null;
  /** What the extension said about its own token, or undefined if it did not. */
  extensionLinked: boolean | undefined;
  retry: () => void;
}

/** One immutable snapshot per change, so useSyncExternalStore can compare it. */
let snapshot: Omit<ExtensionLink, "retry"> = {
  installed: false,
  state: "checking",
  tokenState: "idle",
  tokenError: null,
  extensionLinked: undefined,
};

function refreshSnapshot(): void {
  snapshot = {
    installed: presenceState === "installed",
    state: presenceState,
    tokenState,
    tokenError,
    extensionLinked,
  };
}

const SERVER_SNAPSHOT: Omit<ExtensionLink, "retry"> = {
  installed: false,
  state: "checking",
  tokenState: "idle",
  tokenError: null,
  extensionLinked: undefined,
};

/** Detects the Chrome extension and keeps its sync token fresh. */
export function useExtensionLink(): ExtensionLink {
  const current = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => SERVER_SNAPSHOT
  );

  useEffect(() => {
    // The controller is intentionally page-load scoped (shared by every hook
    // consumer) with no per-mount teardown — that is precisely what stops the
    // N-components → N-intervals → N-mints fan-out that caused the outages.
    startController();
  }, []);

  const retry = useCallback(() => {
    // A deliberate retry gets a fresh budget and always attempts once, whatever
    // the automatic backoff had decided.
    retryAttempts = 0;
    cancelRetry();
    tokenBroadcast = false;
    setToken("idle", null);
    if (presenceState !== "installed") {
      setPresence("checking");
      startPinging();
      scheduleMissingCheck();
    } else {
      void broadcastToken();
    }
  }, []);

  return { ...current, retry };
}
