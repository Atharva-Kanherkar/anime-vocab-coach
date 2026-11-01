import { recordProgressEvents, updateLeaderboard } from "@/lib/learn-progress";
import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getLearnStore, getLearnEnvelope, snapshotImportOps } from "@/lib/learn-server";
import { learnBody, learnFailure } from "@/lib/learn-http";
import { normalizeAnimeVocabExport, normalizeCloudSyncSnapshot } from "@/lib/sync";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({error:"unauthorized"},{status:401});
  try { return NextResponse.json({envelope:await getLearnEnvelope(profile),profile},{headers:{"Cache-Control":"private, no-store"}}); }
  catch(err) { return learnFailure(err); }
}
/** Legacy uploads are insert-only imports. They can never replace cloud SRS or settings. */
export async function PUT(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({error:"unauthorized"},{status:401});
  try {
    const body = await learnBody(req,1_000_000);
    if (!body.export && !body.snapshot) return NextResponse.json({error:"invalid_snapshot"},{status:400});
    const snapshot = body.export ? normalizeAnimeVocabExport(body.export) : normalizeCloudSyncSnapshot(body.snapshot);
    if (snapshot.words.length>20000 || snapshot.daily.length>5000) return NextResponse.json({error:"snapshot_too_large"},{status:413});
    const store = await getLearnStore(profile.id);
    const before = await getLearnEnvelope(profile);
    const ops = snapshotImportOps(snapshot,crypto.randomUUID());
    for (let i=0;i<ops.length;i+=50) await store.apply(ops.slice(i,i+50));
    const envelope = await getLearnEnvelope(profile);
    await updateLeaderboard(profile,envelope.snapshot).catch(err=>console.error("[learn] leaderboard",err));
    await recordProgressEvents(req,profile,before.snapshot,envelope.snapshot).catch(err=>console.error("[learn] progress",err));
    return NextResponse.json({envelope});
  } catch(err) { return learnFailure(err); }
}
