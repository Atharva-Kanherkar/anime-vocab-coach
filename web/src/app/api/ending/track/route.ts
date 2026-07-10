import { isEndingEvent } from "@/lib/ending-funnel";
import { trackEndingEvent } from "@/lib/ending-store";

export const dynamic = "force-dynamic";

// Beacon endpoint for funnel analytics (sendBeacon-friendly: tiny JSON body,
// always 204). Events are allowlisted; anything else is silently dropped so
// the endpoint can't be used to grow arbitrary keys.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { event?: unknown };
    if (isEndingEvent(body.event)) await trackEndingEvent(body.event);
  } catch {
    // malformed beacon — ignore
  }
  return new Response(null, { status: 204 });
}
