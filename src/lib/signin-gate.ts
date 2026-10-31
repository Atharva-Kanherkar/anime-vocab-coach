// The free-account gate (#206).
//
// The extension has no login of its own. A non-empty sync token is the whole
// definition of "signed in": the web app mints it and the background worker can
// mint it too (lib/account-link). Everything in this module is pure so the gate
// rules can be tested without a browser, and the learner-facing copy can be
// pinned by a test instead of by review.

/** Local storage key: the learner closed the in-page sign-in chip. */
export const SIGNIN_CHIP_DISMISSED_KEY = "signinChipDismissed";

/** Local storage key: show the one-time update explanation in the popup. */
export const SIGNIN_UPGRADE_NOTICE_KEY = "signinUpgradeNotice";

/** Session storage keys for the return path after sign-in. */
export const SIGNIN_RETURN_TAB_KEY = "signinReturnTab";
export const SIGNIN_START_TAB_KEY = "signinStartTab";
export const SIGNIN_SURFACE_KEY = "signinSurface";

/** First build with the account gate. An update from below it needs the
 *  one-time "your words now live in your free account" explanation. */
export const ACCOUNT_GATE_VERSION = "0.7.2";

/**
 * Account status is the token, not a profile. The profile is display-only and
 * can lag or be missing; the token is the credential every request uses.
 */
export function isSignedIn(token: unknown): boolean {
  return typeof token === "string" && token.length > 0;
}

export interface SigninChipInput {
  signedIn: boolean;
  /** The learner already dismissed the chip on this profile. */
  dismissed: boolean;
  /** Only the top frame mounts the chip, so an iframe player cannot double it. */
  topFrame: boolean;
  /** A video element, or a large player iframe whose document we cannot read. */
  hasPlayer: boolean;
  /** The learner turned this site off in settings. */
  siteEnabled: boolean;
}

/** Whether the in-page sign-in chip should be mounted right now. */
export function shouldShowSigninChip(input: SigninChipInput): boolean {
  return (
    !input.signedIn &&
    !input.dismissed &&
    input.topFrame &&
    input.hasPlayer &&
    input.siteEnabled
  );
}

/**
 * True for a Chrome manifest version below the account gate.
 *
 * Chrome versions are one to four dot-separated integers. Anything that is not
 * that shape is treated as "not older", so a malformed previousVersion cannot
 * make every update show the migration notice.
 */
export function isBeforeAccountGate(version: string): boolean {
  if (!/^\d+(\.\d+){0,3}$/.test(version)) return false;
  const parts = version.split(".").map((p) => Number(p));
  if (!parts.length || parts.some((n) => !Number.isInteger(n) || n < 0)) return false;
  const [major = 0, minor = 0, patch = 0] = parts;
  if (major !== 0) return false;
  if (minor !== 7) return minor < 7;
  return patch < 2;
}

/** The hosted sign-in page, tagged with the surface that sent the learner. */
export function signinStartPath(from: string): string {
  return `/start?from=${encodeURIComponent(from)}`;
}

/**
 * Learner-facing copy. The house style forbids em and en dashes in anything
 * people read; test/signin-gate.test.ts pins every string here.
 */
export const SIGNIN_GATE_COPY = {
  chipTitle: "Sign in to start learning with this episode",
  chipNote: "Free account. Your words, reviews and progress stay with you.",
  chipCta: "Sign in",
  chipBusy: "Opening sign-in...",
  chipDismiss: "Dismiss sign-in reminder",
  popupEyebrow: "FREE ACCOUNT",
  popupTitle: "Sign in to start learning",
  popupNote:
    "Your words, reviews and progress live in your free AnimeVocab account, on every device.",
  popupCta: "Sign in",
  popupFine: "Free forever. No card.",
  upgradeNote: "Your words now live in your free account. Sign in to keep them.",
  startTitle: "Start learning with the anime you already watch",
  startNote: "One free account keeps your words, reviews and progress on every device.",
  startCta: "Sign in with Google or email",
  startFine: "Free forever. No card.",
  signedInTitle: "You're in",
  signedInNote: "The extension is connected. Open a supported site and start watching.",
} as const;

/** Refusal for `avc-listen-start` while signed out. Names the fix. */
export const LISTEN_SIGNIN_REQUIRED =
  "Listening needs a free account. Sign in at animevocab.com/start, then try again.";
