import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { currentMonth, getOpenAiKey } from "@/lib/ai-store";
import { clientIp, currentDay, getStudioConfig } from "@/lib/studio-store";
import {
  ENDING_PANEL_COUNT,
  type EndingCreation,
  type EndingScriptRequest,
} from "@/lib/ending-funnel";
import {
  getEndingConfig,
  getGlobalEndingCount,
  getIpEndingCount,
  getSignedEndingCount,
  hashIp,
  incrementGlobalEndingCount,
  incrementIpEndingCount,
  incrementSignedEndingCount,
  putEndingCreation,
  trackEndingEvent,
} from "@/lib/ending-store";
import { generateEndingScript } from "@/lib/ending-openai";
import { getEndingChoice, getFeaturedEnding } from "@/lib/ending-hooks";
import { STUDIO_STYLES } from "@/lib/studio";
import type { StyleKey } from "@/lib/cards";

export const dynamic = "force-dynamic";

// The Ending Bender — the funnel's own generation endpoint (NOT the studio's).
// One call = the script for one 5-panel fan-ending manga plus a creation id;
// the client then draws each panel via /api/ending/panel.
//
// The gate is the funnel's whole business model:
//   anonymous  → ENDING_FREE_PER_IP endings per IP (default 1 — the free taste)
//   signed-in  → ENDING_SIGNED_PER_MONTH per month (default 3 — sign-up carrot)
//   owner      → unlimited
// Exhausted ⇒ 402 { paywall: true } and the client shows the upgrade screen.
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

  // ── Resolve the request into a script brief ─────────────────────────────
  let scriptReq: EndingScriptRequest;
  let meta: {
    source: "catalog" | "custom";
    seriesTitle: string;
    seriesSub: string;
    endingTitle: string;
    tone: string;
    styleKey: StyleKey;
    accent: string;
  };

  const customNote = typeof b.customNote === "string" ? b.customNote.slice(0, 280) : "";

  if (b.mode === "custom") {
    const title = typeof b.title === "string" ? b.title.trim().slice(0, 80) : "";
    if (!title || title.length < 2) {
      return NextResponse.json({ error: "title_required" }, { status: 400 });
    }
    const synopsis = typeof b.synopsis === "string" ? b.synopsis.trim().slice(0, 600) : "";
    const endingTitle =
      typeof b.endingTitle === "string" ? b.endingTitle.trim().slice(0, 80) : "Fan ending";
    const tone = typeof b.tone === "string" ? b.tone.trim().slice(0, 40) : "Heartfelt";
    const premiseBeat =
      typeof b.premiseBeat === "string"
        ? b.premiseBeat.trim().slice(0, 500)
        : `A fan-made epilogue ending for ${title}.`;
    const styleRaw = typeof b.styleKey === "string" ? b.styleKey : "slayer";
    const styleKey = (STUDIO_STYLES.includes(styleRaw as StyleKey) ? styleRaw : "slayer") as StyleKey;

    scriptReq = {
      seriesTitle: title,
      synopsis: synopsis || `Right after the official finale of ${title}.`,
      endingTitle,
      tone,
      premiseBeat,
      customNote,
      language: "English",
      cast: [],
    };
    meta = {
      source: "custom",
      seriesTitle: title,
      seriesSub: "",
      endingTitle,
      tone,
      styleKey,
      accent: "#e8a54b",
    };
  } else {
    const mangaId = typeof b.mangaId === "string" ? b.mangaId : "";
    const endingId = typeof b.endingId === "string" ? b.endingId : "";
    const manga = getFeaturedEnding(mangaId);
    if (!manga) return NextResponse.json({ error: "manga_not_found" }, { status: 404 });
    const choice = getEndingChoice(manga, endingId);
    if (!choice) return NextResponse.json({ error: "ending_not_found" }, { status: 400 });

    scriptReq = {
      seriesTitle: manga.title,
      seriesSub: manga.subtitle,
      synopsis: manga.synopsis,
      endingTitle: choice.title,
      tone: choice.tone,
      premiseBeat: choice.premiseBeat,
      customNote,
      language: manga.language,
      cast: manga.cast,
    };
    meta = {
      source: "catalog",
      seriesTitle: manga.title,
      seriesSub: manga.subtitle,
      endingTitle: choice.title,
      tone: choice.tone,
      styleKey: manga.styleKey,
      accent: manga.accent,
    };
  }

  // ── The gate ─────────────────────────────────────────────────────────────
  void trackEndingEvent("generate_start");

  const profile = await resolveProfile(req);
  const owner = isOwnerEmail(profile?.email);
  const { freePerIp, signedPerMonth, globalPerDay } = await getEndingConfig();

  const globalUsed = await getGlobalEndingCount(currentDay());
  if (!owner && globalUsed >= globalPerDay) {
    return NextResponse.json({ error: "capacity", paywall: false }, { status: 503 });
  }

  const ipHash = await hashIp(clientIp(req));
  if (!owner) {
    if (profile) {
      const used = await getSignedEndingCount(profile.id, currentMonth());
      if (used >= signedPerMonth) {
        void trackEndingEvent("paywall_shown");
        return NextResponse.json(
          { error: "ending_limit", paywall: true, needsLogin: false },
          { status: 402 }
        );
      }
    } else {
      const used = await getIpEndingCount(ipHash);
      if (used >= freePerIp) {
        void trackEndingEvent("paywall_shown");
        return NextResponse.json(
          { error: "ending_limit", paywall: true, needsLogin: true },
          { status: 402 }
        );
      }
    }
  }

  // ── Write the script ─────────────────────────────────────────────────────
  const { scriptModel } = await getStudioConfig();
  let script;
  try {
    script = await generateEndingScript(apiKey, scriptModel, scriptReq);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "ending_script_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  const creation: EndingCreation = {
    ...script,
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 20),
    createdAt: new Date().toISOString(),
    source: meta.source,
    seriesTitle: meta.seriesTitle,
    seriesSub: meta.seriesSub,
    endingTitle: meta.endingTitle,
    tone: meta.tone,
    styleKey: meta.styleKey,
    accent: meta.accent,
    language: scriptReq.language,
    done: 0,
  };
  await putEndingCreation(creation);

  // Count only after the script succeeded — a failed call never spends the slot.
  if (!owner) {
    if (profile) await incrementSignedEndingCount(profile.id, currentMonth());
    else await incrementIpEndingCount(ipHash);
    await incrementGlobalEndingCount(currentDay());
  }
  void trackEndingEvent("script_ok");

  return NextResponse.json({
    id: creation.id,
    title: creation.title,
    logline: creation.logline,
    cast: creation.cast,
    panels: creation.panels,
    panelCount: ENDING_PANEL_COUNT,
    accent: creation.accent,
    seriesTitle: creation.seriesTitle,
    endingTitle: creation.endingTitle,
  });
}
