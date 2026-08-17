import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { normalizeCfCountry } from "@/lib/localized-pricing";

export const dynamic = "force-dynamic";

/**
 * Visitor country for localized-price display. Public and anonymous: it echoes
 * Cloudflare's IP geolocation (CF-IPCountry) and nothing else. The actual
 * charge is resolved by Dodo from the billing country at checkout — this
 * endpoint only lets the UI show that price up front.
 */
export async function GET(req: Request) {
  let raw: string | null = req.headers.get("cf-ipcountry");
  if (!raw) {
    try {
      const { cf } = await getCloudflareContext({ async: true });
      raw = (cf?.country as string | undefined) ?? null;
    } catch {
      raw = null; // local dev — no Cloudflare context, country stays unknown
    }
  }
  return NextResponse.json(
    { country: normalizeCfCountry(raw) },
    // Private: the answer is per-visitor; a shared cache must never serve one
    // visitor's country to another.
    { headers: { "cache-control": "private, max-age=3600" } }
  );
}
