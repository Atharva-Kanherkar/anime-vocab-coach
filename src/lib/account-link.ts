// Silent extension↔account link.
//
// The original handshake only ever ran on animevocab.com/app: the page minted a
// sync token and postMessage'd it to the content script. So a learner who
// installed from the Web Store, was already signed in, and never happened to
// open /app stayed local-only — cloud sync, Listening Mode metering and the AI
// coach all invisible (#123).
//
// This module closes that gap from the other side. The extension holds
// `https://animevocab.com/*` host permission, so the *background worker* can
// call the mint endpoint itself with the browser's own session cookie. Signed in
// on this Chrome profile → linked, no page and no click. Signed out → a 401 and
// nothing changes, which is exactly the local-only state we already had.
//
// Must run in the background worker: /api/* on animevocab.com sends no
// Access-Control-Allow-Origin, so a content script's fetch would fail preflight.
import { WEB_URL } from "../config";
import type { SyncPlan } from "../types";
import {
  getAutoLinkAttemptedAt,
  getAutoLinkSuppressedUntil,
  getSyncToken,
  normalizeSyncPlan,
  setAutoLinkAttemptedAt,
  setSyncProfile,
  setSyncToken,
} from "./storage";
import { log, warn } from "./log";

const TOKEN_URL = WEB_URL + "/api/sync/token";

/** Background attempts are throttled this far apart. Each attempt is a KV write
 * on the server (the token is idempotent per user, but its TTL is refreshed), and
 * an unattended mint loop has cost this project real money before. */
export const AUTO_LINK_COOLDOWN_MS = 60 * 60 * 1000;

/** After a sign-out on animevocab.com, stay away from the mint endpoint for a
 * while. Clerk clears its cookie around the same moment the sign-out bridge
 * fires; a probe that raced it would re-link the browser the user just signed
 * out of, which reads as the extension ignoring them. */
export const SIGN_OUT_SUPPRESSION_MS = 5 * 60 * 1000;

/** Tier label for a linked account. Empty when the account did not report one:
 * guessing "Free" at somebody paying for Max is worse than saying nothing. */
export function planLabel(plan: SyncPlan | null | undefined): string {
  return plan === "max" ? "Max" : plan === "pro" ? "Pro" : plan === "free" ? "Free" : "";
}

/**
 * Account-status wording, shared by the popup row and the onboarding page so
 * the two surfaces cannot drift into saying different things about the same
 * state. Kept in one constant so the house style rule (no em or en dashes in
 * anything people read) is pinned by a test instead of by review.
 */
export const ACCOUNT_COPY = {
  checkingTitle: "Checking this browser…",
  checkingNote: "Looking for a signed-in animevocab.com session.",
  linkedTitle: "Connected",
  notLinkedTitle: "Not connected",
  notLinkedNote: "Your words stay on this device only.",
  connect: "Connect account",
  connecting: "Connecting…",
  reconnect: "Reconnect account",
  linkedNote: (who: string) => `Signed in as ${who}. Your words sync automatically.`,
  /** Stand-in when the mint endpoint gave us neither an email nor a name. */
  unnamedAccount: "your account",
  openApp: "Open your cloud app",
  /** Popup-only: it distinguishes a fresh install from an expired session. */
  popupNotSignedIn: "Not signed in",
  popupNotSignedInNote: "Progress stays on this device only",
  popupExpired: "Sign-in expired",
  popupExpiredNote: "Re-link to resume cloud sync",
} as const;

export interface AutoLinkGateInput {
  /** Already linked — there is nothing to mint. */
  hasToken: boolean;
  now: number;
  lastAttemptAt: number | null;
  suppressedUntil: number | null;
  /** The user asked for this (popup button, onboarding button): skip the
   * cooldown, but not the sign-out suppression or the already-linked check. */
  force: boolean;
}

/** Whether a link attempt may hit the network right now. Pure, so the throttle
 * rules are testable without a browser. */
export function shouldAttemptAutoLink(input: AutoLinkGateInput): boolean {
  if (input.hasToken) return false;
  if (input.suppressedUntil != null && input.now < input.suppressedUntil) return false;
  if (input.force) return true;
  if (input.lastAttemptAt == null) return true;
  // A stamp in the future means the clock moved backwards (DST, NTP correction,
  // a restored profile). Treat it as stale rather than locking the user out of
  // linking until real time catches up.
  if (input.lastAttemptAt > input.now) return true;
  return input.now - input.lastAttemptAt >= AUTO_LINK_COOLDOWN_MS;
}

