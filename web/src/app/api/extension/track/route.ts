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
// Writes only after: allowlisted extension identity, size limit, IP rate limit,
// and allowlisted event name. Counters go to Analytics Engine (append-only).
export async function POST(req: Request) {
  try {
    if (!isAllowedExtensionClient(req)) {
      return new Response(null, { status: 204 });
    }

    const len = Number(req.headers.get("content-length") || 0);
    if (Number.isFinite(len) && len > EXTENSION_TRACK_MAX_BODY_BYTES) {
      return new Response(null, { status: 204 });
    }

    const ipHash = await hashTrackIp(clientIp(req));
    if (!(await allowExtensionTrack(ipHash))) {
      return new Response(null, { status: 204 });
    }

    const body = (await req.json()) as { event?: unknown };
    if (isExtensionEvent(body.event)) await trackExtensionEvent(body.event);
  } catch {
    // malformed / infra — ignore
  }
  return new Response(null, { status: 204 });
}
