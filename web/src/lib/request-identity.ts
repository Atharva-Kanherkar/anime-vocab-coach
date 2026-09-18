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
import { clientIp } from "./extension-store";
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
 * Per-IP ceiling on UNCACHED lookups, per minute.
 *
 * /api/track is a public, unauthenticated beacon, and the only thing that
 * decides whether it does a KV read is whether the caller sent something
 * shaped like `Bearer avc_st_…`. Anyone can send that, so without a bound a
 * stranger could turn a fire-and-forget beacon into one KV read per request,
 * for free, from a single machine.
 *
 * The counter is per-isolate and in memory ON PURPOSE. Keeping it in KV would
 * spend a read and a write to avoid a read, which is worse than the problem;
 * the existing IP limiter in extension-store.ts pays that price because it has
 * to drop requests, and this one does not — over budget just means the row is
 * written without an identity, which is exactly what happened before #112.
 * Being per-isolate makes it a soft ceiling rather than a guarantee, which is
 * the honest bound available without a dedicated rate-limiting binding.
 *
 * A linked learner's real beacon volume is human-paced (a card shown, a word
 * judged), so this is far above anything legitimate traffic produces.
 */
const LOOKUPS_PER_IP_PER_MINUTE = 120;

const lookupBudget = new Map<string, { minute: number; used: number }>();

function allowLookup(req: Request): boolean {
  const minute = Math.floor(Date.now() / 60_000);
  const key = clientIp(req);
  const entry = lookupBudget.get(key);

  if (!entry || entry.minute !== minute) {
    // Drop everything from older minutes rather than letting one entry per
    // attacker-chosen IP accumulate for the life of the isolate.
    if (lookupBudget.size > 5000) lookupBudget.clear();
    lookupBudget.set(key, { minute, used: 1 });
    return true;
  }
  if (entry.used >= LOOKUPS_PER_IP_PER_MINUTE) return false;
  entry.used++;
  return true;
}

/**
 * The best identity available for a request, without authenticating it.
 *
 * Order: what a route already resolved, then — if the caller has budget — the
 * sync token's own KV record. A Clerk session is deliberately NOT resolved
 * here: reading it costs a call on every request including the ones that never
 * needed identity, and routes that care already go through resolveProfile,
 * which memoises above.
 *
 * Note what the budget does and does not touch. A route that authenticated has
 * already recorded its answer, so it reads the memo and never spends budget;
 * only an unauthenticated caller presenting a bearer can reach the lookup.
 *
 * Never throws: telemetry identity is not worth failing a request over, and a
 * KV hiccup should degrade to "anon", exactly as it did before.
 */
export async function requestIdentity(req: Request): Promise<RequestIdentity> {
  const cached = resolved.get(req);
  if (cached) return cached;

  const token = syncTokenOf(req);
  if (!token) return ANONYMOUS;
  // Over budget: record the event anonymously rather than dropping it. The
  // beacon is still worth counting; only the attribution is lost.
  if (!allowLookup(req)) return ANONYMOUS;

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

/** Test-only: forget every per-IP budget so cases cannot leak into each other. */
export function resetIdentityLookupBudgetForTests(): void {
  lookupBudget.clear();
}
