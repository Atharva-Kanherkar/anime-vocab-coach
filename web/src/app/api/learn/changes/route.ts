import { resolveProfile } from "@/lib/auth";
import { getLearnStore } from "@/lib/learn-server";
import { learnFailure, learnJson } from "@/lib/learn-http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return learnJson({ error: "unauthorized" }, 401);
  try {
    const params = new URL(req.url).searchParams;
    const since = params.get("since") || "0";
    // limit=0 is the cheap identity probe: user and epoch, no history.
    const limit = params.get("limit") ?? "100";
    if (!/^\d+$/.test(since) || !/^\d+$/.test(limit) || Number(limit) > 100)
      return learnJson({ error: "invalid_cursor" }, 400);
    return learnJson({
      ...(await (await getLearnStore(profile.id)).changes(
        Number(since),
        Number(limit),
      )),
      userId: profile.id,
    });
  } catch (err) {
    return learnFailure(err);
  }
}
