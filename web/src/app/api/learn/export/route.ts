import { resolveProfile } from "@/lib/auth";
import { getLearnStore } from "@/lib/learn-server";
import { learnFailure,learnJson } from "@/lib/learn-http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return learnJson({error:"unauthorized"},401);
  try { return learnJson(await (await getLearnStore(profile.id)).export()); }
  catch (err) { return learnFailure(err); }
}
