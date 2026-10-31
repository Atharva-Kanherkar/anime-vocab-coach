// The sign-in gate funnel (#206): shown -> started -> completed, per surface.
//
// The gate is the first thing a signed-out learner sees, and the metric that
// decides whether it works is "which surface turns a view into a completed
// sign-in". That needs the surface on every row.
//
// Both lists are allowlists for the same reason the Pro funnel's are: they
// become GROUP BY labels on /owner, and the beacon is unauthenticated input.

export const SIGNIN_FUNNEL_EVENTS = [
  "signin_gate_shown",
  "signin_started",
  "signin_completed",
  "signin_gate_dismissed",
] as const;

export type SigninFunnelEvent = (typeof SIGNIN_FUNNEL_EVENTS)[number];

/**
 * Where a sign-in gate lives.
 *
 * MIRROR of SIGNIN_SURFACES in src/lib/feature-events.ts. The server writes ""
 * for anything not listed, so a surface that drifts in the extension is counted
 * but never attributed; test/signin-events.test.ts pins the two lists.
 */
export const SIGNIN_SURFACES = [
  "content_chip",
  "popup",
  "start_page",
  // Completion surfaces for a link the learner did not start from a gate.
  "install",
  "startup",
] as const;

export type SigninSurface = (typeof SIGNIN_SURFACES)[number];

const EVENT_SET = new Set<string>(SIGNIN_FUNNEL_EVENTS);
const SURFACE_SET = new Set<string>(SIGNIN_SURFACES);

export function isSigninFunnelEvent(value: unknown): value is SigninFunnelEvent {
  return typeof value === "string" && EVENT_SET.has(value);
}

export function isSigninSurface(value: unknown): value is SigninSurface {
  return typeof value === "string" && SURFACE_SET.has(value);
}

/** An allowlisted surface, or "" for anything else. Exact match only. */
export function normalizeSigninSurface(raw: unknown): SigninSurface | "" {
  return isSigninSurface(raw) ? raw : "";
}
