import { z } from "zod";
import type { N5Answer, N5Lesson, N5Result, N5Script } from "../../../shared/n5/contracts";
import { CONTENT_VERSION, COURSE_ID, EPISODE_ID, LESSON_ID, QUESTIONS, TRACK_ID } from "./content";

const key = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const revision = z.number().int().min(0).max(1_000_000);
export const scriptSchema = z.enum(["romaji", "kana"]);
export const enrolmentSchema = z.strictObject({ trackId: z.literal(TRACK_ID), script: scriptSchema, idempotencyKey: key });
export const attemptSchema = z.strictObject({ lessonId: z.literal(LESSON_ID), contentVersion: z.literal(CONTENT_VERSION), idempotencyKey: key });
export const eventSchema = z.strictObject({ episodeId: z.literal(EPISODE_ID), kind: z.enum(["watch_complete", "practice_complete"]), idempotencyKey: key });
export const answerSchema = z.strictObject({
  questionId: key,
  value: z.string().min(1).max(500),
});
export const answersSchema = z.strictObject({
  revision,
  idempotencyKey: key,
  answers: z.array(answerSchema).min(1).max(QUESTIONS.length),
});
export const finishSchema = z.strictObject({ revision });

/** Reject rather than transliterate submitted production into another script. */
export function validScript(text: string, script: N5Script): boolean {
  if (script === "romaji") return /^[A-Za-z0-9\s.,!?'"():;-]+$/.test(text) && /[A-Za-z]/.test(text);
  return /^[\u3041-\u3096\u30a1-\u30faー\s。、！？「」・]+$/.test(text) && /[\u3041-\u3096\u30a1-\u30fa]/.test(text);
}

export function validateAnswers(answers: N5Answer[], script: N5Script): boolean {
  const seen = new Set<string>();
  return answers.every((answer) => {
    const question = QUESTIONS.find((item) => item.id === answer.questionId);
    if (!question || seen.has(answer.questionId)) return false;
    seen.add(answer.questionId);
    if (question.kind === "choice") return question.choices!.some((choice) => choice.id === answer.value);
    return validScript(answer.value, script);
  });
}

export function completeAnswers(answers: N5Answer[], script: N5Script): boolean {
  return answers.length === QUESTIONS.length && validateAnswers(answers, script);
}

export function publicLesson(script: N5Script): N5Lesson {
  return {
    apiVersion: 1, id: LESSON_ID, courseId: COURSE_ID, contentVersion: CONTENT_VERSION, episodeId: EPISODE_ID,
    script, status: "unreviewed_preview",
    summary: "A student whose life once revolved around the piano encounters a violinist through his school friends. This lesson uses meeting a new classmate as a setting for original introduction practice.",
    summarySource: "https://www.yourlieinapril.com/story/01.html",
    canDo: "Greet a new classmate and introduce yourself politely.",
    questions: QUESTIONS.map((question) => ({
      id: question.id, kind: question.kind, objectiveId: question.objectiveId, prompt: question.prompt,
      ...(question.choices ? { choices: question.choices.map((choice) => ({ id: choice.id, text: choice.text[script] })) } : {}),
    })),
  };
}

export function grade(answers: N5Answer[], script: N5Script): N5Result {
  if (!completeAnswers(answers, script)) throw new Error("incomplete_answers");
  const objective = QUESTIONS.filter((question) => question.kind === "choice");
  const correct = objective.filter((question) => answers.some((answer) => answer.questionId === question.id && answer.value === question.correctOption)).length;
  return {
    correct, total: objective.length, objectivePercent: correct / objective.length * 100,
    production: "needs_review", speaking: "not_assessed", listening: "not_assessed", kanjiLiteracy: "not_assessed",
    mastery: false, outcome: "preview_practice_complete", script,
  };
}

/** Hash only a schema-parsed object, whose field order is canonical. Never store raw bodies in logs. */
export async function fingerprint(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
