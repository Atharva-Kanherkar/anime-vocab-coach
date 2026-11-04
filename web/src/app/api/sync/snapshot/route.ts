import { recordProgressEvents, updateLeaderboard } from "@/lib/learn-progress";
import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getLearnStore, getLearnEnvelope, envelopeFromState, newImportOps, snapshotFromState, snapshotImportOps } from "@/lib/learn-server";
import { learnBody, learnFailure } from "@/lib/learn-http";
import { normalizeAnimeVocabExport, normalizeCloudSyncSnapshot } from "@/lib/sync";
export const dynamic = "force-dynamic";
const PRIVATE = {"Cache-Control":"private, no-store"};
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({error:"unauthorized"},{status:401});
  try {
    const store = await getLearnStore(profile.id);
    // The site polls every few seconds; an unchanged revision costs one row.
    const known = new URL(req.url).searchParams.get("known");
    if (known && /^\d+$/.test(known)) {
      const { revision } = await store.account();
      if (revision === Number(known)) return NextResponse.json({unchanged:true,revision},{headers:PRIVATE});
    }
    return NextResponse.json({envelope:await getLearnEnvelope(profile,store),profile},{headers:PRIVATE});
  }
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
    const current = await store.read({notebooks:false});
    const ops = newImportOps(current.state,snapshotImportOps(snapshot,crypto.randomUUID()));
    if (!ops.length) return NextResponse.json({envelope:envelopeFromState(profile,current.state,current.revision)});
    let latest = { state: current.state, revision: current.revision };
    for (let i=0;i<ops.length;i+=50) {
      const { after, revision } = await store.apply(ops.slice(i,i+50),{snapshots:true});
      latest = { state: after!, revision };
    }
    const envelope = envelopeFromState(profile,latest.state,latest.revision);
    await updateLeaderboard(profile,envelope.snapshot).catch(err=>console.error("[learn] leaderboard",err));
    await recordProgressEvents(req,profile,snapshotFromState(current.state),envelope.snapshot).catch(err=>console.error("[learn] progress",err));
    return NextResponse.json({envelope});
  } catch(err) { return learnFailure(err); }
}
