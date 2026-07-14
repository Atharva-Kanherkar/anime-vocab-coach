import { NextResponse } from "next/server";
import { getOpenAiKey } from "@/lib/ai-store";
import { getStudioConfig } from "@/lib/studio-store";
import { ENDING_PANEL_COUNT } from "@/lib/ending-funnel";
import {
  getEndingCreation,
  getEndingPanel,
  putEndingCreation,
  putEndingPanel,
  trackEndingEvent,
} from "@/lib/ending-store";
import { generateEndingPanelImage } from "@/lib/ending-openai";

export const dynamic = "force-dynamic";

// Draw ONE panel of an already-created ending. The cost is bounded by the
// creation itself (ids are unguessable, panels are capped at 5 and cached),
// so the quota was already spent at /api/ending/generate time. Idempotent:
// a retry or a second tab returns the stored image instead of re-drawing.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id.slice(0, 40) : "";
  const i = typeof b.i === "number" && Number.isInteger(b.i) ? b.i : -1;
  if (!id || i < 0 || i >= ENDING_PANEL_COUNT) {
    return NextResponse.json({ error: "invalid_panel" }, { status: 400 });
  }

  const creation = await getEndingCreation(id);
  if (!creation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const panel = creation.panels[i];
  if (!panel) return NextResponse.json({ error: "invalid_panel" }, { status: 400 });

  const cached = await getEndingPanel(id, i);
  if (cached) {
    return NextResponse.json({ image: `data:image/png;base64,${cached}`, cached: true });
  }

  const apiKey = await getOpenAiKey();
  if (!apiKey) return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  const { imageModel, imageQuality } = await getStudioConfig();

  let imageB64: string;
  try {
    imageB64 = await generateEndingPanelImage(apiKey, {
      model: imageModel,
      quality: imageQuality,
      styleKey: creation.styleKey,
      seriesTitle: creation.seriesTitle,
      panelIndex: i,
      scene: panel.scene,
      cast: creation.cast,
      lines: panel.lines,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "ending_image_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  // Both writes are soft-fail: this panel's image is returned directly below, so
  // a KV put-limit rejection must not 500 an already-drawn, already-paid panel.
  // (Worst case: a retry re-draws instead of serving the cached copy.)
  const done = Math.max(creation.done, i + 1);
  try {
    await putEndingPanel(id, i, imageB64);
    await putEndingCreation({ ...creation, done });
  } catch (err) {
    console.warn("[ending/panel] panel cache write failed", err);
  }
  void trackEndingEvent("panel_done");
  if (done >= ENDING_PANEL_COUNT) void trackEndingEvent("ending_complete");

  return NextResponse.json({ image: `data:image/png;base64,${imageB64}` });
}
