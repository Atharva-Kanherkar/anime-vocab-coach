import { resolveProfile } from "@/lib/auth";
import { runTts } from "@/lib/tts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const text = typeof (body as { text?: string }).text === "string" ? (body as { text: string }).text.trim() : "";
  if (!text) return new Response(JSON.stringify({ error: "missing_text" }), { status: 400 });

  try {
    const audio = await runTts(text);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "tts_failed";
    const status = detail === "ai_not_configured" ? 503 : 502;
    return new Response(JSON.stringify({ error: detail }), { status });
  }
}
