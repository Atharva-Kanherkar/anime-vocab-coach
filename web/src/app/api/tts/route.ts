import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { currentMonth, quotaFor, reserveUsage, type Reservation } from "@/lib/ai-store";
import { runTts } from "@/lib/tts";
import { withApiTelemetry } from "@/lib/api-telemetry";

export const dynamic = "force-dynamic";

async function handlePOST(req: Request) {
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

  // Reserved lazily: `onBeforeSpend` runs only on a cache miss, so a cache hit
  // still costs nothing. Claiming the slot there — rather than counting after
  // the synthesis returned — means concurrent misses can't all slip past the
  // cap on the same stale count.
  let reservation: Reservation | null = null;
  try {
    const { audio } = await runTts(text, {
      onBeforeSpend: async () => {
        reservation = await reserveUsage(profile.id, month, "auto", limit);
        if (!reservation.ok) throw new Error("auto_quota_exhausted");
      },
    });
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "tts_failed";
    // Synthesis failed after the slot was claimed — give it back. (A refused
    // reservation has a no-op refund, so this is safe either way.)
    if (detail !== "auto_quota_exhausted") {
      await (reservation as Reservation | null)?.refund();
    }
    const status =
      detail === "ai_not_configured" ? 503 : detail === "auto_quota_exhausted" ? 429 : 502;
    return new Response(JSON.stringify({ error: detail }), { status });
  }
}

// Wrapped for #160. TTS spends the same "auto" allowance as word picking and
// extraction, and it was the one auto route with no row at all, so a learner
// walking into the auto cap here never showed up on /owner.
export const POST = withApiTelemetry("/api/tts", handlePOST);
