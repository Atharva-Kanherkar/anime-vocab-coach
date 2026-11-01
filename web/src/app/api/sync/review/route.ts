import { resolveProfile } from "@/lib/auth";
import { getLearnStore, getLearnEnvelope } from "@/lib/learn-server";
import { learnBody,learnFailure,learnJson } from "@/lib/learn-http";
import { newLearnOp } from "../../../../../../shared/learn/model";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return learnJson({error:"unauthorized"},401);
  try {
    const body = await learnBody(req,4000);
    const op = newLearnOp("review",{base:body.base,result:body.result,day:body.day},typeof body.op_id === "string" ? body.op_id : undefined,typeof body.client_ts === "string" ? body.client_ts : undefined);
    await (await getLearnStore(profile.id)).apply([op]);
    const envelope = await getLearnEnvelope(profile);
    return learnJson({envelope,word:envelope.snapshot.words.find(w=>w.base===body.base)});
  } catch(err) { return learnFailure(err); }
}
