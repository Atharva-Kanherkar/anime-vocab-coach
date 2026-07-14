import { currentUser } from "@clerk/nextjs/server";
import { getSyncTokenProfile } from "./sync-store";
import { DEV_NO_CLERK, DEV_PROFILE } from "./dev-auth";
import type { CloudUserProfile } from "./sync";
import { normalizePlan, type Plan } from "./ai-coach";

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
  if (match) {
    // A KV read hiccup here must not 500 every extension-authenticated request —
    // treat a lookup failure as "no valid session" so the caller gets a clean 401.
    try {
      return await getSyncTokenProfile(match[1]);
    } catch (err) {
      console.warn("[auth] sync-token lookup failed", err);
      return null;
    }
  }

  if (DEV_NO_CLERK) return { ...DEV_PROFILE };

  let user: Awaited<ReturnType<typeof currentUser>>;
  try {
    user = await currentUser();
  } catch (err) {
    console.warn("[auth] currentUser failed", err);
    return null;
  }
  if (!user) return null;

  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    name: user.firstName || user.username || null,
    plan: normalizePlan((user.publicMetadata as { plan?: unknown } | undefined)?.plan),
  };
}

// Plan for AI + listening metering, read from the buyer's tier. The Dodo billing
// webhook writes `plan` (free | pro | max) to Clerk publicMetadata, which rides
// on the resolved profile (and on the extension sync-token profile). Owners still
// get an effectively-unlimited AI cap per-route via isOwnerEmail(profile.email).
export function resolvePlan(profile?: CloudUserProfile | null): Plan {
  return normalizePlan(profile?.plan);
}
