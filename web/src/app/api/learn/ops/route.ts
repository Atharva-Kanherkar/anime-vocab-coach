import { after } from "next/server";
import { recordProgressEvents, updateLeaderboard } from "@/lib/learn-progress";
import { resolveProfile } from "@/lib/auth";
import { getLearnStore, snapshotFromState } from "@/lib/learn-server";
import { learnBody, learnFailure, learnJson } from "@/lib/learn-http";
import { validateLearnOps } from "../../../../lib/learn-protocol/validate";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return learnJson({ error: "unauthorized" }, 401);
  try {
    const body = await learnBody(req);
    const ops = validateLearnOps(body.ops);
    const epoch = Number.isSafeInteger(body.epoch) ? Number(body.epoch) : undefined;
    // apply() already holds the before/after state, so progress needs no reread.
    const { before, after: next, ...result } = await (
      await getLearnStore(profile.id)
    ).apply(ops, { epoch, snapshots: true });
    if (result.changed && before && next)
      after(async () => {
        try {
          const snapshot = snapshotFromState(next);
          await updateLeaderboard(profile, snapshot);
          await recordProgressEvents(
            req,
            profile,
            snapshotFromState(before),
            snapshot,
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
