// AI anime learning coach (issue #13).
//
// Two shipped features, one OpenAI call each:
//   - "explain": beginner-English meaning + why the character phrased it this way
//     in this scene (tone, politeness level, anime speech register). This beats a
//     generic dictionary lookup by being specific to the actual line.
//   - "hooks": three vivid memory hooks tied to the exact anime line so the word
//     sticks. Mnemonic generation is the differentiator competitors don't offer.
//
// Every call is tied to a word + line (issue #13 constraint). We send only the
// single line, never a whole transcript. Responses are cached by word+line+level
// so repeated explanations cost nothing and do not consume a user's quota.

import { TIERS } from "@/lib/site";

export type CoachMode = "explain" | "hooks" | "chat";
export type Plan = "free" | "pro";
export type Tier = "free" | "pro" | "launch";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachRequest {
  mode: CoachMode;
  word: string;
  reading?: string;
  gloss?: string;
  line: string;
  level?: number | null;
  title?: string;
  animeContext?: string;
  learnerLevel?: number | null;
  wordsKnown?: number | null;
  /** chat mode only */
  message?: string;
  history?: ChatMessage[];
}

export interface ExplainResult {
  mode: "explain";
  meaning: string;
  nuance: string;
}

export interface HooksResult {
  mode: "hooks";
  hooks: string[];
}

export interface ChatResult {
  mode: "chat";
  reply: string;
}

export type CoachResult = ExplainResult | HooksResult | ChatResult;

// Verified July 2026: gpt-4.1-nano is $0.10 / 1M input, $0.40 / 1M output. A coach
// call (~350 input + ~250 output tokens) costs about $0.00014 — roughly 15x under
// the $0.002/call assumption in the backend economics model. Overridable via env.
export const DEFAULT_COACH_MODEL = "gpt-4.1-nano";
// Enforced monthly caps derive from the advertised tiers in site.ts, so the
// number a user is billed against is the same number the pricing UI shows.
// Overridable via FREE_AI_CALLS_PER_MONTH / PRO_AI_CALLS_PER_MONTH env.
export const DEFAULT_FREE_LIMIT = TIERS.free.aiCallsPerMonth;
export const DEFAULT_PRO_LIMIT = TIERS.pro.aiCallsPerMonth;
// Free launch: while the window is open every signed-in account gets this cap for
// all AI features. Capped so a launch cannot blow the budget (30 * ~$0.00014 =
// ~$0.004/user/mo). Overridable via LAUNCH_AI_CALLS_PER_MONTH / AI_FREE_LAUNCH_UNTIL.
export const DEFAULT_LAUNCH_LIMIT = 30;
export const DEFAULT_LAUNCH_UNTIL = "2026-09-01T00:00:00.000Z";

/** True while the free launch window is open. */
export function launchActive(until: string | undefined, now = Date.now()): boolean {
  const iso = until || DEFAULT_LAUNCH_UNTIL;
  const t = Date.parse(iso);
  return Number.isFinite(t) && now < t;
}

// Bounds keep the prompt small (cost + the "never send more than needed" constraint).
export const MAX_WORD_LEN = 80;
export const MAX_LINE_LEN = 400;
export const MAX_TITLE_LEN = 120;
export const MAX_CHAT_MESSAGE_LEN = 500;
export const MAX_CHAT_HISTORY = 12;
export const MAX_ANIME_CONTEXT_LEN = 600;

export function aiLimitForPlan(plan: Plan, free: number, pro: number): number {
  return plan === "pro" ? pro : free;
}

