import { DEFAULT_COACH_MODEL } from "./ai-coach";
import { getOpenAiKey, putCachedResult, incrementUsage, currentMonth } from "./ai-store";

export const MAX_PICK_LINE_LEN = 400;
export const MAX_PICK_CANDIDATES = 12;

export interface WordPickCandidate {
  word: string;
  reading: string;
  gloss: string;
  level: number;
  essential?: boolean;
}

export interface WordPickRequest {
  line: string;
  candidates: WordPickCandidate[];
  learnerLevel: number;
  wordsKnown?: number;
  title?: string;
  animeContext?: string;
}

export interface WordPickResult {
  word: string;
}

function clamp(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function normalizeWordPickRequest(input: unknown): { req: WordPickRequest } | { error: string } {
  if (!input || typeof input !== "object") return { error: "invalid_body" };
  const body = input as Record<string, unknown>;

  const line = typeof body.line === "string" ? clamp(body.line, MAX_PICK_LINE_LEN) : "";
  if (!line) return { error: "missing_line" };

  const learnerLevelRaw = Number(body.learnerLevel);
  const learnerLevel =
    Number.isFinite(learnerLevelRaw) && learnerLevelRaw >= 1 && learnerLevelRaw <= 5
      ? Math.round(learnerLevelRaw)
      : 5;

  if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
    return { error: "missing_candidates" };
  }

  const candidates: WordPickCandidate[] = body.candidates
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      word: typeof c.word === "string" ? clamp(c.word, 80) : "",
      reading: typeof c.reading === "string" ? clamp(c.reading, 80) : "",
      gloss: typeof c.gloss === "string" ? clamp(c.gloss, 120) : "",
      level: Number.isFinite(Number(c.level)) ? Math.round(Number(c.level)) : 3,
      essential: c.essential === true,
    }))
    .filter((c) => c.word.length > 0)
    .slice(0, MAX_PICK_CANDIDATES);

  if (!candidates.length) return { error: "missing_candidates" };

  const wordsKnownRaw = Number(body.wordsKnown);
  const wordsKnown =
    Number.isFinite(wordsKnownRaw) && wordsKnownRaw >= 0 ? Math.round(wordsKnownRaw) : undefined;

  return {
    req: {
      line,
      candidates,
      learnerLevel,
      wordsKnown,
      title: typeof body.title === "string" ? clamp(body.title, 120) : undefined,
      animeContext:
        typeof body.animeContext === "string" ? clamp(body.animeContext, 600) : undefined,
    },
  };
}

export async function wordPickCacheKey(req: WordPickRequest): Promise<string> {
  const bases = req.candidates
    .map((c) => c.word)
    .sort()
    .join("|");
  const basis = `${req.line}\u0001${req.learnerLevel}\u0001${bases}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  return `ai:pick:v1:${hex}`;
}

function learnerBand(level: number): string {
  if (level >= 5) return "beginner (N5 — everyday spoken essentials first: arigato, onegaishimasu, sumimasen)";
  if (level >= 4) return "elementary (N4 — common daily conversation)";
  if (level >= 3) return "intermediate (N3)";
  if (level >= 2) return "upper intermediate (N2)";
  return "advanced (N1 — rare and literary ok)";
}

function buildPickPrompt(req: WordPickRequest): { system: string; user: string } {
  const candidateLines = req.candidates
    .map(
      (c) =>
        `- word: ${c.word} | reading: ${c.reading || "?"} | gloss: ${c.gloss || "?"} | ` +
        `frequency band: ${c.level}/5${c.essential ? " | ESSENTIAL phrase" : ""}`
    )
    .join("\n");

  const user = [
    req.title ? `Anime: ${req.title}` : "",
    req.animeContext ? `Show notes:\n${req.animeContext}` : "",
    `Learner: ${learnerBand(req.learnerLevel)}`,
    typeof req.wordsKnown === "number" ? `Words already in their deck: ~${req.wordsKnown}` : "",
    `Subtitle line: ${req.line}`,
    "",
    "Candidates (choose exactly one `word` value from this list):",
    candidateLines,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    system:
      "You are a Japanese tutor AI that picks ONE vocabulary item from an anime subtitle for a learner. " +
      "Pick the single best word or short phrase to teach RIGHT NOW from the candidate list only. " +
      "For beginners, strongly prefer essential spoken phrases when present. " +
      "Prefer words central to the line's meaning; skip names, filler, and grammar-only bits. " +
      "Match difficulty to the learner band — do not pick rare literary words for beginners. " +
      'Respond ONLY as JSON {"word": string} where word matches a candidate exactly.',
    user,
  };
}

export async function runWordPick(apiKey: string, model: string, req: WordPickRequest): Promise<WordPickResult> {
  const allowed = new Set(req.candidates.map((c) => c.word));
  const { system, user } = buildPickPrompt(req);

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
      max_tokens: 40,
    }),
  });

  if (!res.ok) throw new Error(`openai_${res.status}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("openai_bad_json");
  }

  const word = typeof parsed.word === "string" ? parsed.word.trim() : "";
  if (!word || !allowed.has(word)) throw new Error("openai_invalid_pick");
  return { word };
}

export async function pickWordCached(
  apiKey: string,
  model: string,
  req: WordPickRequest,
  _userId: string
): Promise<{ result: WordPickResult }> {
  const result = await runWordPick(apiKey, model, req);
  // Soft-fail both writes: the OpenAI pick already succeeded, so a KV put-limit
  // rejection must not turn it into a 502 (worst case: no cache + a slight
  // under-count of usage, both self-correcting on the next call).
  try {
    const cacheKey = await wordPickCacheKey(req);
    await putCachedResult(cacheKey, result);
  } catch (err) {
    console.warn("[word-picker] cache write failed", err);
  }
  try {
    await incrementUsage(_userId, currentMonth());
  } catch (err) {
    console.warn("[word-picker] usage meter write failed", err);
  }
  return { result };
}
