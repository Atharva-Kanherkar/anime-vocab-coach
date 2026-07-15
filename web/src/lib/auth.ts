import { currentUser } from "@clerk/nextjs/server";
import { getSyncTokenProfile } from "./sync-store";
import { DEV_NO_CLERK, DEV_PROFILE } from "./dev-auth";
import type { CloudUserProfile } from "./sync";
import { normalizePlan, type Plan } from "./ai-coach";
import { effectivePlan, parseEntitlement } from "./plans";

function profileFromEntitlement(
  base: Pick<CloudUserProfile, "id" | "email" | "name">,
  metadata: unknown
): CloudUserProfile {
  const entitlement = parseEntitlement(metadata);
  return {
    ...base,
    plan: effectivePlan(entitlement),
    billingInterval: entitlement.billingInterval,
    planExpiresAt: entitlement.planExpiresAt,
  };
}

/** Effective plan for a stored profile: re-applies gift expiry so a Max stamped
 * on a sync token (or any cached profile) can't outlive planExpiresAt. */
function planFromProfile(profile: CloudUserProfile | null | undefined): Plan {
  return effectivePlan({
    plan: normalizePlan(profile?.plan),
    billingInterval: profile?.billingInterval ?? null,
    planExpiresAt: profile?.planExpiresAt ?? null,
  });
}

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
      const profile = await getSyncTokenProfile(match[1]);
      if (!profile) return null;
      return { ...profile, plan: planFromProfile(profile) };
    } catch (err) {
      console.warn("[auth] sync-token lookup failed", err);
      return null;
    }
  }

  if (DEV_NO_CLERK) {
    return {
      ...DEV_PROFILE,
      plan: "free",
      billingInterval: null,
      planExpiresAt: null,
    };
  }

  let user: Awaited<ReturnType<typeof currentUser>>;
  try {
    user = await currentUser();
  } catch (err) {
    console.warn("[auth] currentUser failed", err);
    return null;
  }
  if (!user) return null;

  return profileFromEntitlement(
    {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? null,
      name: user.firstName || user.username || null,
    },
    user.publicMetadata
  );
}

// Plan for AI + listening metering. Dodo webhook + Max-gift admin write Clerk
// publicMetadata (plan / billingInterval / planExpiresAt). Expired gifts → free.
// Owners still get an effectively-unlimited AI cap via isOwnerEmail.
export function resolvePlan(profile?: CloudUserProfile | null): Plan {
  return planFromProfile(profile);
}
