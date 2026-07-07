import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { currentMonth } from "@/lib/ai-store";
import { normalizeFinalizeRequest, type StudioCreationMeta } from "@/lib/studio";
import {
  getArtUsage,
  getStudioConfig,
  getStudioUsage,
  incrementStudioUsage,
  listCreations,
  saveCreationMeta,
} from "@/lib/studio-store";

export const dynamic = "force-dynamic";

/** List the caller's creations + this month's usage (saved count + art budget). */
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { limit, artPerMonth } = await getStudioConfig();
  const owner = isOwnerEmail(profile.email);
  const month = currentMonth();
  const [creations, used, artUsed] = await Promise.all([
    listCreations(profile.id),
    getStudioUsage(profile.id, month),
    getArtUsage(profile.id, month),
  ]);
  return NextResponse.json({
    creations,
    usage: { used, limit: owner ? Number.MAX_SAFE_INTEGER : limit },
    art: { used: artUsed, limit: owner ? Number.MAX_SAFE_INTEGER : artPerMonth },
  });
}

/**
 * Save an assembled manga to the caller's account (login required). The script
 * + per-panel art were already drafted/drawn via /draft and /panel-art (those
 * are where AI cost is metered); this only persists meta. Panel images are then
 * uploaded one-by-one via PUT /api/studio/<id>/panel/<i> to keep payloads small.
 */
export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = isOwnerEmail(profile.email);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const normalized = normalizeFinalizeRequest(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const { limit } = await getStudioConfig();
  const month = currentMonth();
  const used = await getStudioUsage(profile.id, month);
  if (!owner && used >= limit) {
    return NextResponse.json({ error: "studio_quota_exhausted", usage: { used, limit } }, { status: 429 });
  }

  const r = normalized.req;
  const meta: StudioCreationMeta = {
    id: crypto.randomUUID(),
    ownerId: profile.id,
    authorName: profile.name || undefined,
    title: r.title,
    logline: r.logline,
    genre: r.genre,
    tone: r.tone,
    setting: r.setting,
    language: r.language,
    styleKey: r.styleKey,
    cast: r.cast,
    panels: r.panels,
    layout: "panels",
    isPublic: false,
    createdAt: new Date().toISOString(),
  };
  await saveCreationMeta(meta);
  const newUsed = await incrementStudioUsage(profile.id, month);

  return NextResponse.json({
    creation: meta,
    usage: { used: newUsed, limit: owner ? Number.MAX_SAFE_INTEGER : limit },
  });
}