export interface LinkedProfile {
  email: string | null;
  name: string | null;
  plan: SyncPlan | null;
}

export type MintOutcome =
  | { status: "linked"; token: string; profile: LinkedProfile }
  /** No animevocab.com session on this Chrome profile. Not an error: it is the
   * ordinary state for someone who has not signed up yet. */
  | { status: "signed-out" }
  | { status: "error"; detail: string };

interface MintBody {
  token?: unknown;
  profile?: { email?: unknown; name?: unknown; plan?: unknown } | null;
}

/** Map one mint response to an outcome. Pure — the caller owns the fetch. */
export function interpretMintResponse(httpStatus: number, body: unknown): MintOutcome {
  if (httpStatus === 401 || httpStatus === 403) return { status: "signed-out" };
  if (httpStatus < 200 || httpStatus >= 300) return { status: "error", detail: `HTTP ${httpStatus}` };

  const data = (body || {}) as MintBody;
  const token = typeof data.token === "string" ? data.token : "";
  // A 200 with no token means the endpoint changed shape under us. Storing an
  // empty credential would read as "linked" everywhere and sync nothing.
  if (!token) return { status: "error", detail: "no token in response" };

  const p = data.profile && typeof data.profile === "object" ? data.profile : {};
  return {
    status: "linked",
    token,
    profile: {
      email: typeof p.email === "string" ? p.email : null,
      name: typeof p.name === "string" ? p.name : null,
      plan: normalizeSyncPlan(p.plan),
    },
  };
}

export interface AutoLinkResult {
  /** True only when this call moved the extension from unlinked to linked. */
  linked: boolean;
  outcome: MintOutcome["status"] | "already-linked" | "throttled";
}

// Install, startup, the popup and the onboarding page can all ask at once. One
// mint is enough for all of them, and the forced ones skip the cooldown — so
// share the in-flight attempt rather than firing three requests at KV.
let inFlight: Promise<AutoLinkResult> | null = null;

/**
 * Try to link this browser to its signed-in animevocab.com account.
 *
 * Never throws and never surfaces an error to the user: a failure just leaves
 * the extension local-only, which is where it already was.
 */
export function attemptAutoLink(
  trigger: string,
  options: { force?: boolean } = {}
): Promise<AutoLinkResult> {
  if (inFlight) return inFlight;
  const attempt = runAutoLink(trigger, options).finally(() => {
    inFlight = null;
  });
  inFlight = attempt;
  return attempt;
}

async function runAutoLink(
  trigger: string,
  options: { force?: boolean } = {}
): Promise<AutoLinkResult> {
  const force = options.force === true;
  const [hasToken, lastAttemptAt, suppressedUntil] = await Promise.all([
    getSyncToken().then((t) => !!t),
    getAutoLinkAttemptedAt(),
    getAutoLinkSuppressedUntil(),
  ]);

  if (hasToken) return { linked: false, outcome: "already-linked" };
  if (!shouldAttemptAutoLink({ hasToken, now: Date.now(), lastAttemptAt, suppressedUntil, force })) {
    return { linked: false, outcome: "throttled" };
  }

  // Stamp before the request, not after: a hung fetch must still spend the
  // cooldown, or a flaky network turns into a retry loop.
  await setAutoLinkAttemptedAt(Date.now());

  let outcome: MintOutcome;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => null);
    outcome = interpretMintResponse(res.status, body);
  } catch (err) {
    outcome = { status: "error", detail: err instanceof Error ? err.message : "network error" };
  }

  if (outcome.status !== "linked") {
    if (outcome.status === "error") warn(`auto-link (${trigger}) failed:`, outcome.detail);
    return { linked: false, outcome: outcome.status };
  }

  // setSyncToken clears relinkNeeded and the 401 counter; the profile write is a
  // merge so a missing field cannot blank what the page already told us.
  await setSyncToken(outcome.token);
  await setSyncProfile(outcome.profile);
  log(`auto-link (${trigger}) ok`);
  return { linked: true, outcome: "linked" };
}
