// PostHog analytics for extension pages (popup, dashboard, options).
// posthog-js/dist/module.no-external avoids external script loading, which is
// required for Chrome Web Store CSP compliance.
import posthog from "posthog-js/dist/module.no-external";

// Injected by esbuild define at build time from environment variables.
declare const POSTHOG_TOKEN: string;
declare const POSTHOG_HOST: string;

const AID_KEY = "_avc_aid";

async function getOrCreateAnalyticsId(): Promise<string> {
  const r = await chrome.storage.local.get([AID_KEY]);
  if (r[AID_KEY]) return r[AID_KEY] as string;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [AID_KEY]: id });
  return id;
}

let _initialized = false;

/**
 * Initialize PostHog for an extension page. Call once per page at boot.
 * Uses a stable UUID stored in chrome.storage.local so popup/dashboard/options
 * all share the same anonymous distinct ID.
 */
export async function initAnalytics(): Promise<void> {
  if (_initialized || !POSTHOG_TOKEN) return;
  _initialized = true;

  const id = await getOrCreateAnalyticsId();
  posthog.init(POSTHOG_TOKEN, {
    api_host: POSTHOG_HOST,
    defaults: "2026-05-30",
    bootstrap: { distinctID: id, isIdentifiedID: false },
    // Extension pages don't have meaningful URLs for pageview tracking.
    capture_pageview: false,
  });

  // Identify signed-in users by their sync profile — PII goes into person
  // properties only, never into event properties.
  const data = await chrome.storage.local.get(["syncProfile"]);
  const profile = data.syncProfile as { email?: string; name?: string } | undefined;
  if (profile?.email || profile?.name) {
    posthog.identify(id, {
      ...(profile.email ? { email: profile.email } : {}),
      ...(profile.name ? { name: profile.name } : {}),
    });
  }
}

export { posthog };
