// Pro is intentionally OPEN TO EVERYONE right now (the plan gate was removed by
// owner request). resolvePlan returns "pro" for all callers, so every account
// gets the Pro AI limits. Owners additionally get an effectively-unlimited AI
// cap. A generous per-account cap still applies to non-owners so a stranger
// can't run up the OpenAI bill — lift it by widening OWNER_EMAILS or raising
// the standard limits.
export const OWNER_EMAILS = [
  "atharva.kanherkar@rimo.app",
  "atharvakanherkar25@gmail.com",
];

// High enough to be "unlimited" in practice, low enough to stop a runaway loop.
export const OWNER_AI_LIMIT = 1_000_000;

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && OWNER_EMAILS.includes(email.trim().toLowerCase());
}
