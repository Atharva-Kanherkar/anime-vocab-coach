import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { currentMonth, getOpenAiKey } from "@/lib/ai-store";
import {
  clientIp,
  currentDay,
  getAnonArtUsage,
  getArtUsage,
  getStudioConfig,
  incrementAnonArtUsage,
  incrementArtUsage,
} from "@/lib/studio-store";
import { normalizePanelArtRequest } from "@/lib/studio";
import { generatePanelImage } from "@/lib/studio-openai";

export const dynamic = "force-dynamic";

// Draw ONE panel — the expensive OpenAI image call, so it's the real cost gate.
// Text beat → images/generations; a hand-drawn sketch → images/edits (beautify).
// Signed-in: monthly art budget. Anonymous: small per-IP daily budget (taste).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const normalized = normalizePanelArtRequest(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const profile = await resolveProfile(req);
  const { imageModel, imageQuality, artPerMonth, anonArtPerDay } = await getStudioConfig();
  const owner = isOwnerEmail(profile?.email);

  // Quota check BEFORE spending. Increment only after a successful draw so a
  // failed generation never costs the caller a slot.
  if (profile && !owner) {
    const used = await getArtUsage(profile.id, currentMonth());
    if (used >= artPerMonth) {
      return NextResponse.json({ error: "art_quota_exhausted", usage: { used, limit: artPerMonth } }, { status: 429 });
    }
  } else if (!profile) {
    const used = await getAnonArtUsage(clientIp(req), currentDay());
    if (used >= anonArtPerDay) {
      return NextResponse.json({ error: "anon_art_limit", needsLogin: true }, { status: 429 });
    }
  }

  let imageB64: string;
  try {
    imageB64 = await generatePanelImage(apiKey, {
      model: imageModel,
      quality: imageQuality,
      styleKey: normalized.req.styleKey,
      scene: normalized.req.scene,
      cast: normalized.req.cast,
      sketchB64: normalized.req.sketchB64 || undefined,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "studio_image_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  // Soft-fail the quota bump: the expensive image was already drawn and paid
  // for, so a KV put-limit rejection must not 500 the request and drop it.
  try {
    if (profile && !owner) await incrementArtUsage(profile.id, currentMonth());
    else if (!profile) await incrementAnonArtUsage(clientIp(req), currentDay());
  } catch (err) {
    console.warn("[studio/panel-art] art usage write failed", err);
  }

  return NextResponse.json({ image: `data:image/png;base64,${imageB64}` });
}
