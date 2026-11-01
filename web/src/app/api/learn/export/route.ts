import { resolveProfile } from "@/lib/auth";
import { getLearnStore, getLearnEnvelope } from "@/lib/learn-server";
import { learnFailure,learnJson } from "@/lib/learn-http";
import { cloudSnapshotToAnimeVocabExport } from "@/lib/sync";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return learnJson({error:"unauthorized"},401);
  try { return learnJson({...await (await getLearnStore(profile.id)).export(),...cloudSnapshotToAnimeVocabExport((await getLearnEnvelope(profile)).snapshot)}); }
  catch (err) { return learnFailure(err); }
}
