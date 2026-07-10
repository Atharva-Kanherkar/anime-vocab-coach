import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getOpenAiKey } from "@/lib/ai-store";
import {
  buildEndingPremise,
  getEndingChoice,
  getFeaturedEnding,
} from "@/lib/ending-hooks";
import {
  clientIp,
  currentDay,
  getAnonDraftUsage,
  getStudioConfig,
  incrementAnonDraftUsage,
} from "@/lib/studio-store";
import { generateScript } from "@/lib/studio-openai";
import type { StudioGenerateRequest } from "@/lib/studio";

export const dynamic = "force-dynamic";

/**
 * Choose-Your-Ending: turn a curated finale pick into a Studio script.
 * Same anon daily draft budget as /api/studio/draft.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const mangaId = typeof b.mangaId === "string" ? b.mangaId : "";
  const endingId = typeof b.endingId === "string" ? b.endingId : "";
  const customNote = typeof b.customNote === "string" ? b.customNote : "";

  const manga = getFeaturedEnding(mangaId);
  if (!manga) return NextResponse.json({ error: "manga_not_found" }, { status: 404 });
  const choice = getEndingChoice(manga, endingId);
  if (!choice) return NextResponse.json({ error: "ending_not_found" }, { status: 400 });

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

  const studioReq: StudioGenerateRequest = {
    premise: buildEndingPremise(manga, choice, customNote),
    genre: manga.genre,
    tone: choice.tone,
    setting: manga.setting,
    language: manga.language,
    styleKey: manga.styleKey,
    characters: manga.cast,
  };

  try {
    const script = await generateScript(apiKey, scriptModel, studioReq);
    return NextResponse.json({
      title: script.title,
      logline: script.logline,
      cast: script.cast,
      panels: script.panels,
      base: {
        genre: manga.genre,
        tone: choice.tone,
        setting: manga.setting,
        language: manga.language,
        styleKey: manga.styleKey,
      },
      endingId: choice.id,
      mangaId: manga.id,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "ending_script_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
