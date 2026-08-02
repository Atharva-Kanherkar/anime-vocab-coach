import { NextResponse } from "next/server";
import { resolveProfile, resolvePlan } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/entitlements";
import { type Tier } from "@/lib/ai-coach";
import {
  getCoachConfig,
  getOpenAiKey,
  getUsage,
  currentMonth,
  getCachedResult,
  quotaFor,
  reserveUsage,
} from "@/lib/ai-store";
import {
  extractCacheKey,
  extractWordsCached,
  normalizeExtractRequest,
  type ExtractWordsResult,
} from "@/lib/extract-words";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const profile = await resolveProfile(req);
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = isOwnerEmail(profile.email);
  const user = { id: profile.id, plan: resolvePlan(profile) };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const normalized = normalizeExtractRequest(body);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  const { req: extractReq } = normalized;

  const apiKey = await getOpenAiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
  }

  // "auto" bucket — the content script extracts words per subtitle line on its
  // own, so this is not spent against the advertised coach allowance.
  const { model } = await getCoachConfig();
  const tier: Tier = user.plan;
  const limit = await quotaFor(user.plan, "auto", owner);
  const month = currentMonth();

  const cacheKey = await extractCacheKey(extractReq);
  const cached = await getCachedResult(cacheKey);
  if (cached && typeof cached === "object" && cached !== null && "words" in cached) {
    const words = (cached as ExtractWordsResult).words;
    if (Array.isArray(words) && words.length) {
      const used = await getUsage(user.id, month, "auto");
      return NextResponse.json({
        result: { words },
        cached: true,
        usage: { used, limit, plan: tier, bucket: "auto" },
      });
    }
  }

  const reservation = await reserveUsage(user.id, month, "auto", limit);
  if (!reservation.ok) {
    return NextResponse.json(
      {
        error: "auto_quota_exhausted",
        usage: { used: reservation.used, limit, plan: tier, bucket: "auto" },
      },
      { status: 429 }
    );
  }

  try {
    const { result } = await extractWordsCached(apiKey, model, extractReq);
    return NextResponse.json({
      result,
      cached: false,
      usage: { used: reservation.used, limit, plan: tier, bucket: "auto" },
    });
  } catch (err) {
    await reservation.refund();
    const detail = err instanceof Error ? err.message : "extract_failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
