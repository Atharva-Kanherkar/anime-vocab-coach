import { auth } from "@clerk/nextjs/server";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { isTrackableEvent, normalizeClientVersion, normalizeTrackPath } from "@/lib/track-events";
import {
  authKindOf,
  externalReferrerHost,
  recordUserEvent,
  requestFacts,
} from "@/lib/telemetry";
import { normalizeAttribution } from "@/lib/funnel-attribution";
import { requestIdentity } from "@/lib/request-identity";

export const dynamic = "force-dynamic";

/** Bound the body so a hostile client can't push large blobs into AE. */
const MAX_BODY_BYTES = 1024;

/**
 * First-party pageview / feature beacon → Analytics Engine.
 *
 * Always 204, even on garbage input: a probe learns nothing, and a beacon that
 * can return an error is a beacon that can break a page.
 *
 * Identity comes from `auth()`, NOT `currentUser()`. auth() verifies the
 * session cookie locally, while currentUser() is a network call to Clerk — on
 * a per-pageview beacon that is both latency the visitor pays for and exactly
 * the per-request cost profile behind the earlier Worker 1102 incidents.
 */
export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 204 });

    let body: {
      kind?: unknown;
      name?: unknown;
      referrer?: unknown;
      utm_source?: unknown;
      utm_medium?: unknown;
      utm_campaign?: unknown;
      v?: unknown;
    };
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      return new Response(null, { status: 204 });
    }

    const kind = body.kind === "feature" ? "feature" : "pageview";
    const name =
      kind === "pageview"
        ? normalizeTrackPath(typeof body.name === "string" ? body.name : "")
        : isTrackableEvent(body.name)
          ? body.name
          : null;
    if (!name) return new Response(null, { status: 204 });

    // The extension fires learning-loop events through this same beacon and
    // has no Clerk cookie — its credential is the sync-token bearer. Resolving
    // it is what makes `card_shown` attributable to a learner instead of a
    // count of anonymous ticks (#111, #112).
    let userId: string | null = (await requestIdentity(req)).userId;
    if (!userId && !DEV_NO_CLERK) {
      try {
        userId = (await auth()).userId;
      } catch {
        userId = null;
      }
    }

    const facts = requestFacts(req);
    const attribution = normalizeAttribution(body);
    // The client sends document.referrer, because this beacon's own `Referer`
    // header is always a page on our own domain — reading that made every
    // pageview look self-referred and destroyed acquisition attribution.
    // An untrusted string, so it is parsed and host-only, never echoed raw.
    const referrerHost = externalReferrerHost(
      typeof body.referrer === "string" ? body.referrer : ""
    );
    await recordUserEvent({
      kind,
      name,
      userId,
      // Plan deliberately omitted: reading it means a Clerk API call per
      // pageview. The LLM dataset carries plan for the calls that cost money,
      // and the owner dashboard joins on userId when it needs the tier.
      plan: userId ? "signed_in" : "anon",
      country: facts.country,
      city: facts.city,
      referrerHost,
      device: facts.device,
      authKind: authKindOf(req),
      status: "200",
      // Which extension package sent this (#159). The store served a build
      // that predated every learning-loop event for two months and nothing
      // here could tell; the website sends none, so its rows stay "".
      clientVersion: normalizeClientVersion(body.v),
      ...attribution,
    });
  } catch {
    // Beacons never surface errors.
  }
  return new Response(null, { status: 204 });
}
