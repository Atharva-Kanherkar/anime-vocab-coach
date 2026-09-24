// The Pro funnel: shown → clicked → checkout, per surface (#162).
//
// Every upgrade prompt that existed before this fired only at a limit, and
// nobody reaches a limit, so the offer was invisible. The prompts added for
// #162 sit at value moments instead, and the question that decides whether
// they work is "which surface turns a view into a checkout". That needs the
// surface on every row, which the old `extension_funnel` counters never had.
//
// The surface list is an allowlist for the same reason the event names are
// (track-events.ts): it becomes a GROUP BY label on /owner, and the beacon is
// unauthenticated input.

export const PRO_FUNNEL_EVENTS = [
  "pro_prompt_shown",
  "pro_prompt_clicked",
  "pro_checkout_started",
] as const;

export type ProFunnelEvent = (typeof PRO_FUNNEL_EVENTS)[number];

/**
 * Where a Pro prompt lives.
 *
 * MIRROR of PRO_SURFACES in src/lib/feature-events.ts for the `ext_` half.
 * The server writes "" for anything not listed, so a surface that drifts in
 * the extension is counted but never attributed; test/feature-events.test.ts
 * pins the two lists.
 */
export const PRO_SURFACES = [
  // Website
  "app_header",
  "app_unlock",
  "app_billing",
  "pricing",
  "home",
  // Extension
  "ext_popup",
  "ext_milestone",
  "ext_popup_limit",
  "ext_limit_sheet",
] as const;

export type ProSurface = (typeof PRO_SURFACES)[number];

const EVENT_SET = new Set<string>(PRO_FUNNEL_EVENTS);
const SURFACE_SET = new Set<string>(PRO_SURFACES);

export function isProFunnelEvent(value: unknown): value is ProFunnelEvent {
  return typeof value === "string" && EVENT_SET.has(value);
}

export function isProSurface(value: unknown): value is ProSurface {
  return typeof value === "string" && SURFACE_SET.has(value);
}

/** An allowlisted surface, or "" for anything else. Exact match only. */
export function normalizeProSurface(raw: unknown): ProSurface | "" {
  return isProSurface(raw) ? raw : "";
}
