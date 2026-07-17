import { isExtensionEvent } from "@/lib/extension-funnel";
import {
  EXTENSION_TRACK_MAX_BODY_BYTES,
  allowExtensionTrack,
  clientIp,
  hashTrackIp,
  isAllowedExtensionClient,
  trackExtensionEvent,
} from "@/lib/extension-store";

export const dynamic = "force-dynamic";

// Extension product-funnel beacon. Always 204 so probes learn nothing.
// Writes only after: allowlisted extension identity, actual body size limit,
// allowlisted event name, then IP rate limit. Counters → Analytics Engine.
export async function POST(req: Request) {
  try {
    if (!isAllowedExtensionClient(req)) {
      return new Response(null, { status: 204 });
    }

    // Measure the real body — Content-Length is missing on chunked/HTTP/2 and
    // is spoofable; never trust it as the sole size gate.
    const text = await req.text();
    if (text.length > EXTENSION_TRACK_MAX_BODY_BYTES) {
      return new Response(null, { status: 204 });
    }

    let event: unknown;
    try {
      event = (JSON.parse(text) as { event?: unknown }).event;
    } catch {
      return new Response(null, { status: 204 });
    }
    if (!isExtensionEvent(event)) {
      return new Response(null, { status: 204 });
    }

    // Spend rate-limit budget only for allowlisted events.
    const ipHash = await hashTrackIp(clientIp(req));
    if (!(await allowExtensionTrack(ipHash))) {
      return new Response(null, { status: 204 });
    }

    await trackExtensionEvent(event);
  } catch {
    // infra — ignore
  }
  return new Response(null, { status: 204 });
}
