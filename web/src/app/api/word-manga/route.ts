import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { currentMonth, getOpenAiKey } from "@/lib/ai-store";
import {
  buildPagePrompt,
  buildScriptPrompt,
  normalizeScript,
  normalizeStudioRequest,
  STUDIO_IMAGE_SIZE,
  type StudioCreationMeta,
} from "@/lib/word-manga";
import {
  getStudioConfig,
  getStudioUsage,
  incrementStudioUsage,
  listCreations,
  putCreation,
} from "@/lib/word-manga-store";

export const dynamic = "force-dynamic";

/** List the caller's creations + this month's usage. */
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { limit } = await getStudioConfig();
  const owner = isOwnerEmail(profile.email);
  const [creations, used] = await Promise.all([
    listCreations(profile.id),
    getStudioUsage(profile.id, currentMonth()),
  ]);
  return NextResponse.json({
    creations,
    usage: { used, limit: owner ? Number.MAX_SAFE_INTEGER : limit },
  });
}

/** Generate a new manga: script (chat model) → page art (image model) → KV. */
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
  const normalized = normalizeStudioRequest(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  const { req: studioReq } = normalized;

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const { limit, scriptModel, imageModel, imageQuality } = await getStudioConfig();
  const month = currentMonth();
  const used = await getStudioUsage(profile.id, month);
  if (!owner && used >= limit) {
    return NextResponse.json(
      { error: "studio_quota_exhausted", usage: { used, limit } },
      { status: 429 }
    );
  }

  // 1) Script. json_object keeps the shape parseable; normalizeScript rejects
  // anything that isn't a real 4-panel script before we pay for the image.
  const { system, user } = buildScriptPrompt(studioReq);
  let script: ReturnType<typeof normalizeScript>;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: scriptModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 1400,
      }),
    });
    if (!res.ok) throw new Error(`openai_${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    script = normalizeScript(JSON.parse(data.choices?.[0]?.message?.content ?? "{}"));
  } catch (err) {
    const detail = err instanceof Error ? err.message : "studio_script_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  // 2) Page art. One portrait page, 2x2 grid, no baked text (dialogue renders
  // in the reader like the saga's translation boxes).
  let imageB64: string;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: imageModel,
        prompt: buildPagePrompt(studioReq.styleKey, script.panels),
        size: STUDIO_IMAGE_SIZE,
        quality: imageQuality,
        n: 1,
        output_format: "png",
        moderation: "low",
      }),
    });
    if (!res.ok) throw new Error(`openai_image_${res.status}`);
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    imageB64 = data.data?.[0]?.b64_json ?? "";
    if (!imageB64) throw new Error("openai_image_empty");
  } catch (err) {
    const detail = err instanceof Error ? err.message : "studio_image_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  const meta: StudioCreationMeta = {
    id: crypto.randomUUID(),
    ownerId: profile.id,
    title: script.title,
    words: studioReq.words,
    styleKey: studioReq.styleKey,
    premise: studioReq.premise,
    panels: script.panels,
    isPublic: false,
    createdAt: new Date().toISOString(),
  };
  await putCreation(meta, imageB64);
  const newUsed = await incrementStudioUsage(profile.id, month);

  return NextResponse.json({
    creation: meta,
    usage: { used: newUsed, limit: owner ? Number.MAX_SAFE_INTEGER : limit },
  });
}
