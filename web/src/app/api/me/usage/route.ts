// One place for "how much have I used, and what do I do about it".
//
// The extension popup and the in-player copilot both need this to render a
// meter and an upgrade prompt, and before this route existed neither had any
// way to ask: a learner only discovered a cap by watching features quietly
// stop working. Answers a signed-in web session or the extension's sync token.

import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { currentMonth, getUsage, quotaFor } from "@/lib/ai-store";
import { checkoutFor, TIERS } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Anything at or above this is "effectively unlimited" — show it as such
 * rather than rendering a meter against a million. */
const UNLIMITED_THRESHOLD = 100_000;

export async function GET(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const owner = isOwnerEmail(profile.email);
  const plan = resolvePlan(profile);
  const month = currentMonth();

  const [aiUsed, autoUsed, aiLimit, autoLimit] = await Promise.all([
    getUsage(profile.id, month, "ai"),
    getUsage(profile.id, month, "auto"),
    quotaFor(plan, "ai", owner),
    quotaFor(plan, "auto", owner),
  ]);

  return NextResponse.json({
    plan,
    month,
    unlimited: owner || aiLimit >= UNLIMITED_THRESHOLD,
    ai: { used: aiUsed, limit: aiLimit, left: Math.max(0, aiLimit - aiUsed) },
    auto: { used: autoUsed, limit: autoLimit, left: Math.max(0, autoLimit - autoUsed) },
    // Sent along so the extension can link straight to checkout without
    // duplicating (and drifting from) the Dodo product ids.
    tiers: {
      pro: {
        name: TIERS.pro.name,
        priceLabel: TIERS.pro.priceLabel,
        aiCallsPerMonth: TIERS.pro.aiCallsPerMonth,
        listeningMinutes: TIERS.pro.listeningMinutes,
        checkoutUrl: checkoutFor("pro"),
      },
      max: {
        name: TIERS.max.name,
        priceLabel: TIERS.max.priceLabel,
        aiCallsPerMonth: TIERS.max.aiCallsPerMonth,
        listeningMinutes: TIERS.max.listeningMinutes,
        checkoutUrl: checkoutFor("max"),
      },
    },
  });
}
