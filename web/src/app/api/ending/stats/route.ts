import { NextResponse } from "next/server";
import { resolveProfile } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { getEndingStats } from "@/lib/ending-store";

export const dynamic = "force-dynamic";

// Owner-only funnel dashboard data: all-time totals plus a per-day breakdown
// of every funnel event (land → pick → generate → complete → paywall → CTA).
// Read it signed in as an owner: GET /api/ending/stats?days=14
export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!isOwnerEmail(profile?.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const days = Math.min(60, Math.max(1, Number(url.searchParams.get("days")) || 14));
  const stats = await getEndingStats(days);

  const t = stats.totals;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  return NextResponse.json({
    funnel: {
      landed: (t.land_reel ?? 0) + (t.land_end ?? 0),
      picked: t.ending_pick ?? 0,
      generated: t.script_ok ?? 0,
      completed: t.ending_complete ?? 0,
      paywalled: t.paywall_shown ?? 0,
      signupClicks: t.paywall_signup ?? 0,
      checkoutClicks: t.paywall_checkout ?? 0,
      landToGenerate: pct(t.script_ok ?? 0, (t.land_reel ?? 0) + (t.land_end ?? 0)),
      generateToComplete: pct(t.ending_complete ?? 0, t.script_ok ?? 0),
      paywallToCta: pct(
        (t.paywall_signup ?? 0) + (t.paywall_checkout ?? 0),
        t.paywall_shown ?? 0
      ),
    },
    ...stats,
  });
}
