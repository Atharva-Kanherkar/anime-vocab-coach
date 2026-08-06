import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { generateAnimeContext, getAnimeContext } from "@/lib/anime-context";
import { requestFacts, surfaceOf } from "@/lib/telemetry";
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
      return NextResponse.json({ ...cached, cached: true });
    }
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

export const GET = withApiTelemetry("/api/anime/context", handleGET);
