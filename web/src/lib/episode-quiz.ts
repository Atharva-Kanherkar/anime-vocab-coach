// The end-of-episode quiz: a short check on what the learner just watched.
//
// The extension collects the lines it saw during the episode (subtitle Learn
// and Listening Mode both feed it) and asks for a quiz when the episode ends.
// "generate" is free for every plan. "haru" is the Pro/Max layer: Haru judges a
// sentence the learner wrote with the episode's words.
//
// The model's output is untrusted: everything it returns is validated here and
// a quiz with too few usable questions is refused rather than shown half-built.

import { completionTuning, openAiHttpError, type ReasoningEffort, type UsageSink } from "./ai-coach";
import { parseUsage } from "./llm-pricing";
import { explainLangName, normalizeDirection, targetLangName, type LearningDirection } from "./direction";

export const MAX_QUIZ_LINES = 120;
export const MIN_QUIZ_LINES = 12;
export const MAX_QUIZ_LINE_LEN = 200;
export const MAX_KNOWN_WORDS = 40;
export const MAX_SENTENCE_LEN = 200;
export const MAX_QUESTIONS = 15;
export const MIN_QUESTIONS = 8;
export const MAX_TILES = 8;

export type QuizKind = "meaning" | "line" | "story" | "build";

export interface QuizLine {
  ja: string;
  en: string;
}

export interface QuizWord {
  word: string;
  reading: string;
  gloss: string;
}

export interface QuizQuestion {
  kind: QuizKind;
  prompt: string;
  /** A line from the episode the question is about (read aloud by Haru). */
  quote?: string;
  /** Multiple choice: four options and the index of the right one. */
  choices?: string[];
  answer?: number;
  /** Build: the sentence's pieces in the right order; the client shuffles them. */
  tiles?: string[];
  explain: string;
  /** Meaning questions: the word, so a miss can become a flashcard. */
  word?: QuizWord;
}

export interface GenerateRequest {
  mode: "generate";
  title: string;
  direction: LearningDirection;
  lines: QuizLine[];
  known: string[];
}

export interface HaruRequest {
  mode: "haru";
  title: string;
  direction: LearningDirection;
  sentence: string;
  words: string[];
  score: number;
  total: number;
}

export type EpisodeQuizRequest = GenerateRequest | HaruRequest;

export interface HaruResult {
  /** Did the sentence work: natural and using at least one of the words. */
  ok: boolean;
  verdict: string;
  corrected: string;
  note: string;
  /** One short line in the target language Haru says out loud. */
  say: string;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function words(v: unknown, cap: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const w of v) {
    const s = str(w, 40);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

export function normalizeQuizRequest(input: unknown): { req: EpisodeQuizRequest } | { error: string } {
  if (!input || typeof input !== "object") return { error: "invalid_body" };
  const body = input as Record<string, unknown>;
  const title = str(body.title, 120);
  const direction = normalizeDirection(body.direction);

  if (body.mode === "generate") {
    const lines: QuizLine[] = [];
    const seen = new Set<string>();
    for (const raw of Array.isArray(body.lines) ? body.lines : []) {
      if (!raw || typeof raw !== "object") continue;
      const ja = str((raw as Record<string, unknown>).ja, MAX_QUIZ_LINE_LEN);
      if (!ja || seen.has(ja)) continue;
      seen.add(ja);
      lines.push({ ja, en: str((raw as Record<string, unknown>).en, MAX_QUIZ_LINE_LEN) });
      if (lines.length >= MAX_QUIZ_LINES) break;
    }
    if (lines.length < MIN_QUIZ_LINES) return { error: "too_few_lines" };
    return { req: { mode: "generate", title, direction, lines, known: words(body.known, MAX_KNOWN_WORDS) } };
  }

  if (body.mode === "haru") {
    const sentence = str(body.sentence, MAX_SENTENCE_LEN);
    if (!sentence) return { error: "missing_sentence" };
    const total = Math.max(0, Math.min(MAX_QUESTIONS, Math.floor(Number(body.total) || 0)));
    const score = Math.max(0, Math.min(total, Math.floor(Number(body.score) || 0)));
    return { req: { mode: "haru", title, direction, sentence, words: words(body.words, 6), score, total } };
  }

  return { error: "invalid_mode" };
}

function buildGeneratePrompt(req: GenerateRequest): { system: string; user: string } {
  const target = targetLangName(req.direction);
  const explain = explainLangName(req.direction);
  const system =
    `You write a short, friendly quiz on an anime episode the learner just watched, to check they followed it and to reinforce its ${target}. ` +
    `It should feel like a nudge, not an exam. Use ONLY the dialogue given; never invent plot that is not in it. ` +
    `Write prompts, choices and explanations in ${explain}; quote ${target} exactly as it appears in the dialogue.\n` +
    `Return JSON: {"questions":[...]} with 12 questions in this mix:\n` +
    `- 4 "meaning": a useful ${target} word from the dialogue. {"kind":"meaning","prompt":"What does 「word」 mean here?","quote":"<the line it was in>","choices":[4 short ${explain} meanings],"answer":<0-3>,"explain":"<one line>","word":{"word":"<dictionary form>","reading":"<kana reading, empty for English>","gloss":"<short meaning>"}}\n` +
    `- 3 "line": {"kind":"line","prompt":"What did this line mean?","quote":"<a ${target} line>","choices":[4 ${explain} paraphrases],"answer":<0-3>,"explain":"..."}\n` +
    `- 3 "story": what happened or who said/wanted what, answerable from the dialogue. {"kind":"story","prompt":"...","choices":[4],"answer":<0-3>,"explain":"..."}\n` +
    `- 2 "build": a SHORT ${target} sentence (3-6 pieces) from or closely based on the dialogue, preferring the learner's known words. {"kind":"build","prompt":"Build: <${explain} meaning>","tiles":["<piece 1>","<piece 2>",...in correct order],"explain":"..."}\n` +
    `Wrong choices must be plausible but clearly wrong. Vary the position of the right answer. Keep every string short.`;
  const known = req.known.length ? `\nWords the learner already knows (prefer these in "build"): ${req.known.join(", ")}` : "";
  const dialogue = req.lines.map((l) => (l.en ? `${l.ja}\t(${l.en})` : l.ja)).join("\n");
  return {
    system,
    user: `Show: ${req.title || "unknown"}${known}\nDialogue, in order (${target}, then the on-screen subtitle when there was one):\n${dialogue}`,
  };
}

function buildHaruPrompt(req: HaruRequest): { system: string; user: string } {
  const target = targetLangName(req.direction);
  const explain = explainLangName(req.direction);
  return {
    system:
      `You are Haru, a friendly ${target} tutor (an ordinary classmate, not an anime character). ` +
      `The learner just finished an anime episode, took a quiz, and wrote one ${target} sentence using words from it. ` +
      `Judge the sentence kindly but honestly. Return JSON: {"ok":true|false,"verdict":"<one ${explain} line on the sentence>",` +
      `"corrected":"<the sentence made natural, in ${target}; same as theirs if already right>","note":"<one ${explain} tip>",` +
      `"say":"<one short, warm ${target} line Haru says out loud about their score and sentence>"}. ` +
      `ok is true when the sentence is understandable and uses at least one of the target words.`,
    user:
      `Show: ${req.title || "unknown"}\nQuiz score: ${req.score}/${req.total}\nTarget words: ${req.words.join(", ") || "(any)"}\nTheir sentence: ${req.sentence}`,
  };
}

function choiceList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const c of v) {
    const s = str(c, 160);
    if (s && !out.includes(s)) out.push(s);
  }
  return out.length === 4 ? out : null;
}