function clamp(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/** Validate + normalize an incoming request. Returns an error string, or null if OK. */
export function normalizeCoachRequest(input: unknown): { req: CoachRequest } | { error: string } {
  if (!input || typeof input !== "object") return { error: "invalid_body" };
  const body = input as Record<string, unknown>;

  const mode = body.mode;
  if (mode !== "explain" && mode !== "hooks" && mode !== "chat") return { error: "invalid_mode" };

  const word = typeof body.word === "string" ? clamp(body.word, MAX_WORD_LEN) : "";
  if (!word) return { error: "missing_word" };

  const line = typeof body.line === "string" ? clamp(body.line, MAX_LINE_LEN) : "";
  if (!line) return { error: "missing_line" };

  const levelRaw = Number(body.level);
  const level = Number.isFinite(levelRaw) && levelRaw > 0 ? Math.round(levelRaw) : null;

  let message: string | undefined;
  let history: ChatMessage[] | undefined;
  if (mode === "chat") {
    message = typeof body.message === "string" ? clamp(body.message, MAX_CHAT_MESSAGE_LEN) : "";
    if (!message) return { error: "missing_message" };
    if (Array.isArray(body.history)) {
      history = body.history
        .filter(
          (m): m is ChatMessage =>
            !!m &&
            typeof m === "object" &&
            ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant")
        )
        .slice(-MAX_CHAT_HISTORY)
        .map((m) => ({
          role: m.role,
          content: clamp(String(m.content || ""), MAX_CHAT_MESSAGE_LEN),
        }))
        .filter((m) => m.content.length > 0);
    }
  }

  return {
    req: {
      mode,
      word,
      reading: typeof body.reading === "string" ? clamp(body.reading, MAX_WORD_LEN) : undefined,
      gloss: typeof body.gloss === "string" ? clamp(body.gloss, MAX_WORD_LEN) : undefined,
      line,
      level,
      title: typeof body.title === "string" ? clamp(body.title, MAX_TITLE_LEN) : undefined,
      animeContext:
        typeof body.animeContext === "string"
          ? clamp(body.animeContext, MAX_ANIME_CONTEXT_LEN)
          : undefined,
      learnerLevel:
        Number.isFinite(Number(body.learnerLevel)) && Number(body.learnerLevel) > 0
          ? Math.round(Number(body.learnerLevel))
          : null,
      wordsKnown:
        Number.isFinite(Number(body.wordsKnown)) && Number(body.wordsKnown) >= 0
          ? Math.round(Number(body.wordsKnown))
          : null,
      message,
      history,
    },
  };
}

/** Stable cache key: same word+line+level (across users) reuses one answer. */
export async function coachCacheKey(req: CoachRequest): Promise<string> {
  const ctxPart = req.animeContext ? req.animeContext.slice(0, 80) : "";
  const basis = `${req.word}\u0001${req.line}\u0001${req.level ?? 0}\u0001${ctxPart}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  return `ai:v1:${req.mode}:${hex}`;
}

function learnerProfileLine(req: CoachRequest): string {
  const parts: string[] = [];
  if (req.learnerLevel) {
    const band =
      req.learnerLevel >= 5
        ? "beginner (N5 — prioritize everyday spoken essentials)"
        : req.learnerLevel >= 4
          ? "elementary (N4)"
          : req.learnerLevel >= 3
            ? "intermediate (N3)"
            : req.learnerLevel >= 2
              ? "upper intermediate (N2)"
              : "advanced (N1)";
    parts.push(`Learner band: ${band}`);
  }
  if (typeof req.wordsKnown === "number" && req.wordsKnown >= 0) {
    parts.push(`Words marked known/learning so far: ${req.wordsKnown}`);
  }
  return parts.join("\n");
}

function contextBlock(req: CoachRequest): string {
  const bits = [
    `Word: ${req.word}`,
    req.reading ? `Reading: ${req.reading}` : "",
    req.gloss ? `Known gloss: ${req.gloss}` : "",
    req.title ? `Anime: ${req.title}` : "",
    req.animeContext ? `Show context:\n${req.animeContext}` : "",
    learnerProfileLine(req),
    req.level ? `Word frequency band (5 = very common … 1 = rare): ${req.level}` : "",
    `Line from the scene: ${req.line}`,
  ].filter(Boolean);
  return bits.join("\n");
}

function buildPrompt(req: CoachRequest): { system: string; user: string } {
  if (req.mode === "explain") {
    return {
      system:
        "You are an anime Japanese tutor. A learner tapped a word inside a line of anime dialogue. " +
        "Return strict JSON with two fields. `meaning`: the word's meaning in simple beginner English, 1-2 sentences. " +
        "`nuance`: why the character phrased it THIS way in THIS line — politeness level (keigo, casual, rough), " +
        "emotion, or anime speech quirks. Be specific to the line, not generic. Keep each field under 60 words. " +
        'Respond only as {"meaning": string, "nuance": string}.',
      user: contextBlock(req),
    };
  }
  return {
    system:
      "You are a mnemonic coach for anime Japanese learners. Given a word and the exact anime line it appeared in, " +
      "create exactly 3 short, vivid memory hooks that tie the word's sound or meaning to the scene so it sticks. " +
      "Each hook is one sentence, playful, and references the line or anime moment. " +
      'Respond only as strict JSON {"hooks": [string, string, string]}.',
    user: contextBlock(req),
  };
}

/** Call OpenAI chat completions and shape the result. Throws on transport/HTTP error. */
export async function runCoach(
  apiKey: string,
  model: string,
  req: CoachRequest
): Promise<CoachResult> {
  if (req.mode === "chat") {
    return runChatCoach(apiKey, model, req);
  }

  const { system, user } = buildPrompt(req);
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
      temperature: req.mode === "hooks" ? 0.8 : 0.4,
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    throw new Error(`openai_${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("openai_bad_json");
  }

  if (req.mode === "explain") {
    const meaning = typeof parsed.meaning === "string" ? parsed.meaning.trim() : "";
    const nuance = typeof parsed.nuance === "string" ? parsed.nuance.trim() : "";
    if (!meaning) throw new Error("openai_empty");
    return { mode: "explain", meaning, nuance };
  }

  const hooks = Array.isArray(parsed.hooks)
    ? parsed.hooks.filter((h): h is string => typeof h === "string" && h.trim().length > 0).map((h) => h.trim()).slice(0, 3)
    : [];
  if (hooks.length === 0) throw new Error("openai_empty");
  return { mode: "hooks", hooks };
}

function chatSystemPrompt(): string {
  return (
    "You are a concise anime Japanese tutor embedded in a learner's video player. " +
    "The learner is watching anime with subtitles. Answer in clear beginner-friendly English. " +
    "Stay focused on the highlighted word and the exact line from the scene. " +
    "Keep replies under 120 words unless they ask for more detail. " +
    "Use romaji for Japanese readings when helpful. " +
    "Use light markdown when it helps clarity: **bold** for key terms, bullet lists, short ### headings. No emoji."
  );
}

function buildChatMessages(req: CoachRequest): { role: "system" | "user" | "assistant"; content: string }[] {
  const message = (req.message || "").trim();
  const contextUser = `[Scene context]\n${contextBlock(req)}\n\n[Learner question]\n${message}`;
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: chatSystemPrompt() },
  ];
  for (const turn of req.history || []) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: contextUser });
  return messages;
}

async function runChatCoach(apiKey: string, model: string, req: CoachRequest): Promise<ChatResult> {
  const message = (req.message || "").trim();
  if (!message) throw new Error("missing_message");

  const messages = buildChatMessages(req);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.55,
      max_tokens: 320,
    }),
  });

  if (!res.ok) throw new Error(`openai_${res.status}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const reply = (data.choices?.[0]?.message?.content || "").trim();
  if (!reply) throw new Error("openai_empty");
  return { mode: "chat", reply };
}

/** Stream chat tokens from OpenAI. Used by the extension agent panel. */
export async function* streamChatCoach(
  apiKey: string,
  model: string,
  req: CoachRequest
): AsyncGenerator<string, void, unknown> {
  const message = (req.message || "").trim();
  if (!message) throw new Error("missing_message");

  const messages = buildChatMessages(req);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.55,
      max_tokens: 400,
      stream: true,
    }),
  });

  if (!res.ok) throw new Error(`openai_${res.status}`);
  if (!res.body) throw new Error("openai_no_body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch {
        /* skip malformed chunk */
      }
    }
  }
}
