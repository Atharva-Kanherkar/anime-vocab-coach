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

export type CoachMode = "explain" | "hooks";
export type Plan = "free" | "pro";
// "launch" is the tier reported while the free launch window is open: everyone
// signed in gets all features at one capped limit, no Dodo/plan gating.
export type Tier = "free" | "pro" | "launch";

export interface CoachRequest {
  mode: CoachMode;
  word: string;
  reading?: string;
  gloss?: string;
  line: string;
  level?: number | null;
  title?: string;
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

export type CoachResult = ExplainResult | HooksResult;

// Verified July 2026: gpt-4.1-nano is $0.10 / 1M input, $0.40 / 1M output. A coach
// call (~350 input + ~250 output tokens) costs about $0.00014 — roughly 15x under
// the $0.002/call assumption in the backend economics model. Overridable via env.
export const DEFAULT_COACH_MODEL = "gpt-4.1-nano";
export const DEFAULT_FREE_LIMIT = 5;
export const DEFAULT_PRO_LIMIT = 300;
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
  if (mode !== "explain" && mode !== "hooks") return { error: "invalid_mode" };

  const word = typeof body.word === "string" ? clamp(body.word, MAX_WORD_LEN) : "";
  if (!word) return { error: "missing_word" };

  const line = typeof body.line === "string" ? clamp(body.line, MAX_LINE_LEN) : "";
  if (!line) return { error: "missing_line" };

  const levelRaw = Number(body.level);
  const level = Number.isFinite(levelRaw) && levelRaw > 0 ? Math.round(levelRaw) : null;

  return {
    req: {
      mode,
      word,
      reading: typeof body.reading === "string" ? clamp(body.reading, MAX_WORD_LEN) : undefined,
      gloss: typeof body.gloss === "string" ? clamp(body.gloss, MAX_WORD_LEN) : undefined,
      line,
      level,
      title: typeof body.title === "string" ? clamp(body.title, MAX_TITLE_LEN) : undefined,
    },
  };
}

/** Stable cache key: same word+line+level (across users) reuses one answer. */
export async function coachCacheKey(req: CoachRequest): Promise<string> {
  const basis = `${req.word}${req.line}${req.level ?? 0}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  return `ai:v1:${req.mode}:${hex}`;
}

function contextBlock(req: CoachRequest): string {
  const bits = [
    `Word: ${req.word}`,
    req.reading ? `Reading: ${req.reading}` : "",
    req.gloss ? `Known gloss: ${req.gloss}` : "",
    req.title ? `Anime: ${req.title}` : "",
    req.level ? `Learner JLPT-ish target level: N${req.level}` : "",
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
