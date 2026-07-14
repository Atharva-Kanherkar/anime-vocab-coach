// AI caps are per subscription tier: resolvePlan() reads the buyer's plan
// (free | pro | max) from Clerk publicMetadata, and aiLimitForPlan maps it to
// the tier's monthly cap. Owners (OWNER_EMAILS) additionally get an
// effectively-unlimited cap so a stranger can never run up the OpenAI bill —
// widen OWNER_EMAILS or raise the tier limits to adjust.
export const OWNER_EMAILS = [
  "atharva.kanherkar@rimo.app",
  "atharvakanherkar25@gmail.com",
];

// High enough to be "unlimited" in practice, low enough to stop a runaway loop.
export const OWNER_AI_LIMIT = 1_000_000;

// Normalize both sides so a future mixed-case allowlist entry still matches.
const OWNER_SET = new Set(OWNER_EMAILS.map((e) => e.trim().toLowerCase()));

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && OWNER_SET.has(email.trim().toLowerCase());
}
