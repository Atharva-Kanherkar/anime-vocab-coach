/**
 * Dual subtitles: the English line under a Japanese subtitle, when the page
 * has none (Netflix in Japan offers no English track for most anime), plus
 * corrected readings for the words the extension's tokenizer is least sure of
 * (kanji, and names above all), so the romaji line is right.
 *
 * Latency matters more than anywhere else in the app: the line is on screen
 * for two or three seconds. So: a fast model with reasoning off, a short
 * prompt, a small answer, and a shared cache. The same line of the same show
 * is translated once for everybody.
 */
import { completionTuning, fastestReasoningEffort } from "./ai-coach";
import { parseUsage } from "./llm-pricing";
import { recordLlmCall, type LlmContext } from "./telemetry";

export const MAX_SUB_LINE_LEN = 300;
export const MAX_SUB_CONTEXT = 3;
export const MAX_SUB_WORDS = 40;
/** Lines a month. Generous on purpose: one episode is ~300 lines, and most
 * lines are shared-cache hits that cost nothing and are not counted. */
export const SUB_LINE_LIMITS = { free: 20_000, pro: 60_000, max: 150_000 } as const;

export interface SubWord {
  /** Token index in the extension's tokenization of the line. */
  i: number;
  /** The token as written. */
  s: string;
}

export interface SubTranslateRequest {
  line: string;
  /** The lines just before it, oldest first, for meaning only. */
  context: string[];
  title?: string;
  /** Tokens whose reading should be checked: anything with kanji. */
  words: SubWord[];
}

export interface SubTranslation {
  en: string;
  /** Token index → reading in hiragana (katakana kept for loanwords). */
  readings: Record<string, string>;
}

function clamp(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/;
const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/;

export function normalizeSubRequest(input: unknown): { req: SubTranslateRequest } | { error: string } {
  if (!input || typeof input !== "object") return { error: "invalid_body" };
  const body = input as Record<string, unknown>;
  const line = typeof body.line === "string" ? clamp(body.line, MAX_SUB_LINE_LEN) : "";
  if (!line || !JAPANESE.test(line)) return { error: "missing_line" };
  const context = Array.isArray(body.context)
    ? body.context.filter((c): c is string => typeof c === "string").map((c) => clamp(c, MAX_SUB_LINE_LEN)).filter(Boolean).slice(-MAX_SUB_CONTEXT)
    : [];
  const words: SubWord[] = [];
  if (Array.isArray(body.words)) {
    for (const w of body.words) {
      if (!w || typeof w !== "object") continue;
      const { i, s } = w as Record<string, unknown>;
      if (!Number.isInteger(i) || (i as number) < 0 || (i as number) > 200) continue;
      if (typeof s !== "string" || !s || s.length > 20 || !line.includes(s)) continue;
      words.push({ i: i as number, s });
      if (words.length >= MAX_SUB_WORDS) break;
    }
  }
  return {
    req: {
      line,
      context,
      title: typeof body.title === "string" && body.title.trim() ? clamp(body.title, 120) : undefined,
      words,
    },
  };
}

/** Shared across users: same show, same line, same words to read. Context is
 * left out so a line seen after different lines still hits. */
export async function subCacheKey(req: SubTranslateRequest): Promise<string> {
  const basis = `${req.title ?? ""}\u0001${req.line}\u0001${req.words.map((w) => `${w.i}:${w.s}`).join(",")}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  return `ai:subs:v1:${hex}`;
}

export function subPrompt(req: SubTranslateRequest): { system: string; user: string } {
  const system =
    "You write English subtitles for Japanese anime. Translate only the TARGET line into natural, concise English " +
    "a subtitler would use: keep the speaker's tone and register, keep names as names (Hepburn romaji), no notes, " +
    "no quotation marks around the whole line. Earlier lines are context for meaning only; never translate them. " +
    "Also give the reading of each listed word exactly as it is read in this line, in hiragana " +
    "(katakana for loanwords); for names use the character's actual name reading in this show. " +
    'Respond only as JSON {"en": string, "readings": {"<index>": string}}.';
  const user = [
    req.title ? `Anime: ${req.title}` : "",
    req.context.length ? `Earlier lines:\n${req.context.map((c) => `- ${c}`).join("\n")}` : "",
    `TARGET: ${req.line}`,
    req.words.length ? `Words to read: ${req.words.map((w) => `${w.i}=${w.s}`).join(", ")}` : "Words to read: none",
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}

/** Keep only answers that can be shown: an English line, and readings that
 * are pure kana for words that were asked about. */
export function parseSubTranslation(raw: unknown, req: SubTranslateRequest): SubTranslation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const en = typeof r.en === "string" ? clamp(r.en, 400) : "";
  // An English subtitle has English in it; a model that echoed the Japanese has not.
  if (!/[A-Za-z]/.test(en)) return null;
  const asked = new Set(req.words.map((w) => String(w.i)));
  const readings: Record<string, string> = {};
  if (r.readings && typeof r.readings === "object" && !Array.isArray(r.readings)) {
    for (const [k, v] of Object.entries(r.readings as Record<string, unknown>)) {
      if (!asked.has(k) || typeof v !== "string") continue;
      const kana = v.replace(/\s+/g, "");
      if (kana && kana.length <= 30 && KANA_ONLY.test(kana)) readings[k] = kana;
    }
  }
  return { en, readings };
}

export async function runSubTranslate(
  apiKey: string,
  model: string,
  req: SubTranslateRequest,
  ctx?: LlmContext
): Promise<SubTranslation> {
  const startedAt = Date.now();
  const base = { ...ctx, model, operation: "subs_translate", effort: "none" as const };
  const { system, user } = subPrompt(req);
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
      // Reasoning off: a subtitle that arrives after its line is gone is worthless.
      // Whatever AI_SUBS_MODEL is set to: o-series and GPT-5 reject "none".
      ...completionTuning(model, { temperature: 0.2, maxTokens: 300, effort: fastestReasoningEffort(model) }),
    }),
  });
  if (!res.ok) {
    await recordLlmCall({ ...base, status: "error", errorCode: `openai_${res.status}`, latencyMs: Date.now() - startedAt });
    throw new Error(`openai_${res.status}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
  await recordLlmCall({ ...base, status: "ok", usage: parseUsage(data.usage), latencyMs: Date.now() - startedAt });
  let parsed: unknown;
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    throw new Error("openai_bad_json");
  }
  const result = parseSubTranslation(parsed, req);
  if (!result) throw new Error("openai_empty");
  return result;
}
