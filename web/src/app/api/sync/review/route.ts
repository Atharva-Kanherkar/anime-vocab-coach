import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getCloudSyncEnvelope, putCloudSyncEnvelope } from "@/lib/sync-store";
import { applyWebReview, isDayKey, isWebReviewResult } from "@/lib/web-review";
import type { CloudSyncEnvelope } from "@/lib/sync";

export const dynamic = "force-dynamic";

const MAX_REVIEW_BODY_BYTES = 4_000;
const MAX_BASE_LENGTH = 200;

/**
 * Judge one due word from the cloud app (F6). Applies the extension's SRS to
 * the stored envelope and logs the op so the extension can replay it.
 */
export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { base?: unknown; result?: unknown; day?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > MAX_REVIEW_BODY_BYTES) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { base, result, day } = body;
  if (typeof base !== "string" || !base || base.length > MAX_BASE_LENGTH || !isWebReviewResult(result) || !isDayKey(day)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const current = await getCloudSyncEnvelope(profile.id);
    if (!current) return NextResponse.json({ error: "word_not_found" }, { status: 404 });

    const now = new Date();
    let outcome = applyWebReview(current, base, result, day, now);
    if (!outcome.ok) return errorResponse(outcome.error);

    // KV has no compare-and-set. Re-read just before writing and, if an
    // extension push (or a second tab) landed in between, re-apply on top of
    // it instead of overwriting it with our stale copy. This narrows the race
    // to the few milliseconds between this read and the put, the same window
    // the PUT route's optimistic revisions already live with.
    const latest = await getCloudSyncEnvelope(profile.id);
    if (latest && latest.revision !== current.revision) {
      outcome = applyWebReview(latest, base, result, day, now);
      // The other writer may have judged this word already. Then it is no
      // longer due and the honest answer is not_due, not a double review.
      if (!outcome.ok) return errorResponse(outcome.error);
    }

    const envelope: CloudSyncEnvelope = outcome.envelope;
    await putCloudSyncEnvelope(profile.id, envelope);
    return NextResponse.json({ envelope, word: outcome.word });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync_store_unavailable" },
      { status: 503 }
    );
  }
}

function errorResponse(error: "word_not_found" | "not_due") {
  return NextResponse.json({ error }, { status: error === "word_not_found" ? 404 : 409 });
}
