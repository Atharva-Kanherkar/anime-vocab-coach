// The end-of-episode quiz: what the extension remembers about the episode, when
// it counts as finished, and how a quiz is scored.
//
// Kept free of the DOM and of chrome.* (except the two small storage helpers at
// the bottom) so the rules can be tested on their own. The overlay lives in
// episode-quiz-ui.ts; the content script only feeds lines and ticks.

import type { VocabMap } from "../types";

/** Most lines one episode keeps. A 24-minute episode has ~300-400. */
export const MAX_LOG_LINES = 400;
/** Most lines sent for a quiz; spread across the whole episode. */
export const MAX_SENT_LINES = 120;
export const MIN_QUIZ_LINES = 20;
export const MIN_PLAYBACK_SEC = 8 * 60;
/** Shorter than this is a clip, not an episode. */
export const MIN_EPISODE_SEC = 8 * 60;
export const END_WINDOW_SEC = 150;
export const END_WINDOW_FRACTION = 0.1;
export const MAX_ASKED_KEYS = 50;

export const QUIZ_OFF_KEY = "avcEpisodeQuizOff";
export const QUIZ_ASKED_KEY = "avcEpisodeQuizAsked";

export type QuizKind = "meaning" | "line" | "story" | "build";

/** Mirror of QuizQuestion in web/src/lib/episode-quiz.ts. */
export interface QuizQuestion {
  kind: QuizKind;
  prompt: string;
  quote?: string;
  choices?: string[];
  answer?: number;
  tiles?: string[];
  explain: string;
  word?: { word: string; reading: string; gloss: string };
}

export interface QuizLine {
  ja: string;
  en: string;
}

/** The learner's answer: a choice index, or the tiles in the order they tapped them. */
export type QuizAnswer = number | string[] | null;

/** The lines and playback time of the episode on screen now. */
export class EpisodeLog {
  private key = "";
  private lines: QuizLine[] = [];
  private seen = new Set<string>();
  playedSec = 0;

  /** Start over when the session (the video) changed. */
  use(key: string): void {
    if (key === this.key) return;
    this.key = key;
    this.lines = [];
    this.seen.clear();
    this.playedSec = 0;
  }

  get session(): string {
    return this.key;
  }

  add(text: string, en = ""): void {
    const ja = text.replace(/\s+/g, " ").trim();
    if (!ja || this.seen.has(ja)) return;
    this.seen.add(ja);
    this.lines.push({ ja, en: en.replace(/\s+/g, " ").trim() });
    if (this.lines.length > MAX_LOG_LINES) {
      const gone = this.lines.shift();
      if (gone) this.seen.delete(gone.ja);
    }
  }

  get size(): number {
    return this.lines.length;
  }

  /** Up to `max` lines, evenly spread from the first to the last, in order. */
  sample(max = MAX_SENT_LINES): QuizLine[] {
    const n = this.lines.length;
    if (n <= max) return this.lines.slice();
    const out: QuizLine[] = [];
    for (let i = 0; i < max; i++) out.push(this.lines[Math.floor((i * (n - 1)) / (max - 1))]);
    return out;
  }
}

/** The episode is over, or into its credits. */
export function isEpisodeEnding(v: { ended: boolean; currentTime: number; duration: number }): boolean {
  if (v.ended) return true;
  const d = v.duration;
  if (!Number.isFinite(d) || d < MIN_EPISODE_SEC) return false;
  return d - v.currentTime <= Math.min(END_WINDOW_SEC, d * END_WINDOW_FRACTION);
}

export interface OfferInput {
  optedOut: boolean;
  asked: boolean;
  inCourse: boolean;
  lines: number;
  playedSec: number;
  ending: boolean;
}

export function shouldOfferQuiz(i: OfferInput): boolean {
  return (
    !i.optedOut &&
    !i.asked &&
    !i.inCourse &&
    i.ending &&
    i.lines >= MIN_QUIZ_LINES &&
    i.playedSec >= MIN_PLAYBACK_SEC
  );
}

