import wordsJson from "./words.json";
import grammarJson from "./grammar.json";

export interface SyllabusWord {
  id: string;
  src: string;
  meaning: string;
  pos: string;
  band: number;
  tags: string[];
  reserve?: boolean;
}

export interface SyllabusGrammar {
  id: string;
  title: string;
  pattern: string;
  explanation: string;
  prerequisites: string[];
  band: number;
}

export const WORDS = wordsJson as SyllabusWord[];
export const GRAMMAR = grammarJson as SyllabusGrammar[];

export const UNIT_COUNT = 24;
export const WORDS_PER_UNIT = 25;

/**
 * File order is not teaching order: the seeded points come first, then the
 * additions. Sort by band before allocating, so a unit never introduces a later
 * band before an earlier one. The sort is stable, so points inside a band keep
 * their authored order.
 */
const PLANNED_GRAMMAR = [...GRAMMAR].sort((a, b) => a.band - b.band);

const COURSE_WORDS = WORDS.filter((word) => !word.reserve);

/**
 * 80 grammar points over 24 units: the first 8 units carry 4, the rest 3.
 * Written out so a change to the grammar count fails a test instead of silently
 * changing every unit's density.
 */
const GRAMMAR_PER_UNIT = [4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
const GRAMMAR_STARTS = GRAMMAR_PER_UNIT.reduce<number[]>(
  (starts, count, index) => [...starts, (starts[index] ?? 0) + count],
  [0],
);

if (COURSE_WORDS.length !== UNIT_COUNT * WORDS_PER_UNIT) {
  throw new Error(`Syllabus has ${COURSE_WORDS.length} course words, expected ${UNIT_COUNT * WORDS_PER_UNIT}`);
}
if (GRAMMAR.length !== GRAMMAR_PER_UNIT.reduce((sum, n) => sum + n, 0)) {
  throw new Error(`Syllabus has ${GRAMMAR.length} grammar points, expected ${GRAMMAR_STARTS[GRAMMAR_PER_UNIT.length]}`);
}

export interface UnitTargets {
  words: string[];
  grammar: string[];
}

/** The fixed 25 words and 3-4 grammar points for one unit. Pure and deterministic. */
export function unitTargets(unit: number): UnitTargets {
  if (!Number.isInteger(unit) || unit < 1 || unit > UNIT_COUNT) {
    throw new Error(`Unit must be an integer from 1 to ${UNIT_COUNT}`);
  }
  const wordStart = (unit - 1) * WORDS_PER_UNIT;
  const grammarStart = GRAMMAR_STARTS[unit - 1];
  const grammarEnd = GRAMMAR_STARTS[unit];
  return {
    words: COURSE_WORDS.slice(wordStart, wordStart + WORDS_PER_UNIT).map((word) => word.id),
    grammar: PLANNED_GRAMMAR.slice(grammarStart, grammarEnd).map((point) => point.id),
  };
}

const NOTATION = [
  "Words inside one phrase are joined with _, and a space separates phrases.",
  "^ marks a name. Particles and the copula are written as their own words.",
  "A leading ' marks an ordinary word that looks like a particle, for example 'は (tooth), so it reads ha rather than wa.",
  "Katakana is used for loanwords. Every Japanese string must render as kana and romaji.",
].join(" ");

/**
 * The stable prompt prefix: role, notation rules and the full glossary.
 *
 * Nothing volatile belongs here. Unit targets, the show, the episode and any
 * validation errors go in the user message. Keeping this string byte-identical
 * across units is what lets the provider's prompt cache hit on every call.
 */
const BLOCK = [
  "You write original N5 Japanese practice lessons for an anime course.",
  "You may use a word only if it appears in the glossary below, is a particle or copula, or is a name marked with ^.",
  NOTATION,
  "Vocabulary glossary:",
  ...WORDS.map((word) => `${word.id}\t${word.src}\t${word.meaning}`),
].join("\n");

export function syllabusBlock(): string {
  return BLOCK;
}
