import { resolveProfile } from "@/lib/auth";
import { getLearnStore } from "@/lib/learn-server";
import { learnBody,learnFailure,learnJson } from "@/lib/learn-http";
import { validateLearnOps } from "../../../../../../shared/learn/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return learnJson({error:"unauthorized"},401);
  try {
    const ops = validateLearnOps((await learnBody(req)).ops);
    return learnJson(await (await getLearnStore(profile.id)).apply(ops));
  } catch (err) { return learnFailure(err); }
}
