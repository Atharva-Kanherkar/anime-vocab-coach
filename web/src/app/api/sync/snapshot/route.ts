import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CLERK_ENABLED } from "@/lib/flags";
import { getCloudSyncEnvelope, putCloudSyncEnvelope } from "@/lib/sync-store";
import {
  applyCloudSyncUpdate,
  type CloudSyncSnapshot,
  type CloudUserProfile,
} from "@/lib/sync";

export const dynamic = "force-dynamic";

async function resolveProfile(): Promise<CloudUserProfile | null> {
  if (!CLERK_ENABLED) {
    return { id: "local-dev", email: null, name: "Local dev" };
  }

  const user = await currentUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    name: user.firstName || user.username || null,
  };
}

export async function GET() {
  const profile = await resolveProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const envelope = await getCloudSyncEnvelope(profile.id);
    return NextResponse.json({ envelope, profile });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync_store_unavailable" },
      { status: 503 }
    );
  }
}

export async function PUT(req: Request) {
  const profile = await resolveProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as {
    snapshot?: CloudSyncSnapshot;
    expectedRevision?: number | null;
  };

  if (!body.snapshot || body.snapshot.schemaVersion !== 1 || !Array.isArray(body.snapshot.words)) {
    return NextResponse.json({ error: "invalid_snapshot" }, { status: 400 });
  }

  try {
    const current = await getCloudSyncEnvelope(profile.id);
    const next = applyCloudSyncUpdate(
      current,
      profile,
      body.snapshot,
      body.expectedRevision ?? null
    );

    if ("type" in next) {
      return NextResponse.json({ error: next.type, conflict: next }, { status: 409 });
    }

    await putCloudSyncEnvelope(profile.id, next);
    return NextResponse.json({ envelope: next });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync_store_unavailable" },
      { status: 503 }
    );
  }
}