function sanitizeQuestion(raw: unknown): QuizQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const kind = q.kind;
  if (kind !== "meaning" && kind !== "line" && kind !== "story" && kind !== "build") return null;
  const prompt = str(q.prompt, 240);
  if (!prompt) return null;
  const explain = str(q.explain, 240);
  const quote = str(q.quote, MAX_QUIZ_LINE_LEN) || undefined;

  if (kind === "build") {
    if (!Array.isArray(q.tiles)) return null;
    const tiles = q.tiles.map((t) => str(t, 40)).filter(Boolean);
    if (tiles.length < 2 || tiles.length > MAX_TILES) return null;
    // All tiles the same would make every order "right".
    if (new Set(tiles).size < 2) return null;
    return { kind, prompt, tiles, explain, quote: quote ?? tiles.join(tiles.some((t) => /[a-z]/i.test(t)) ? " " : "") };
  }

  const choices = choiceList(q.choices);
  const answer = Number(q.answer);
  if (!choices || !Number.isInteger(answer) || answer < 0 || answer > 3) return null;
  if (kind === "line" && !quote) return null;
  const out: QuizQuestion = { kind, prompt, choices, answer, explain, quote };
  if (kind === "meaning") {
    const w = q.word && typeof q.word === "object" ? (q.word as Record<string, unknown>) : null;
    const word = w ? str(w.word, 40) : "";
    if (word) out.word = { word, reading: str(w?.reading, 40), gloss: str(w?.gloss, 120) || choices[answer] };
  }
  return out;
}

export function sanitizeQuiz(raw: unknown): { questions: QuizQuestion[] } | { error: string } {
  const list = raw && typeof raw === "object" ? (raw as Record<string, unknown>).questions : null;
  const questions: QuizQuestion[] = [];
  for (const q of Array.isArray(list) ? list : []) {
    const clean = sanitizeQuestion(q);
    if (clean) questions.push(clean);
    if (questions.length >= MAX_QUESTIONS) break;
  }
  if (questions.length < MIN_QUESTIONS) return { error: "quiz_too_short" };
  return { questions };
}

export function sanitizeHaru(raw: unknown): HaruResult | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "openai_empty" };
  const o = raw as Record<string, unknown>;
  const verdict = str(o.verdict, 240);
  if (!verdict) return { error: "openai_empty" };
  return {
    ok: o.ok === true,
    verdict,
    corrected: str(o.corrected, MAX_SENTENCE_LEN),
    note: str(o.note, 240),
    say: str(o.say, 160),
  };
}

/** Call the model and validate what it returns. Throws on transport, HTTP, or unusable output. */
export async function runEpisodeQuiz(
  apiKey: string,
  model: string,
  req: EpisodeQuizRequest,
  effort?: ReasoningEffort,
  onUsage?: UsageSink
): Promise<{ questions: QuizQuestion[] } | { haru: HaruResult }> {
  const startedAt = Date.now();
  const { system, user } = req.mode === "generate" ? buildGeneratePrompt(req) : buildHaruPrompt(req);
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
      ...completionTuning(model, {
        temperature: req.mode === "generate" ? 0.5 : 0.4,
        maxTokens: req.mode === "generate" ? 2400 : 400,
        effort,
      }),
    }),
  });
  if (!res.ok) throw await openAiHttpError(res, `episode_quiz_${req.mode}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
  onUsage?.(parseUsage(data.usage), Date.now() - startedAt);
  let parsed: unknown;
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    throw new Error("openai_bad_json");
  }

  if (req.mode === "generate") {
    const quiz = sanitizeQuiz(parsed);
    if ("error" in quiz) throw new Error(quiz.error);
    return quiz;
  }
  const haru = sanitizeHaru(parsed);
  if ("error" in haru) throw new Error(haru.error);
  return { haru };
}
