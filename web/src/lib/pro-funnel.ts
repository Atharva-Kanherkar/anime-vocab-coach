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

// ------------------------------------------------------------ Browser half
//
// Everything below runs in the page and must never throw: storage can be
// disabled, and analytics that breaks a checkout link is worse than none.

/** The subset of Storage these helpers use, so tests can pass a fake. */
export type ProStorage = Pick<Storage, "getItem" | "setItem">;

/** sessionStorage key for the surface that started this visit's journey. */
export const PRO_FROM_KEY = "avc_pro_from";
const SHOWN_KEY = (surface: ProSurface) => `avc_pro_shown:${surface}`;

function sessionStore(): ProStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** An allowlisted `?from=` surface, e.g. an extension prompt that opened /pricing. */
export function proSurfaceFromSearch(search: string): ProSurface | "" {
  try {
    return normalizeProSurface(new URLSearchParams(search).get("from"));
  } catch {
    return "";
  }
}

/** Remember the prompt a visitor clicked, so the checkout it leads to is credited to it. */
export function rememberProSurface(surface: ProSurface, store = sessionStore()): void {
  try {
    store?.setItem(PRO_FROM_KEY, surface);
  } catch {
    // ignore
  }
}

/**
 * The surface a checkout belongs to: the last Pro prompt clicked in this
 * session, else the page the checkout link is on.
 *
 * Credits the prompt that started the journey. A learner who taps "See Pro"
 * on the extension milestone and buys from /pricing is a milestone
 * conversion; counting it as a /pricing one would make every value moment
 * look like it never converts.
 */
export function checkoutSurface(fallback: ProSurface, store = sessionStore()): ProSurface {
  try {
    return normalizeProSurface(store?.getItem(PRO_FROM_KEY)) || fallback;
  } catch {
    return fallback;
  }
}

/** Fire-and-forget beacon, same transport as the pageview tracker. */
export function trackPro(event: ProFunnelEvent, surface: ProSurface): void {
  if (!isProFunnelEvent(event) || !isProSurface(surface)) return;
  try {
    const body = JSON.stringify({ kind: "feature", name: event, surface });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/track", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow
  }
}

/**
 * `pro_prompt_shown` for a prompt that is always on the page (the /app header,
 * the plan cards): once per surface per browser session, so a learner moving
 * between /app sections is one view, not ten. Returns whether it fired.
 */
export function trackProShownOnce(
  surface: ProSurface,
  store = sessionStore(),
  send: typeof trackPro = trackPro
): boolean {
  try {
    if (store?.getItem(SHOWN_KEY(surface))) return false;
    store?.setItem(SHOWN_KEY(surface), "1");
  } catch {
    // Storage off: still count it, at worst once per render.
  }
  send("pro_prompt_shown", surface);
  return true;
}

/** A click on a link that opens Dodo checkout directly. */
export function trackCheckoutClick(page: ProSurface, store = sessionStore(), send = trackPro): void {
  send("pro_prompt_clicked", page);
  send("pro_checkout_started", checkoutSurface(page, store));
}
