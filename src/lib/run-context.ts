/**
 * Which extension context is this code running in?
 *
 * The distinction that matters is network privilege. A content script runs at
 * the WATCHED PAGE's origin (youtube.com), so a request to animevocab.com from
 * there is cross-origin and CORS-checked — and animevocab.com sends no
 * Access-Control-Allow-Origin, so the preflight is answered and the real
 * request never happens. Nothing throws in a way anyone notices: the beacon is
 * simply gone. The service worker runs at the extension's own origin, with
 * animevocab.com in host_permissions, where the same request is allowed.
 *
 * So every beacon is sent from the service worker, and every other context
 * relays a message to it. e2e/learning-loop.mjs measures this against a real
 * server rather than trusting the reasoning: the page's main world is the
 * control, and both it and the content script are blocked.
 */
export function inServiceWorker(): boolean {
  // `window` is the cheapest reliable discriminator: an MV3 service worker has
  // no DOM global at all, while content scripts and extension pages do.
  return typeof window === "undefined";
}
