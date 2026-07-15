import { DEFAULT_COACH_MODEL } from "./ai-coach";
import { getOpenAiKey, putCachedResult, incrementUsage, currentMonth } from "./ai-store";
import {
  explainLangName,
  normalizeDirection,
  targetLangName,
  type LearningDirection,
} from "./direction";

export const MAX_EXTRACT_LINE_LEN = 400;
export const MAX_EXTRACT_WORDS = 12;

export interface ExtractedWord {
  word: string;
  reading: string;
  gloss: string;
  level: number;
}

export interface ExtractWordsRequest {
  line: string;
  direction: LearningDirection;
  title?: string;
  learnerLevel?: number;
}

export interface ExtractWordsResult {
  words: ExtractedWord[];
}

function clamp(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function normalizeExtractRequest(
  input: unknown
): { req: ExtractWordsRequest } | { error: string } {
  if (!input || typeof input !== "object") return { error: "invalid_body" };
  const body = input as Record<string, unknown>;
  const line = typeof body.line === "string" ? clamp(body.line, MAX_EXTRACT_LINE_LEN) : "";
  if (!line) return { error: "missing_line" };

  const direction = normalizeDirection(body.direction);
  const learnerLevelRaw = Number(body.learnerLevel);
  const learnerLevel =
    Number.isFinite(learnerLevelRaw) && learnerLevelRaw >= 1 && learnerLevelRaw <= 5
      ? Math.round(learnerLevelRaw)
      : 5;

  return {
    req: {
      line,
      direction,
      title: typeof body.title === "string" ? clamp(body.title, 120) : undefined,
      learnerLevel,
    },
  };
}

export async function extractCacheKey(req: ExtractWordsRequest): Promise<string> {
  const basis = `${req.direction}\u0001${req.learnerLevel ?? 5}\u0001${req.line}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  return `ai:extract:v1:${hex}`;
}

function buildExtractPrompt(req: ExtractWordsRequest): { system: string; user: string } {
  const target = targetLangName(req.direction);
  const explain = explainLangName(req.direction);
  const band =
    (req.learnerLevel ?? 5) >= 5
      ? "beginner"
      : (req.learnerLevel ?? 5) >= 3
        ? "intermediate"
        : "advanced";

  const system =
    `You extract vocabulary from anime dialogue for immersion learners. ` +
    `The learner is studying ${target}; glosses must be in ${explain}. ` +
    `Return 3–${MAX_EXTRACT_WORDS} content words/phrases worth teaching (skip names, filler, pure grammar). ` +
    `Match difficulty to a ${band} learner. ` +
    `For Japanese targets, include kana reading; for English targets leave reading empty. ` +
    `level is 5 (very common) to 1 (rare). ` +
    `Respond ONLY as JSON {"words":[{"word":string,"reading":string,"gloss":string,"level":number}]}.`;

  const user = [req.title ? `Anime: ${req.title}` : "", `Line: ${req.line}`].filter(Boolean).join("\n");
  return { system, user };
}

export async function runExtractWords(
  apiKey: string,
  model: string,
  req: ExtractWordsRequest
): Promise<ExtractWordsResult> {
  const { system, user } = buildExtractPrompt(req);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  if (!res.ok) throw new Error(`openai_${res.status}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
  } catch {
    throw new Error("openai_bad_json");
  }

  const raw = Array.isArray(parsed.words) ? parsed.words : [];
  const words: ExtractedWord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const word = typeof row.word === "string" ? clamp(row.word, 80) : "";
    if (!word) continue;
    const levelRaw = Number(row.level);
    words.push({
      word,
      reading: typeof row.reading === "string" ? clamp(row.reading, 80) : "",
      gloss: typeof row.gloss === "string" ? clamp(row.gloss, 120) : "",
      level:
        Number.isFinite(levelRaw) && levelRaw >= 1 && levelRaw <= 5 ? Math.round(levelRaw) : 4,
    });
    if (words.length >= MAX_EXTRACT_WORDS) break;
  }
  if (!words.length) throw new Error("openai_empty");
  return { words };
}

export async function extractWordsCached(
  apiKey: string,
  model: string,
  req: ExtractWordsRequest,
  userId: string
): Promise<{ result: ExtractWordsResult }> {
  const result = await runExtractWords(apiKey, model, req);
  try {
    const cacheKey = await extractCacheKey(req);
    await putCachedResult(cacheKey, result);
  } catch (err) {
    console.warn("[extract-words] cache write failed", err);
  }
  try {
    await incrementUsage(userId, currentMonth());
  } catch (err) {
    console.warn("[extract-words] usage meter write failed", err);
  }
  return { result };
}

// Keep DEFAULT_COACH_MODEL referenced for tree-shake-friendly re-exports in routes.
export { DEFAULT_COACH_MODEL };
