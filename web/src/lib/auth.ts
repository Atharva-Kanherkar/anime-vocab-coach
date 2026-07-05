import { currentUser } from "@clerk/nextjs/server";
import { getSyncTokenProfile } from "./sync-store";
import { DEV_NO_CLERK, DEV_PROFILE } from "./dev-auth";
import type { CloudUserProfile } from "./sync";
import type { Plan } from "./ai-coach";

// Resolve the caller to a cloud profile. Three paths, in priority order:
//  1. A sync-token bearer (the extension's background credential) — validated
//     first so a *presented* token that's invalid 401s rather than silently
//     falling back to another identity.
//  2. The dev bypass (local only; see dev-auth).
//  3. A signed-in Clerk web session (cookie).
// Returns null when none resolve → caller should 401.
export async function resolveProfile(req: Request): Promise<CloudUserProfile | null> {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(avc_st_[A-Za-z0-9]+)$/);
  // Note: a sync token authenticates the same user for any endpoint using this
  // resolver — including AI-metered ones (notebook summaries). That's the same
  // user and the same monthly quota bucket, so no cross-user or extra-spend
  // risk; it just means the extension's credential can also reach those paths.
  if (match) return getSyncTokenProfile(match[1]);

  if (DEV_NO_CLERK) return { ...DEV_PROFILE };

  const user = await currentUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    name: user.firstName || user.username || null,
  };
}

// Plan for AI metering. Mirrors the coach route (Clerk publicMetadata.plan).
// Token/dev callers default to free (no plan info on a sync token).
export async function resolvePlan(req: Request): Promise<Plan> {
  const auth = req.headers.get("authorization") || "";
  if (/^Bearer\s+avc_st_/.test(auth)) return "free";
  if (DEV_NO_CLERK) return "free";
  const user = await currentUser();
  return user?.publicMetadata?.plan === "pro" ? "pro" : "free";
}
