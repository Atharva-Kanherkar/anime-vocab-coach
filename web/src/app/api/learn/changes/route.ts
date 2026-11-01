import { resolveProfile } from "@/lib/auth";
import { getLearnStore } from "@/lib/learn-server";
import { learnFailure,learnJson } from "@/lib/learn-http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return learnJson({error:"unauthorized"},401);
  try {
    const since = new URL(req.url).searchParams.get("since") || "0";
    if (!/^\d+$/.test(since)) return learnJson({error:"invalid_cursor"},400);
    return learnJson({...await (await getLearnStore(profile.id)).changes(Number(since)),userId:profile.id});
  } catch (err) { return learnFailure(err); }
}
