import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getOpenAiKey } from "@/lib/ai-store";
import {
  clientIp,
  currentDay,
  getAnonDraftUsage,
  getStudioConfig,
  incrementAnonDraftUsage,
} from "@/lib/studio-store";
import { normalizeStudioRequest } from "@/lib/studio";
import { generateScript } from "@/lib/studio-openai";

export const dynamic = "force-dynamic";

// Draft a manga script (title + cast + panel text). Cheap chat-only call, so
// this is the free "taste": anonymous callers get a small per-IP daily budget;
// signed-in callers are unmetered here (art is where the real cost lives).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const normalized = normalizeStudioRequest(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const profile = await resolveProfile(req);
  const { scriptModel, anonDraftsPerDay } = await getStudioConfig();

  if (!profile) {
    const ip = clientIp(req);
    const day = currentDay();
    const used = await getAnonDraftUsage(ip, day);
    if (used >= anonDraftsPerDay) {
      return NextResponse.json({ error: "anon_draft_limit", needsLogin: true }, { status: 429 });
    }
    await incrementAnonDraftUsage(ip, day);
  }

  try {
    const script = await generateScript(apiKey, scriptModel, normalized.req);
    return NextResponse.json({
      title: script.title,
      cast: script.cast,
      panels: script.panels,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "studio_script_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
