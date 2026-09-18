// Allowlist + normalization for the first-party analytics beacon.
//
// Both exist to bound CARDINALITY. Analytics Engine groups by blob value, so
// an unnormalized path (/app/cards/<uuid>) or a free-text event name turns
// every row into its own group and makes the dashboard useless — and lets any
// visitor write arbitrary strings into the owner's telemetry.

/**
 * The learning loop itself: what a learner does inside the product.
 *
 * Named separately from the rest of the allowlist because the /owner panel and
 * the weekly "cards accepted per active learner" metric are about THESE, and
 * nothing else. `feature` rows also carry acquisition events (`landing_view`,
 * `store_cta_click`) and the anime-context cache probe, and folding those into
 * a learning-loop panel would put a marketing click next to a card review and
 * invite the reader to compare them.
 */
export const LEARNING_LOOP_EVENTS = [
  "card_shown",
  "card_known",
  "card_learn",
  "word_saved",
  "review_done",
  "listening_started",
  "streak_day",
  "card_unlocked",
  "install_first_run",
  "extension_linked",
] as const;

export type LearningLoopEvent = (typeof LEARNING_LOOP_EVENTS)[number];

/**
 * Feature invocations worth a row. Anything not listed is dropped.
 *
 * The learning-loop block is the one the product is actually judged on: until
 * it was wired up (#111) `avc_events` only ever held `api` and `pageview`
 * rows, so "cards are not working" was a hypothesis with no data behind it.
 * Those names are fired by the extension (src/lib/feature-events.ts) and by
 * the sync route, not by the website, which is why they read like device
 * actions rather than page interactions.
 *
 * `listening_started` and `review_done` replace the never-fired
 * `listening_start` / `card_reviewed`: both were declared here when the beacon
 * shipped and neither was ever written, so no historical row carries the old
 * spelling and nothing queries it.
 */
export const TRACKABLE_EVENTS = [
  "coach_open",
  "coach_explain",
  "coach_hooks",
  "coach_chat",
  "listening_stop",
  "notebook_open",
  "studio_create",
  "manga_create",
  "ending_create",
  "extension_install_click",
  "upgrade_click",
  "checkout_start",
  "signin_start",
  "landing_view",
  "store_cta_click",
  "mobile_capture_shown",
  "mobile_capture_submitted",
  ...LEARNING_LOOP_EVENTS,
] as const;

export type TrackableEvent = (typeof TRACKABLE_EVENTS)[number];

const EVENT_SET = new Set<string>(TRACKABLE_EVENTS);

export function isTrackableEvent(value: unknown): value is TrackableEvent {
  return typeof value === "string" && EVENT_SET.has(value);
}

/**
 * Segments whose CHILD is a record id, mirroring the app's `[id]` routes
 * (/m, /wm, /e, /end, /app/cards, /app/notebooks).
 *
 * Anchoring on the parent rather than guessing from the segment's shape is
 * deliberate. A shape rule wide enough to catch this product's ids ("12+
 * alphanumerics") also swallows `/learn-japanese-netflix-anime` and every
 * other SEO landing page — which is the most valuable pageview data there is.
 * `/blog/[slug]` is intentionally absent: those slugs ARE the page identity.
 */
const ID_PARENTS = new Set(["m", "wm", "e", "end", "cards", "notebooks"]);

/** Shape-based fallback for ids under a parent not listed above. Kept
 * deliberately narrow — each pattern is unambiguous. */
const DYNAMIC_SEGMENTS: { test: RegExp; as: string }[] = [
  { test: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, as: ":id" },
  { test: /^[0-9a-f]{24,}$/i, as: ":id" },
  { test: /^\d+$/, as: ":n" },
];

const MAX_PATH_LEN = 128;
const MAX_SEGMENTS = 8;

/**
 * Normalize a client-reported path to a stable, low-cardinality label.
 * Returns null when the input is not a usable same-site path.
 */
export function normalizeTrackPath(raw: string): string | null {
  if (typeof raw !== "string") return null;
  let path = raw.trim();
  if (!path) return null;

  // Accept a full URL but keep only the path: the query string carries
  // campaign junk and sometimes PII, and neither belongs in telemetry.
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }
  const q = path.search(/[?#]/);
  if (q >= 0) path = path.slice(0, q);

  // Reject anything that isn't a rooted same-site path, including
  // protocol-relative "//evil.com" which would otherwise pass the / check.
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.length > MAX_PATH_LEN) path = path.slice(0, MAX_PATH_LEN);

  const segments = path.split("/").filter(Boolean);
  if (segments.length > MAX_SEGMENTS) return "/:deep";

  const normalized = segments.map((seg, i) => {
    const decoded = safeDecode(seg);
    const parent = i > 0 ? safeDecode(segments[i - 1]!).toLowerCase() : "";
    if (parent && ID_PARENTS.has(parent)) return ":id";
    const match = DYNAMIC_SEGMENTS.find((d) => d.test.test(decoded));
    return match ? match.as : decoded.toLowerCase();
  });

  return normalized.length ? `/${normalized.join("/")}` : "/";
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