export function isCorrect(q: QuizQuestion, a: QuizAnswer): boolean {
  if (a === null) return false;
  if (q.kind === "build") {
    return Array.isArray(a) && !!q.tiles && a.length === q.tiles.length && a.every((t, i) => t === q.tiles![i]);
  }
  return typeof a === "number" && a === q.answer;
}

export function scoreQuiz(questions: QuizQuestion[], answers: QuizAnswer[]): number {
  return questions.reduce((n, q, i) => n + (isCorrect(q, answers[i] ?? null) ? 1 : 0), 0);
}

export function verdictFor(score: number, total: number): string {
  const r = total ? score / total : 0;
  if (r >= 0.9) return "Sharp";
  if (r >= 0.7) return "Solid";
  if (r >= 0.4) return "Getting there";
  return "Rewatch-worthy";
}

/** Words from missed meaning questions that are not in the deck yet. */
export function missedWords(
  questions: QuizQuestion[],
  answers: QuizAnswer[],
  vocab: VocabMap
): { word: string; reading: string; gloss: string; line: string }[] {
  const out: { word: string; reading: string; gloss: string; line: string }[] = [];
  questions.forEach((q, i) => {
    if (q.kind !== "meaning" || !q.word || isCorrect(q, answers[i] ?? null)) return;
    const rec = vocab[q.word.word];
    if (rec && (rec.state === "learning" || rec.state === "known")) return;
    if (out.some((w) => w.word === q.word!.word)) return;
    out.push({ ...q.word, line: q.quote || "" });
  });
  return out;
}

/** Words the learner already has, that came up in this episode. */
export function knownWordsIn(lines: QuizLine[], vocab: VocabMap, max = 40): string[] {
  const text = lines.map((l) => l.ja).join("\n");
  const out: string[] = [];
  for (const [word, rec] of Object.entries(vocab)) {
    if (rec.state !== "known" && rec.state !== "learning") continue;
    if (word.length < 1 || !text.includes(word)) continue;
    out.push(word);
    if (out.length >= max) break;
  }
  return out;
}

/** The sentence-practice words: missed ones first, then any meaning word. */
export function practiceWords(questions: QuizQuestion[], answers: QuizAnswer[], max = 2): string[] {
  const words = questions.filter((q) => q.kind === "meaning" && q.word);
  const missed = questions.filter((q, i) => q.kind === "meaning" && q.word && !isCorrect(q, answers[i] ?? null));
  const out: string[] = [];
  for (const q of [...missed, ...words]) {
    if (!out.includes(q.word!.word)) out.push(q.word!.word);
    if (out.length >= max) break;
  }
  return out;
}

/** Newest keys last, at most MAX_ASKED_KEYS. */
export function rememberAsked(asked: string[], key: string): string[] {
  const next = asked.filter((k) => k !== key);
  next.push(key);
  return next.slice(-MAX_ASKED_KEYS);
}

/** A stable shuffle for tests, Math.random otherwise. Never returns the input order for 2+ distinct items. */
export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((t, i) => t === items[i])) out.push(out.shift()!);
  return out;
}

export async function getQuizPrefs(): Promise<{ off: boolean; asked: string[] }> {
  try {
    const r = await chrome.storage.local.get([QUIZ_OFF_KEY, QUIZ_ASKED_KEY]);
    const asked = Array.isArray(r[QUIZ_ASKED_KEY]) ? (r[QUIZ_ASKED_KEY] as unknown[]).filter((k): k is string => typeof k === "string") : [];
    return { off: r[QUIZ_OFF_KEY] === true, asked };
  } catch {
    // Unreadable prefs: behave as "already asked" so a broken store never nags.
    return { off: true, asked: [] };
  }
}

export async function markQuizAsked(key: string): Promise<void> {
  try {
    const { asked } = await getQuizPrefs();
    await chrome.storage.local.set({ [QUIZ_ASKED_KEY]: rememberAsked(asked, key) });
  } catch {
    /* the in-memory guard still stops a second offer on this page */
  }
}

export async function setQuizOff(): Promise<void> {
  try {
    await chrome.storage.local.set({ [QUIZ_OFF_KEY]: true });
  } catch {
    /* ignore */
  }
}
