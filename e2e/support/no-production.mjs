// Keep e2e runs off production (ISO 25010 audit, 2026-10).
//
// The extension under test talks to animevocab.com on its own: telemetry
// beacons, a background account-link attempt, usage reads. Unrouted, every run
// of these suites wrote test traffic into the real funnel and owner dashboard.
// This answers those hosts locally the way production answers a signed-out
// browser: beacons get 204, everything else 401.
//
// Register it right after creating the context. Playwright gives the most
// recently registered matching route precedence, so a suite's own routes for
// specific endpoints still win.
const PROD = /^https:\/\/(www\.|api\.)?animevocab\.com\//;
const BEACONS = /\/api\/(extension\/track|ending\/track|track)$/;

export async function keepOffProduction(ctx, { log = false } = {}) {
  const seen = [];
  await ctx.route(PROD, (route) => {
    const url = new URL(route.request().url());
    seen.push(`${route.request().method()} ${url.host}${url.pathname}`);
    if (log) console.log("   [offline-prod]", route.request().method(), url.host + url.pathname);
    if (BEACONS.test(url.pathname)) return route.fulfill({ status: 204, body: "" });
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "unauthorized" }),
    });
  });
  return seen;
}

/** Chrome args that send the production hosts nowhere at the DNS layer, so a
 * request made before keepOffProduction() is registered (the extension's
 * install-time account-link probe) fails fast instead of reaching the site. */
export const NO_PRODUCTION_ARGS = [
  "--host-resolver-rules=MAP animevocab.com 127.0.0.1:1,MAP www.animevocab.com 127.0.0.1:1,MAP api.animevocab.com 127.0.0.1:1",
];
