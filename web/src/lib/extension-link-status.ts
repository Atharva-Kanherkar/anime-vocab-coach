/**
 * The decisions behind the /app connection banner, kept out of the DOM-bound
 * hook so they can be tested and reasoned about directly.
 *
 * Two facts drive the banner and they are independent (issue #133):
 *
 *   presence  - has the extension answered this page's ping?
 *   token     - did this page load manage to mint a sync token?
 *
 * They used to be one value, so a failed mint rendered "Could not link
 * extension" at a learner whose extension was linked and syncing happily on a
 * token it minted itself in the background worker. A mint failure is a real
 * thing to report, but it is not a broken link.
 */

/** Has the extension announced itself on this page? */
export type PresenceState = "checking" | "installed" | "missing";

export type TokenState = "idle" | "ok" | "failed";

export type TokenErrorKind =
  /** 401: no session on this site any more. Retrying cannot fix it. */
  | "signed_out"
  /** 5xx: the mint endpoint or its KV store is having a moment. Retrying can. */
  | "unavailable"
  /** Any other HTTP status, named so the next report is actionable. */
  | "http"
  /** fetch threw: offline, blocked, or the request never left the page. */
  | "network";

export interface TokenError {
  kind: TokenErrorKind;
  /** HTTP status when there was a response; null when fetch threw. */
  status: number | null;
  /** Learner-facing sentence. Says what happened and what fixes it. */
  message: string;
}

/** Classify a mint failure. `status` is null when fetch itself threw. */
export function tokenErrorFor(status: number | null): TokenError {
  if (status === 401) {
    return {
      kind: "signed_out",
      status,
      message: "Your session on this site expired. Sign in again to refresh the extension's sync token.",
    };
  }
  if (status === null) {
    return {
      kind: "network",
      status,
      message: "Could not reach the sync service from this page. Check your connection or any blocker, then retry.",
    };
  }
  if (status >= 500) {
    return {
      kind: "unavailable",
      status,
      message: `Sync service is temporarily unavailable (${status}). Retrying automatically.`,
    };
  }
  return {
    kind: "http",
    status,
    message: `Refreshing the sync token failed (HTTP ${status}). Retry, and tell us the status if it keeps happening.`,
  };
}

/**
 * Automatic retry budget. A brief 5xx should clear itself rather than leaving
 * the learner staring at a banner, but every attempt is a KV round-trip, so the
 * budget is small and a signed-out session gets none: no amount of retrying
 * mints a token without a session, and #123 is a standing reminder of what a
 * loose retry loop costs here.
 */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000];

export function shouldAutoRetry(error: TokenError, attemptsMade: number): boolean {
  if (error.kind === "signed_out") return false;
  return attemptsMade < RETRY_DELAYS_MS.length;
}

/** Delay before retry number `attemptsMade` (0-based), or undefined when spent. */
export function retryDelayMs(attemptsMade: number): number | undefined {
  return RETRY_DELAYS_MS[attemptsMade];
}

export interface ConnectionView {
  /** "ok" healthy, "warn" connected but something needs saying, "off" neither. */
  tone: "ok" | "warn" | "off";
  label: string;
  /** The specific problem, when there is one. Rendered next to the label. */
  detail: string | null;
  /** Whether to offer the retry affordance. */
  canRetry: boolean;
  /** Whether to offer the install-help link. */
  showInstallHelp: boolean;
}

export interface ConnectionInput {
  presence: PresenceState;
  tokenState: TokenState;
  tokenError: TokenError | null;
  /**
   * Whether the extension told us it already holds a sync token. Undefined for
   * builds that predate the field, and then it stays unknown rather than false.
   */
  extensionLinked?: boolean;
  /** Words in the cloud snapshot, for the connected label. */
  syncedWords?: number;
}

/**
 * What the banner should say. The one case that earns "Could not link
 * extension" is the one the copy always claimed: the extension never answered
 * AND the token handshake failed.
 */
export function connectionView(input: ConnectionInput): ConnectionView {
  const { presence, tokenState, tokenError, extensionLinked, syncedWords } = input;

  if (presence === "installed") {
    const words = syncedWords && syncedWords > 0
      ? ` · ${syncedWords.toLocaleString("en-US")} words synced`
      : " · ready while you watch";
    // The extension says it holds a token, so the link is live whatever this
    // page's own mint did. Nothing to alarm the learner with.
    if (extensionLinked && tokenState === "failed") {
      return {
        tone: "ok",
        label: `Extension connected${words}`,
        detail: "This page could not refresh the token, but the extension is already linked and syncing.",
        canRetry: true,
        showInstallHelp: false,
      };
    }
    if (tokenState === "failed" && tokenError) {
      return {
        tone: "warn",
        label: "Extension connected",
        detail: tokenError.message,
        canRetry: true,
        showInstallHelp: false,
      };
    }
    return {
      tone: "ok",
      label: `Extension connected${words}`,
      detail: null,
      canRetry: false,
      showInstallHelp: false,
    };
  }

  if (presence === "missing") {
    return {
      tone: "off",
      label: "Extension not installed yet",
      detail: null,
      canRetry: false,
      showInstallHelp: true,
    };
  }

  // Still checking. A failed mint here means the handshake never completed:
  // no extension answered and no token was minted, which is the only state
  // that has ever deserved the "could not link" copy.
  if (tokenState === "failed" && tokenError) {
    return {
      tone: "warn",
      label: "Could not link extension",
      detail: tokenError.message,
      canRetry: true,
      showInstallHelp: false,
    };
  }
  return {
    tone: "off",
    label: "Checking for extension…",
    detail: null,
    canRetry: false,
    showInstallHelp: false,
  };
}
