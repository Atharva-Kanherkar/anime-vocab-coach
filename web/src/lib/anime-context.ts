import { getOpenAiKey, getCachedResult, putCachedResult } from "./ai-store";
import { DEFAULT_COACH_MODEL } from "./ai-coach";

export const MAX_ANIME_TITLE_LEN = 120;
export const MAX_ANIME_CONTEXT_LEN = 600;
const CACHE_TTL_SECONDS = 60 * 24 * 3600; // 60 days — show context is stable

export interface AnimeContextResult {
  title: string;
  context: string;
}

function normalizeTitle(title: string): string {
  return title.trim().slice(0, MAX_ANIME_TITLE_LEN);
}

export async function animeContextCacheKey(title: string): Promise<string> {
  const basis = normalizeTitle(title).toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  return `anime:ctx:v1:${hex}`;
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

export async function generateAnimeContext(title: string): Promise<AnimeContextResult> {
  const clean = normalizeTitle(title);
  if (!clean) throw new Error("missing_title");

  const existing = await getAnimeContext(clean);
  if (existing) return existing;

  const apiKey = await getOpenAiKey();
  if (!apiKey) throw new Error("ai_not_configured");

  const model = process.env.AI_COACH_MODEL || DEFAULT_COACH_MODEL;
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
      temperature: 0.35,
      max_tokens: 180,
    }),
  });

  if (!res.ok) throw new Error(`openai_${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
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
