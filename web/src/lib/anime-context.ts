import { getOpenAiKey, getCachedResult, putCachedResult } from "./ai-store";
import { completionTuning, DEFAULT_COACH_MODEL } from "./ai-coach";
import { parseUsage } from "./llm-pricing";
import { recordLlmCall, type LlmContext } from "./telemetry";
import { animeContextCacheBasis, seriesTitle } from "./anime-title";

/**
 * Event name and outcome tags for the anime-context cache panel (#113).
 *
 * Defined next to the cache itself so the writer (the route) and the reader
 * (telemetry-query.ts) cannot drift: a typo on either side produces a panel
 * that reads 0% forever with no error anywhere.
 */
export const ANIME_CONTEXT_EVENT = "anime_context";
export type AnimeContextCacheOutcome = "hit" | "miss";

export const MAX_ANIME_CONTEXT_LEN = 600;
const CACHE_TTL_SECONDS = 60 * 24 * 3600; // 60 days — show context is stable

export interface AnimeContextResult {
  title: string;
  context: string;
}

/**
 * The title as the CACHE and the MODEL should both see it: the series, without
 * the episode the learner happens to be on.
 *
 * Both uses want the same thing. The cache wants one entry per show rather than
 * one per episode (see anime-title.ts), and the prompt asks for notes about a
 * show — handing it "Naruto Shippuden Episode 42 – The Promise" invites notes
 * about that episode instead.
 */
function normalizeTitle(title: string): string {
  return seriesTitle(title);
}

/**
 * v2: the basis changed from the raw title to the series, so a v1 key can never
 * collide with a v2 one. Old entries are simply unreachable and age out on
 * their own 60-day TTL — there were 3 live hits when this changed, so there is
 * nothing worth migrating.
 */
export async function animeContextCacheKey(title: string): Promise<string> {
  const basis = animeContextCacheBasis(title);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  return `anime:ctx:v2:${hex}`;
}

export async function getAnimeContext(title: string): Promise<AnimeContextResult | null> {
  const clean = normalizeTitle(title);
  if (!clean) return null;
  const key = await animeContextCacheKey(clean);
  const cached = await getCachedResult(key);
  if (cached && typeof cached === "object" && cached !== null && "context" in cached) {
    const ctx = cached as AnimeContextResult;
    if (typeof ctx.context === "string" && ctx.context.trim()) {
      return { title: clean, context: ctx.context.trim().slice(0, MAX_ANIME_CONTEXT_LEN) };
    }
  }
  return null;
}

export async function generateAnimeContext(
  title: string,
  ctx?: LlmContext
): Promise<AnimeContextResult> {
  const clean = normalizeTitle(title);
  if (!clean) throw new Error("missing_title");

  const existing = await getAnimeContext(clean);
  if (existing) return existing;

  const apiKey = await getOpenAiKey();
  if (!apiKey) throw new Error("ai_not_configured");

  const model = process.env.AI_COACH_MODEL || DEFAULT_COACH_MODEL;
  const startedAt = Date.now();
  const base = { ...ctx, model, operation: "anime_context", effort: "low" as const };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You write brief study notes for Japanese learners watching anime. " +
            "Given a show title, return 3-5 short bullet points: genre, setting, typical speech register " +
            "(casual/polite/rough), recurring themes, and anything that affects how characters talk. " +
            "If unsure, say so briefly. Under 90 words. Plain text bullets only, no markdown headers.",
        },
        { role: "user", content: `Anime title: ${clean}` },
      ],
      // Cached-for-60-days background call: low effort is plenty for study notes.
      ...completionTuning(model, { temperature: 0.35, maxTokens: 180, effort: "low" }),
    }),
  });

  if (!res.ok) {
    await recordLlmCall({
      ...base,
      status: "error",
      errorCode: `openai_${res.status}`,
      latencyMs: Date.now() - startedAt,
    });
    throw new Error(`openai_${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: unknown;
  };
  await recordLlmCall({
    ...base,
    status: "ok",
    usage: parseUsage(data.usage),
    latencyMs: Date.now() - startedAt,
  });
  const context = (data.choices?.[0]?.message?.content || "").trim().slice(0, MAX_ANIME_CONTEXT_LEN);
  if (!context) throw new Error("openai_empty");

  const result = { title: clean, context };
  // Soft-fail the cache write: the paid completion already succeeded, so a KV
  // put-limit rejection must not turn a valid result into a 502.
  try {
    const key = await animeContextCacheKey(clean);
    await putCachedResult(key, result, CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn("[anime-context] cache write failed", err);
  }
  return result;
}
