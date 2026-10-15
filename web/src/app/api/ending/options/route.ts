import { NextResponse } from "next/server";
import { getOpenAiKey } from "@/lib/ai-store";
import { getStudioConfig } from "@/lib/studio-store";
import {
  currentStatsDay,
  getEndingConfig,
  hashIp,
  spendOptionsBudget,
  trackEndingEvent,
} from "@/lib/ending-store";
import { clientIp } from "@/lib/studio-store";
import { resolveProfile } from "@/lib/auth";
import { STUDIO_STYLES } from "@/lib/studio";
import type { StyleKey } from "@/lib/cards";
import { upstreamTimeout } from "@/lib/upstream";

export const dynamic = "force-dynamic";

// Agentic: given ANY manga/anime title, invent 3 fan-ending options plus a
// matching art style. A cheap chat call — the free slot is only spent when the
// visitor commits at /api/ending/generate, so browsing endings costs nothing.
// It needs no account, so it carries its own daily budget per caller (hashed
// IP, or user when signed in) plus a global one; before that, a loop could
// call OpenAI on the owner's key without limit.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 80) : "";
  const synopsis = typeof b.synopsis === "string" ? b.synopsis.trim().slice(0, 500) : "";
  if (!title || title.length < 2) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });

  const [profile, config] = await Promise.all([resolveProfile(req), getEndingConfig()]);
  const day = currentStatsDay();
  const caller = profile ? `u:${profile.id}` : `ip:${await hashIp(clientIp(req))}`;
  const callerLimit = profile ? config.optionsPerUserPerDay : config.optionsPerIpPerDay;
  // Spend first and decide on the total that comes back: atomic, so parallel
  // requests each see their own count. Spending before the upstream call also
  // means a request that times out there is still counted.
  const spent = await spendOptionsBudget(caller, day);
  if (spent.caller > callerLimit || spent.global > config.optionsGlobalPerDay) {
    return NextResponse.json(
      { error: spent.caller > callerLimit ? "options_limit" : "capacity", needsLogin: !profile },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const { scriptModel } = await getStudioConfig();

  const system =
    "You invent fan-ending options for anime/manga fandom creative play (unofficial fan art / " +
    "fan fiction territory — famous series use their iconic canon characters). " +
    'Return strict JSON: {"styleKey":string,"options":[{"id":string,"title":string,' +
    '"blurb":string,"tone":string,"premiseBeat":string}]}. Exactly 3 options, each a DIFFERENT ' +
    "flavor (one heartfelt, one surprising/comedic, one dramatic/bittersweet). Titles are short " +
    "hooks a fan can't resist tapping. blurb is one teasing sentence. premiseBeat is 1-2 " +
    "sentences telling a mangaka what happens in that fan epilogue — concrete, post-finale, " +
    "spoiler-light. tone is one word like Heartfelt, Comedic, Wholesome, Dramatic, Bittersweet, " +
    'Hopeful. styleKey is the best-fitting art style from: "slayer" (bold shonen action), ' +
    '"spirit" (soft Ghibli watercolor), "neon" (cinematic modern), "chibi" (cute cozy), ' +
    '"shadow" (dark moody), "mecha" (sci-fi).';

  const user = `Manga/anime title: ${title}\nContext: ${synopsis || "Right after the official finale."}\nInvent the 3 fan endings.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: upstreamTimeout("chat"),
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
      styleKey?: string;
      options?: { id?: string; title?: string; blurb?: string; tone?: string; premiseBeat?: string }[];
    };
    const styleKey = (
      STUDIO_STYLES.includes(parsed.styleKey as StyleKey) ? parsed.styleKey : "slayer"
    ) as StyleKey;
    const options = (parsed.options ?? []).slice(0, 3).map((o, i) => ({
      id: (o.id || `opt-${i}`).slice(0, 40),
      title: (o.title || `Ending ${i + 1}`).slice(0, 80),
      blurb: (o.blurb || "").slice(0, 200),
      tone: (o.tone || "Heartfelt").slice(0, 40),
      premiseBeat: (o.premiseBeat || `Fan ending for ${title}.`).slice(0, 500),
    }));
    if (options.length < 3) {
      return NextResponse.json({ error: "options_failed" }, { status: 502 });
    }
    void trackEndingEvent("options_invented");
    return NextResponse.json({ title, styleKey, options });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "options_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
