import { after } from "next/server";
import { recordProgressEvents, updateLeaderboard } from "@/lib/learn-progress";
import { resolveProfile } from "@/lib/auth";
import { getLearnStore, getLearnEnvelope } from "@/lib/learn-server";
import { learnBody, learnFailure, learnJson } from "@/lib/learn-http";
import { validateLearnOps } from "../../../../lib/learn-protocol/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return learnJson({ error: "unauthorized" }, 401);
  try {
    const ops = validateLearnOps((await learnBody(req)).ops);
    const before = await getLearnEnvelope(profile);
    const result = await (await getLearnStore(profile.id)).apply(ops);
    after(async () => {
      try {
        const envelope = await getLearnEnvelope(profile);
        await updateLeaderboard(profile, envelope.snapshot);
        await recordProgressEvents(
          req,
          profile,
          before.snapshot,
          envelope.snapshot,
        );
      } catch (err) {
        console.error("[learn] progress update failed", err);
      }
    });
    return learnJson(result);
  } catch (err) {
    return learnFailure(err);
  }
}
