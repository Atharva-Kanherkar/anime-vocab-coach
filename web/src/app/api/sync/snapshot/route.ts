import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCloudSyncEnvelope, getSyncTokenProfile, putCloudSyncEnvelope } from "@/lib/sync-store";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";
import {
  applyCloudSyncUpdate,
  normalizeAnimeVocabExport,
  normalizeCloudSyncSnapshot,
  type AnimeVocabExport,
  type CloudSyncSnapshot,
  type CloudUserProfile,
} from "@/lib/sync";

export const dynamic = "force-dynamic";

const MAX_SYNC_BODY_BYTES = 1_000_000;
const MAX_SYNC_WORDS = 20_000;
const MAX_SYNC_DAILY_ROWS = 5_000;
const MAX_SYNC_CARD_TIMESTAMPS = 10_000;

// Two auth paths: a signed-in web session (Clerk cookie) OR a sync token in the
// Authorization header (the extension's background credential). Token wins when
// present so the extension never depends on cookies.
async function resolveProfile(req: Request): Promise<CloudUserProfile | null> {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(avc_st_[A-Za-z0-9]+)$/);
  if (match) return getSyncTokenProfile(match[1]);

  if (DEV_NO_CLERK) return { ...DEV_PROFILE };

  const user = await currentUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    name: user.firstName || user.username || null,
  };
}

export async function GET(req: Request) {
  const profile = await resolveProfile(req);
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
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    // Web import sends a pre-normalized cloud snapshot; the extension sends its
    // raw export (settings/vocab/stats) and we normalize it here so both paths
    // share one shape.
    snapshot?: CloudSyncSnapshot;
    export?: AnimeVocabExport;
    expectedRevision?: number | null;
  };
  let snapshot: CloudSyncSnapshot;

  try {
    const raw = await req.text();
    if (raw.length > MAX_SYNC_BODY_BYTES) {
      return NextResponse.json({ error: "snapshot_too_large" }, { status: 413 });
    }
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    snapshot = body.export
      ? normalizeAnimeVocabExport(body.export)
      : normalizeCloudSyncSnapshot(body.snapshot);
  } catch {
    return NextResponse.json({ error: "invalid_snapshot" }, { status: 400 });
  }

  if (
    snapshot.words.length > MAX_SYNC_WORDS ||
    snapshot.daily.length > MAX_SYNC_DAILY_ROWS ||
    snapshot.cardTimestamps.length > MAX_SYNC_CARD_TIMESTAMPS
  ) {
    return NextResponse.json({ error: "snapshot_too_large" }, { status: 413 });
  }

  try {
    const current = await getCloudSyncEnvelope(profile.id);
    const next = applyCloudSyncUpdate(
      current,
      profile,
      snapshot,
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
