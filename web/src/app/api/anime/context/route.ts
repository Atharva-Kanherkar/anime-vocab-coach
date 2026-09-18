import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import {
  ANIME_CONTEXT_EVENT,
  generateAnimeContext,
  getAnimeContext,
  type AnimeContextCacheOutcome,
} from "@/lib/anime-context";
import { authKindOf, recordUserEvent, requestFacts, surfaceOf } from "@/lib/telemetry";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";

async function handleGET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const title = (url.searchParams.get("title") || "").trim();
  if (!title) return NextResponse.json({ error: "missing_title" }, { status: 400 });

  try {
    const cached = await getAnimeContext(title);
    if (cached) {
      await recordCacheOutcome(req, profile.id, profile.plan ?? null, "hit");
      return NextResponse.json({ ...cached, cached: true });
    }
    await recordCacheOutcome(req, profile.id, profile.plan ?? null, "miss");
    const result = await generateAnimeContext(title, {
      userId: profile.id,
      plan: profile.plan,
      country: requestFacts(req).country,
      surface: surfaceOf(req),
    });
    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "context_failed";
    const status = detail === "ai_not_configured" ? 503 : 502;
    return NextResponse.json({ error: detail }, { status });
  }
}

/**
 * One `avc_events` row per lookup, tagged hit or miss (#113).
 *
 * The anime-context cache is a 60-day KV cache in front of a paid completion,
 * and until now it recorded nothing at all: a hit returns before any
 * `recordLlmCall`, so the dashboard's only cache number was the coach's
 * response cache, wearing a label that implied it covered this one. Recording
 * the miss as well is the point — a hit rate needs its denominator.
 */
async function recordCacheOutcome(
  req: Request,
  userId: string,
  plan: string | null,
  outcome: AnimeContextCacheOutcome
): Promise<void> {
  const facts = requestFacts(req);
  await recordUserEvent({
    kind: "feature",
    name: ANIME_CONTEXT_EVENT,
    userId,
    plan,
    country: facts.country,
    city: facts.city,
    device: facts.device,
    authKind: authKindOf(req),
    status: outcome,
  });
}

export const GET = withApiTelemetry("/api/anime/context", handleGET);
