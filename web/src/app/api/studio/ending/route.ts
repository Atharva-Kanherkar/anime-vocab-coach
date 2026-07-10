import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getOpenAiKey } from "@/lib/ai-store";
import {
  buildCustomEndingPremise,
  buildEndingPremise,
  getEndingChoice,
  getFeaturedEnding,
  type CustomEndingRequest,
} from "@/lib/ending-hooks";
import {
  clientIp,
  currentDay,
  getAnonDraftUsage,
  getStudioConfig,
  incrementAnonDraftUsage,
} from "@/lib/studio-store";
import { generateScript } from "@/lib/studio-openai";
import type { StyleKey } from "@/lib/cards";
import type { StudioGenerateRequest } from "@/lib/studio";
import { STUDIO_STYLES } from "@/lib/studio";

export const dynamic = "force-dynamic";

async function gateAnon(req: Request, anonDraftsPerDay: number) {
  const profile = await resolveProfile(req);
  if (profile) return { profile, ok: true as const };
  const ip = clientIp(req);
  const day = currentDay();
  const used = await getAnonDraftUsage(ip, day);
  if (used >= anonDraftsPerDay) {
    return {
      profile: null,
      ok: false as const,
      res: NextResponse.json({ error: "anon_draft_limit", needsLogin: true }, { status: 429 }),
    };
  }
  await incrementAnonDraftUsage(ip, day);
  return { profile: null, ok: true as const };
}

/**
 * Choose-Your-Ending:
 * - catalog: { mangaId, endingId, customNote? }
 * - custom (agentic any title): { mode:"custom", title, synopsis, endingTitle, endingBlurb, tone, premiseBeat, ... }
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

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const { scriptModel, anonDraftsPerDay } = await getStudioConfig();
  const gate = await gateAnon(req, anonDraftsPerDay);
  if (!gate.ok) return gate.res;

  let studioReq: StudioGenerateRequest;
  let meta: { mangaId: string; endingId: string };

  if (b.mode === "custom") {
    const title = typeof b.title === "string" ? b.title.trim().slice(0, 80) : "";
    const synopsis = typeof b.synopsis === "string" ? b.synopsis.trim().slice(0, 600) : "";
    const endingTitle = typeof b.endingTitle === "string" ? b.endingTitle.trim().slice(0, 80) : "";
    const endingBlurb = typeof b.endingBlurb === "string" ? b.endingBlurb.trim().slice(0, 200) : "";
    const tone = typeof b.tone === "string" ? b.tone.trim().slice(0, 40) : "Heartfelt";
    const premiseBeat =
      typeof b.premiseBeat === "string"
        ? b.premiseBeat.trim().slice(0, 500)
        : `Write a fan-art epilogue ending for ${title}.`;
    if (!title || title.length < 2) {
      return NextResponse.json({ error: "title_required" }, { status: 400 });
    }
    const styleRaw = typeof b.styleKey === "string" ? b.styleKey : "slayer";
    const styleKey = (STUDIO_STYLES.includes(styleRaw as StyleKey) ? styleRaw : "slayer") as StyleKey;
    const language = typeof b.language === "string" ? b.language.slice(0, 24) : "English";
    const customNote = typeof b.customNote === "string" ? b.customNote : "";

    const custom: CustomEndingRequest = {
      title,
      synopsis: synopsis || `After the finale of ${title}.`,
      endingTitle: endingTitle || "Fan ending",
      endingBlurb: endingBlurb || "Your creative finale.",
      tone,
      premiseBeat,
      customNote,
      language,
      styleKey,
    };

    studioReq = {
      premise: buildCustomEndingPremise(custom),
      genre: "Fan ending",
      tone,
      setting: `After the finale of ${title}`,
      language,
      styleKey,
      characters: [],
    };
    meta = { mangaId: "custom", endingId: endingTitle || "custom" };
  } else {
    const mangaId = typeof b.mangaId === "string" ? b.mangaId : "";
    const endingId = typeof b.endingId === "string" ? b.endingId : "";
    const customNote = typeof b.customNote === "string" ? b.customNote : "";
    const manga = getFeaturedEnding(mangaId);
    if (!manga) return NextResponse.json({ error: "manga_not_found" }, { status: 404 });
    const choice = getEndingChoice(manga, endingId);
    if (!choice) return NextResponse.json({ error: "ending_not_found" }, { status: 400 });

    studioReq = {
      premise: buildEndingPremise(manga, choice, customNote),
      genre: manga.genre,
      tone: choice.tone,
      setting: manga.setting,
      language: manga.language,
      styleKey: manga.styleKey,
      characters: manga.cast,
    };
    meta = { mangaId: manga.id, endingId: choice.id };
  }

  try {
    const script = await generateScript(apiKey, scriptModel, studioReq);
    return NextResponse.json({
      title: script.title,
      logline: script.logline,
      cast: script.cast,
      panels: script.panels,
      base: {
        genre: studioReq.genre,
        tone: studioReq.tone,
        setting: studioReq.setting,
        language: studioReq.language,
        styleKey: studioReq.styleKey,
      },
      ...meta,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "ending_script_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
