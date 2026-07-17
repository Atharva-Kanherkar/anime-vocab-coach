import { isExtensionEvent } from "@/lib/extension-funnel";
import { trackExtensionEvent } from "@/lib/extension-store";

export const dynamic = "force-dynamic";

// Beacon endpoint for extension product-funnel counters (sendBeacon / keepalive
// fetch friendly: tiny JSON body, always 204). Events are allowlisted.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { event?: unknown };
    if (isExtensionEvent(body.event)) await trackExtensionEvent(body.event);
  } catch {
    // malformed — ignore
  }
  return new Response(null, { status: 204 });
}
