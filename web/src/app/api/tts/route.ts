import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { currentMonth, getUsage, incrementUsage, quotaFor } from "@/lib/ai-store";
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

  // Meter TTS on the "auto" bucket, not the coach allowance: pronunciation
  // plays automatically on every card (settings.autoSpeak defaults on), so
  // charging it to the advertised AI messages drained them silently. Cache hits
  // don't spend (onBeforeSpend only runs on a miss); owners are unlimited.
  const owner = isOwnerEmail(profile.email);
  const limit = await quotaFor(resolvePlan(profile), "auto", owner);
  const month = currentMonth();

  try {
    const { audio, cached } = await runTts(text, {
      onBeforeSpend: async () => {
        const used = await getUsage(profile.id, month, "auto");
        if (used >= limit) throw new Error("auto_quota_exhausted");
      },
    });
    if (!cached) {
      // Soft-fail the meter write: the audio already synthesized, so a KV
      // put-limit rejection must not turn a delivered buffer into an error.
      try {
        await incrementUsage(profile.id, month, "auto");
      } catch (meterErr) {
        console.warn("[tts] usage meter write failed", meterErr);
      }
    }
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "tts_failed";
    const status =
      detail === "ai_not_configured" ? 503 : detail === "auto_quota_exhausted" ? 429 : 502;
    return new Response(JSON.stringify({ error: detail }), { status });
  }
}
