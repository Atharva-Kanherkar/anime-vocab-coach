export const FUNNEL_STEPS = [
  "landing_view",
  "store_cta_click",
  "cws_installs",
  "onboarding_shown",
  "signup_completed",
  "first_card_created",
  "first_srs_review",
  "upgrade_prompt_shown",
  "upgrade_prompt_clicked",
  "checkout_started",
  "payers",
];

export function buildFunnelCounts(site, extension, external = {}) {
  const count = (source, name) =>
    Math.max(0, Number.isFinite(source[name]) ? source[name] : 0);
  const externalCount = (value) =>
    value == null || !Number.isFinite(value) ? null : Math.max(0, value);
  return {
    landing_view: count(site, "landing_view"),
    store_cta_click: count(site, "store_cta_click"),
    cws_installs: externalCount(external.installs),
    onboarding_shown: count(extension, "onboarding_shown"),
    signup_completed: count(extension, "signup_completed"),
    first_card_created: count(extension, "first_card_created"),
    first_srs_review: count(extension, "first_srs_review"),
    upgrade_prompt_shown: count(extension, "upgrade_prompt_shown"),
    upgrade_prompt_clicked: count(extension, "upgrade_prompt_clicked"),
    checkout_started: count(extension, "checkout_started"),
    payers: externalCount(external.payers),
  };
}

export function conversion(from, to) {
  if (from == null || to == null || from <= 0) return null;
  return to / from;
}
