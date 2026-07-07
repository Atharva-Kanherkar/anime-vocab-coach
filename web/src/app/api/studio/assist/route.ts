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
import { generateAssist } from "@/lib/studio-openai";
import { MAX_GENRE_LEN, MAX_SETTING_LEN, MAX_TONE_LEN } from "@/lib/studio";

export const dynamic = "force-dynamic";

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Copilot suggestions (scene direction or a dialogue line). Cheap chat call, so
// it shares the free-taste budget: anonymous callers get a per-IP daily cap,
// signed-in callers are unmetered here.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const kind = b.kind === "line" ? "line" : "scene";

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const profile = await resolveProfile(req);
  const { scriptModel, anonDraftsPerDay } = await getStudioConfig();
  if (!profile) {
    const ip = clientIp(req);
    const day = currentDay();
    if ((await getAnonDraftUsage(ip, day)) >= anonDraftsPerDay) {
      return NextResponse.json({ error: "anon_draft_limit", needsLogin: true }, { status: 429 });
    }
    await incrementAnonDraftUsage(ip, day);
  }

  const cast = Array.isArray(b.cast)
    ? b.cast
        .slice(0, 4)
        .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : null))
        .map((c) => (c ? { name: clip(c.name, 40), look: clip(c.look, 240) } : null))
        .filter((c): c is { name: string; look: string } => !!c)
    : [];

  try {
    const suggestion = await generateAssist(apiKey, scriptModel, {
      kind,
      genre: clip(b.genre, MAX_GENRE_LEN),
      tone: clip(b.tone, MAX_TONE_LEN),
      setting: clip(b.setting, MAX_SETTING_LEN),
      title: clip(b.title, 80),
      cast,
      scene: clip(b.scene, 500),
      language: clip(b.language, 24) || "English",
    });
    return NextResponse.json({ suggestion });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "assist_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
