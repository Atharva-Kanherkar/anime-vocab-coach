import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { getPrefs, putPrefs } from "@/lib/leaderboard-store";

export const dynamic = "force-dynamic";

const MAX_DISPLAY_NAME = 24;

// GET /api/leaderboard/prefs → the caller's display name + opt-out.
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ prefs: await getPrefs(profile.id) });
  } catch (err) {
    console.error("[leaderboard-prefs]", err);
    return NextResponse.json({ error: "prefs_unavailable" }, { status: 503 });
  }
}

// PUT /api/leaderboard/prefs { displayName, optOut }
// Empty displayName = stay anonymous (server uses a derived Learner-#### name).
// optOut = leave the leaderboard entirely (local-only). Takes effect on next sync.
export async function PUT(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { displayName?: unknown; optOut?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim().slice(0, MAX_DISPLAY_NAME) : "";
  const optOut = !!body.optOut;

  try {
    await putPrefs(profile.id, { displayName, optOut });
    return NextResponse.json({ prefs: { displayName, optOut } });
  } catch (err) {
    console.error("[leaderboard-prefs]", err);
    return NextResponse.json({ error: "prefs_unavailable" }, { status: 503 });
  }
}
