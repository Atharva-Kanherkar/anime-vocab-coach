// Who is behind this request, for telemetry only (#112).
//
// THE BUG THIS FIXES. Every API call authenticated with the extension's
// `sync_token` bearer wrote its `avc_events` row with userId "anon", because
// the route-level wrapper only ever saw headers. Extension activity was
// therefore invisible per user, which is why the first pass of the Aug 2026
// retention review undercounted active days and reported a retention figure
// that was simply wrong — the workaround was to union in `avc_llm`, which only
// covers the subset of activity that happened to call a model.
//
// THE COST. Resolving a token means a KV read, and this runs on the hot path of
// every extension request. So the answer is memoised per Request object: a
// route that authenticates through resolveProfile records what it already
// resolved, and the telemetry wrapper reuses it. A second KV read only happens
// for a request that presented a token but whose route never authenticated it.

import { getSyncTokenProfile } from "./sync-store";
import { syncTokenOf } from "./telemetry";

export interface RequestIdentity {
  userId: string | null;
  plan: string | null;
}

export const ANONYMOUS: RequestIdentity = { userId: null, plan: null };

/**
 * Keyed on the Request itself, so an entry dies with the request rather than
 * living in a map that a long-lived isolate would grow forever. Nothing here is
 * an authorization decision — the routes still authenticate for themselves.
 */
const resolved = new WeakMap<Request, RequestIdentity>();

/** Record an identity a route already paid for. Safe to call with null. */
export function rememberRequestIdentity(
  req: Request,
  identity: RequestIdentity | null
): void {
  try {
    resolved.set(req, identity ?? ANONYMOUS);
  } catch {
    // A non-object key (only reachable from a test double) is not worth a throw.
  }
}

/**
 * The best identity available for a request, without authenticating it.
 *
 * Order: what a route already resolved, then the sync token's own KV record.
 * A Clerk session is deliberately NOT resolved here — reading it costs a call
 * on every request including the ones that never needed identity, and routes
 * that care already go through resolveProfile, which memoises above.
 *
 * Never throws: telemetry identity is not worth failing a request over, and a
 * KV hiccup should degrade to "anon", exactly as it did before.
 */
export async function requestIdentity(req: Request): Promise<RequestIdentity> {
  const cached = resolved.get(req);
  if (cached) return cached;

  const token = syncTokenOf(req);
  if (!token) return ANONYMOUS;

  try {
    const profile = await getSyncTokenProfile(token);
    const identity: RequestIdentity = profile
      ? { userId: profile.id, plan: profile.plan ?? null }
      : ANONYMOUS;
    rememberRequestIdentity(req, identity);
    return identity;
  } catch {
    return ANONYMOUS;
  }
}
