/**
 * Listening Mode, following an N5 course lesson.
 *
 * Nothing about Listening changes: the same audio, the same transcripts, the
 * same copilot. When the account has a course lesson, the copilot also knows
 * the unit (its words, its goal, the learner's script), and the lesson's words
 * are picked out of what is heard so the learner sees them land and the
 * account records them. animevocab.com owns the lesson; this only mirrors it.
 */
import { kataToHira } from "./romaji";
import type { Token } from "../types";

export interface CourseWord {
  id: string;
  /** In the learner's script, as the course shows it. */
  reading: string;
  meaning: string;
  /** Plain kana, for matching what is heard. */
  kana: string;
}

export interface CourseLesson {
  id: string;
  unit: number | null;
  title: string | null;
  canDo: string;
  script: "romaji" | "kana";
  episode: { number: number; title: string } | null;
  words: CourseWord[];
  heard: string[];
}

/** What the copilot is told about the lesson (see web/src/lib/ai-coach.ts). */
export interface CoursePrompt {
  unit: number;
  title: string;
  canDo: string;
  script: "romaji" | "kana";
  words: string[];
}

/** Hiragana with spacing and punctuation removed: what two spellings of the
 * same spoken word have in common. Long-vowel marks stay; they are spoken. */
export function soundKey(text: string): string {
  return kataToHira(text.normalize("NFKC")).replace(/[^ぁ-ゖー]/g, "");
}

/**
 * Lesson words spoken in a line, given the line's tokens.
 *
 * A word matches a run of whole tokens whose readings spell it (はじめまして,
 * よろしく + お願い + します), never a slice of a longer word, or a single
 * token whose dictionary form reads as it (弾いて for ひく). `baseReading`
 * gives that reading when the dictionary knows it.
 */
export function wordsHeard(
  tokens: Pick<Token, "surface" | "base" | "reading">[],
  words: Pick<CourseWord, "id" | "kana">[],
  baseReading: (base: string) => string | null = () => null
): string[] {
  const sounds = tokens.map((t) => soundKey(t.reading || t.surface));
  const bases = tokens.map((t) => {
    const kana = /^[ぁ-ヿー]+$/.test(t.base) ? t.base : baseReading(t.base);
    return kana ? soundKey(kana) : "";
  });
  const heard: string[] = [];
  for (const word of words) {
    const key = soundKey(word.kana);
    // One kana is too little to tell a word from a particle or a sound.
    if (key.length < 2) continue;
    let found = bases.includes(key);
    for (let i = 0; !found && i < sounds.length; i++) {
      let run = "";
      for (let j = i; j < sounds.length; j++) {
        run += sounds[j];
        if (run === key) { found = true; break; }
        if (!key.startsWith(run)) break;
      }
    }
    if (found) heard.push(word.id);
  }
  return heard;
}

export function coursePrompt(lesson: CourseLesson): CoursePrompt | null {
  if (!lesson.unit) return null;
  return {
    unit: lesson.unit,
    title: lesson.title || "",
    canDo: lesson.canDo,
    script: lesson.script,
    words: lesson.words.map((w) => `${w.reading} — ${w.meaning}`),
  };
}

const ID = /^[a-z0-9][a-z0-9-]{0,127}$/;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

/**
 * The lesson from the course API's extension snapshot, or null. Only what the
 * panel and the matcher use survives; anything malformed is dropped rather
 * than shown.
 */
export function courseLessonFromState(state: unknown): CourseLesson | null {
  if (!obj(state) || !obj(state.lesson)) return null;
  const l = state.lesson;
  if (!text(l.id, 128) || !ID.test(l.id) || (l.script !== "romaji" && l.script !== "kana") || !text(l.canDo, 500)) return null;
  if (!Array.isArray(l.vocabulary) || l.vocabulary.length > 20) return null;
  const words: CourseWord[] = [];
  for (const v of l.vocabulary) {
    if (!obj(v) || !text(v.id, 128) || !text(v.reading, 120) || !text(v.meaning, 250)) return null;
    // Older APIs sent no kana; a kana-script reading is its own kana.
    const kana = text(v.kana, 120) ? v.kana : l.script === "kana" ? v.reading : "";
    words.push({ id: v.id, reading: v.reading, meaning: v.meaning, kana });
  }
  const unit = Number.isSafeInteger(l.unit) && (l.unit as number) >= 1 && (l.unit as number) <= 99 ? (l.unit as number) : null;
  const episode =
    obj(l.episode) && Number.isSafeInteger(l.episode.number) && text(l.episode.title, 120)
      ? { number: l.episode.number as number, title: l.episode.title }
      : null;
  const ids = new Set(words.map((w) => w.id));
  const heard = Array.isArray(l.heard) ? l.heard.filter((id): id is string => typeof id === "string" && ids.has(id)) : [];
  return {
    id: l.id,
    unit,
    title: text(l.title, 120) ? l.title : null,
    canDo: l.canDo,
    script: l.script,
    episode,
    words,
    heard,
  };
}

/** The lesson's page on animevocab.com, opened at a step. */
export function lessonUrl(lesson: Pick<CourseLesson, "id" | "script">, step: "watch" | "practice"): string {
  if (!ID.test(lesson.id)) throw new Error("Invalid lesson");
  return `https://animevocab.com/app/n5/lessons/${lesson.id}?script=${lesson.script}#${step}`;
}
