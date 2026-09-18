// Allowlisted extension product-funnel events (aggregate KV counters only).
// Keep tight and additive — same pattern as ending-funnel.ts.

export const EXTENSION_EVENTS = [
  "review_prompt_shown",
  "review_prompt_clicked",
  "signup_completed",
  "first_card_created",
  "first_srs_review",
  "upgrade_prompt_shown",
  "upgrade_prompt_clicked",
  "checkout_started",
] as const;

export type ExtensionEvent = (typeof EXTENSION_EVENTS)[number];

export function isExtensionEvent(v: unknown): v is ExtensionEvent {
  return typeof v === "string" && (EXTENSION_EVENTS as readonly string[]).includes(v);
}
