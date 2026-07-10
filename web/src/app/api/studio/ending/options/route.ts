import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getOpenAiKey } from "@/lib/ai-store";
import {
  clientIp,
  currentDay,
  getAnonDraftUsage,
  getStudioConfig,
} from "@/lib/studio-store";

export const dynamic = "force-dynamic";

/**
 * Agentic: given any manga title (+ optional synopsis), invent 3 fan-ending options.
 * Cheap chat call; uses same anon draft budget as script generation.
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
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 80) : "";
  const synopsis = typeof b.synopsis === "string" ? b.synopsis.trim().slice(0, 500) : "";
  if (!title || title.length < 2) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  // Soft gate only — inventing options is free; script generation consumes the draft.
  const profile = await resolveProfile(req);
  const { scriptModel, anonDraftsPerDay } = await getStudioConfig();
  if (!profile) {
    const ip = clientIp(req);
    const day = currentDay();
    const used = await getAnonDraftUsage(ip, day);
    if (used >= anonDraftsPerDay) {
      return NextResponse.json({ error: "anon_draft_limit", needsLogin: true }, { status: 429 });
    }
  }

  const system =
    "You invent fan-ending options for anime/manga fandom creative play. " +
    "Return strict JSON: { \"options\": [ { \"id\", \"title\", \"blurb\", \"tone\", \"premiseBeat\" } ] } " +
    "Exactly 3 options. tones like Heartfelt, Comedic, Wholesome, Dramatic, Bittersweet, Hopeful. " +
    "premiseBeat is 1-2 sentences instructing an artist/writer how to draw that fan epilogue. " +
    "Assume famous series may use iconic characters. Keep it spoiler-light but post-finale.";

  const user = `Manga/anime title: ${title}\nContext: ${synopsis || "After the official finale."}\nInvent 3 distinct fan endings.`;

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
        temperature: 0.9,
        max_tokens: 900,
      }),
    });
    if (!res.ok) throw new Error(`openai_${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as {
      options?: {
        id?: string;
        title?: string;
        blurb?: string;
        tone?: string;
        premiseBeat?: string;
      }[];
    };
    const options = (parsed.options ?? [])
      .slice(0, 3)
      .map((o, i) => ({
        id: (o.id || `opt-${i}`).slice(0, 40),
        title: (o.title || `Ending ${i + 1}`).slice(0, 80),
        blurb: (o.blurb || "").slice(0, 200),
        tone: (o.tone || "Heartfelt").slice(0, 40),
        premiseBeat: (o.premiseBeat || `Fan ending for ${title}.`).slice(0, 500),
      }));
    if (options.length < 3) {
      return NextResponse.json({ error: "options_failed" }, { status: 502 });
    }
    return NextResponse.json({ title, options });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "options_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
