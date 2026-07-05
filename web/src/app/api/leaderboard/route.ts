import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { listWeek } from "@/lib/leaderboard-store";
import { currentWeekId } from "@/lib/gamification";

export const dynamic = "force-dynamic";

// GET /api/leaderboard → this week's board (weekly words reviewed, desc), the
// caller's own rank, and the week id. Opted-out / inactive entries are hidden.
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const week = currentWeekId(new Date());
  try {
    const all = await listWeek(week);
    const active = all
      .filter((e) => e.name && (e.wordsReviewed > 0 || e.minutes > 0 || e.streak > 0))
      .sort((a, b) => b.wordsReviewed - a.wordsReviewed || b.minutes - a.minutes || b.streak - a.streak);

    const myIndex = active.findIndex((e) => e.userId === profile.id);
    const me =
      myIndex >= 0
        ? { rank: myIndex + 1, name: active[myIndex].name, wordsReviewed: active[myIndex].wordsReviewed, minutes: active[myIndex].minutes, streak: active[myIndex].streak }
        : null;

    const entries = active.slice(0, 50).map((e) => ({
      name: e.name,
      wordsReviewed: e.wordsReviewed,
      minutes: e.minutes,
      streak: e.streak,
    }));

    return NextResponse.json({ week, entries, me });
  } catch (err) {
    console.error("[leaderboard]", err);
    return NextResponse.json({ error: "leaderboard_unavailable" }, { status: 503 });
  }
}
