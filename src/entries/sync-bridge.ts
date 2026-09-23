// Content script on the hosted web app (animevocab.com). The signed-in page
// broadcasts a sync token via postMessage; we store it and ask the background
// to push. Kept dependency-free so it stays a tiny bundle on the site.
(function initSyncBridge() {
const bridgeWindow = window as Window & { __avcSyncBridgeLoaded?: boolean };
if (bridgeWindow.__avcSyncBridgeLoaded) return;
bridgeWindow.__avcSyncBridgeLoaded = true;

const ALLOWED_ORIGINS = new Set(["https://animevocab.com", "https://www.animevocab.com"]);

// Mirrors SIGN_OUT_SUPPRESSION_MS in lib/account-link. Kept as a literal rather
// than an import: importing that module would pull lib/storage (and the scoring
// tables behind it) into a bundle that runs on every animevocab.com page view.
// test/account-link.test.ts fails if the two drift apart.
const SIGN_OUT_SUPPRESSION_MS = 5 * 60 * 1000;

function pageOrigin(): string {
  return window.location.origin;
}

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.has(origin) || origin === pageOrigin();
}

/**
 * Announce presence, and say whether we already hold a sync token.
 *
 * The page cannot read extension storage, so without `linked` it can only
 * judge the link by its own token mint. When that mint failed it told the
 * learner the extension was not linked, while the extension was linked and
 * syncing on a token the background worker minted itself (issue #133).
 *
 * The announcement never waits on storage: presence goes out immediately, and
 * the linked flag follows in a second message if and when storage answers.
 */
function announceExtension(): void {
  const origin = pageOrigin();
  window.postMessage({ source: "avc-ext", type: "avc-ext-present" }, origin);
  window.postMessage({ source: "avc-ext", type: "avc-request-token" }, origin);
  try {
    chrome.storage.local.get(["syncToken"], (r) => {
      const linked = typeof r?.syncToken === "string" && r.syncToken.length > 0;
      window.postMessage({ source: "avc-ext", type: "avc-ext-present", linked }, origin);
    });
  } catch {
    // Storage unavailable (extension reloading): presence is already out, and
    // the page falls back to judging the link by its own token mint.
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !isAllowedOrigin(event.origin)) return;
  const data = event.data as {
    source?: string;
    type?: string;
    token?: string;
    profile?: { email?: string | null; name?: string | null; plan?: string | null } | null;
  } | null;
  if (!data || data.source !== "avc-web") return;

  if (data.type === "avc-ping-extension") {
    announceExtension();
    return;
  }

  if (data.type === "avc-sync-token") {
    const token = typeof data.token === "string" ? data.token : "";
    if (!token) return;
    // Profile is display-only (popup account status). Older web builds don't
    // send it; keep whatever we had rather than wiping it. `plan` is what lets
    // the popup name the tier instead of just saying "signed in" (#123).
    const p = data.profile;
    const plan = p?.plan;
    const syncProfile =
      p && typeof p === "object"
        ? {
            email: typeof p.email === "string" ? p.email : null,
            name: typeof p.name === "string" ? p.name : null,
            plan: plan === "free" || plan === "pro" || plan === "max" ? plan : null,
          }
        : undefined;
    const update: Record<string, unknown> = { syncToken: token };
    if (syncProfile !== undefined) update.syncProfile = syncProfile;
    update.relinkNeeded = false;
    update.syncAuthFailures = 0;
    chrome.storage.local.set(update, () => {
      chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {});
    });
    return;
  }

  if (data.type === "avc-sync-now") {
    chrome.runtime.sendMessage({ type: "avc-sync-now" }).catch(() => {});
    return;
  }

  // The learner saved extension settings on the site. Routine sync only pushes
  // (a pull there once reverted in-panel changes), so without an explicit pull
  // the next push overwrote the save and the site's settings never applied.
  if (data.type === "avc-settings-updated") {
    chrome.runtime.sendMessage({ type: "avc-pull-settings" }).catch(() => {});
    return;
  }

  if (data.type === "avc-sign-out") {
    // The user signed out on the site — immediately invalidate the extension's
    // stored credential instead of waiting for the token's TTL or the next 401.
    //
    // autoLinkSuppressedUntil (read by lib/storage's getAutoLinkSuppressedUntil)
    // holds the background worker's silent re-link off for a few minutes. Clerk
    // clears its cookie around this same moment, so a probe that raced it would
    // hand the credential straight back and undo the sign-out.
    chrome.storage.local.set({
      syncToken: "",
      syncProfile: null,
      relinkNeeded: false,
      syncAuthFailures: 0,
      syncStatus: { state: "idle", lastAttemptAt: null, lastSuccessAt: null, error: null },
      autoLinkSuppressedUntil: Date.now() + SIGN_OUT_SUPPRESSION_MS,
    });
  }
});

// React may mount after this script; the page will ping us back.
announceExtension();
})();
