import { z } from "zod";
import type { N5Answer, N5Result, N5ReviewItem, N5Script, N5Skill } from "../../../shared/n5/contracts";
import { CONTENT_VERSION, EPISODE_IDS, LESSON_IDS, MAX_QUESTIONS, TRACK_ID, type PrivateLesson } from "./course";

const key = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const revision = z.number().int().min(0).max(1_000_000);
export const scriptSchema = z.enum(["romaji", "kana"]);
export const lessonIdSchema = z.enum(LESSON_IDS);
export const enrolmentSchema = z.strictObject({ trackId: z.literal(TRACK_ID), script: scriptSchema, idempotencyKey: key });
export const attemptSchema = z.strictObject({ lessonId: lessonIdSchema, contentVersion: z.literal(CONTENT_VERSION), script: scriptSchema.optional(), idempotencyKey: key });
export const eventSchema = z.strictObject({ episodeId: z.enum(EPISODE_IDS), kind: z.enum(["watch_complete", "practice_complete"]), idempotencyKey: key });
export const answerSchema = z.strictObject({
  questionId: key,
  value: z.string().min(1).max(500),
});
export const answersSchema = z.strictObject({
  revision,
  idempotencyKey: key,
  answers: z.array(answerSchema).min(1).max(MAX_QUESTIONS),
});
export const finishSchema = z.strictObject({ revision });

/** The provisional lesson gate. Calibrate with the pilot; it is not a JLPT threshold. */
export const PASS_PERCENT = 80;

/** Validate a normalized view without changing stored text or transliterating scripts. */
export function validScript(text: string, script: N5Script): boolean {
  const normalized = text.normalize("NFKC").replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  if (script === "romaji") return /^[A-Za-zāīūēōâîûêôĀĪŪĒŌÂÎÛÊÔ0-9 .,!?'"():;-]+$/.test(normalized) && /[A-Za-zāīūēōâîûêôĀĪŪĒŌÂÎÛÊÔ]/.test(normalized);
  return /^[ぁ-ゖァ-ヺー 。、!?「」『』():・〜~.]+$/.test(normalized) && /[ぁ-ゖァ-ヺ]/.test(normalized);
}

export function invalidAnswerQuestionId(lesson: PrivateLesson, answers: N5Answer[], script: N5Script): string | null {
  const seen = new Set<string>();
  for (const answer of answers) {
    const question = lesson.questions.find((item) => item.id === answer.questionId);
    if (!question || seen.has(answer.questionId)) return answer.questionId;
    seen.add(answer.questionId);
    const valid = question.kind === "choice"
      ? question.choices.some((choice) => choice.id === answer.value)
      : validScript(answer.value, script);
    if (!valid) return answer.questionId;
  }
  return null;
}

export function validateAnswers(lesson: PrivateLesson, answers: N5Answer[], script: N5Script): boolean {
  return invalidAnswerQuestionId(lesson, answers, script) === null;
}

export function completeAnswers(lesson: PrivateLesson, answers: N5Answer[], script: N5Script): boolean {
  return answers.length === lesson.questions.length && validateAnswers(lesson, answers, script);
}

export function grade(lesson: PrivateLesson, answers: N5Answer[], script: N5Script): N5Result {
  if (!completeAnswers(lesson, answers, script)) throw new Error("incomplete_answers");
  const skills: Record<N5Skill, { correct: number; total: number }> = {
    vocabulary: { correct: 0, total: 0 }, grammar: { correct: 0, total: 0 }, reading: { correct: 0, total: 0 }, listening: { correct: 0, total: 0 },
  };
  let correct = 0;
  let total = 0;
  for (const question of lesson.questions) {
    if (question.kind !== "choice") continue;
    const right = answers.some((answer) => answer.questionId === question.id && answer.value === question.correctOption);
    total++;
    skills[question.skill].total++;
    if (right) { correct++; skills[question.skill].correct++; }
  }
  const objectivePercent = correct / total * 100;
  return {
    correct, total, objectivePercent, passed: objectivePercent >= PASS_PERCENT, skills,
    production: "needs_review", speaking: "not_assessed", kanjiLiteracy: "not_assessed",
    mastery: false, outcome: "preview_practice_complete", script,
  };
}

/** Answer review, released only for a completed attempt. */
export function review(lesson: PrivateLesson, answers: N5Answer[], script: N5Script): N5ReviewItem[] {
  return lesson.questions.map((question) => {
    const answer = answers.find((item) => item.questionId === question.id)?.value ?? null;
    if (question.kind === "production") {
      return { questionId: question.id, correct: null, answer, references: question.references.map((text) => text[script]) };
    }
    return {
      questionId: question.id, correct: answer === question.correctOption, answer,
      correctChoiceId: question.correctOption, explanation: question.explanation[script],
      ...(question.transcript ? { transcript: question.transcript[script] } : {}),
    };
  });
}

/** Hash only a schema-parsed object, whose field order is canonical. Never store raw bodies in logs. */
export async function fingerprint(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const packs = new Map<string, Promise<string>>();
/** The full question pack, including wording: edits conservatively invalidate active attempts. */
export function packHash(lesson: PrivateLesson): Promise<string> {
  let hash = packs.get(lesson.id);
  if (!hash) { hash = fingerprint(lesson.questions); packs.set(lesson.id, hash); }
  return hash;
}

