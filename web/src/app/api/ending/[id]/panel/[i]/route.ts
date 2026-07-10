import { getEndingPanel } from "@/lib/ending-store";

export const dynamic = "force-dynamic";

// Serve a stored ending panel as a real PNG — used by the /e/[id] share page
// and as its og:image, so a shared link unfurls with the fan's actual manga.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; i: string }> }
) {
  const { id, i } = await ctx.params;
  const index = Number(i);
  if (!id || !Number.isInteger(index) || index < 0 || index > 11) {
    return new Response("bad request", { status: 400 });
  }

  const b64 = await getEndingPanel(id.slice(0, 40), index);
  if (!b64) return new Response("not found", { status: 404 });

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);

  return new Response(bytes, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
