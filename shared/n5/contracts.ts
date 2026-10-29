/** Shared wire types. No runtime/provider dependencies or private answer keys. */
export type N5Script = "romaji" | "kana";
export interface N5Enrolment { trackId: string; script: N5Script }
export interface N5Track {
  id: string; title: string; adaptation: string; season: string;
  status: "planned" | "unreviewed_preview";
}
export interface N5Catalog {
  apiVersion: 1; courseId: string; contentVersion: string; status: "private_preview";
  tracks: readonly N5Track[];
}
export interface N5Course {
  apiVersion: 1; courseId: string; contentVersion: string;
  units: readonly { id: string; title: string; status: "planned" | "unreviewed_preview" }[];
  limitation: string; availableLessons: string[];
}
export interface N5Text { romaji: string; kana: string }
export interface N5Choice { id: string; text: string }
export interface N5Question {
  id: string;
  kind: "choice" | "production";
  objectiveId: string;
  prompt: string;
  choices?: N5Choice[];
}
export interface N5Lesson {
  apiVersion: 1;
  id: string;
  courseId: string;
  contentVersion: string;
  episodeId: string;
  script: N5Script;
  status: "unreviewed_preview";
  summary: string;
  summarySource: string;
  canDo: string;
  vocabulary: { id: string; reading: string; meaning: string }[];
  grammar: { id: string; explanation: string; example: string }[];
  watchLinks: { provider: string; url: string; region: "unknown"; availability: "unknown"; checkedAt: null }[];
  questions: N5Question[];
}
export interface N5Answer { questionId: string; value: string }
export interface N5Result {
  correct: number;
  total: number;
  objectivePercent: number;
  production: "needs_review";
  speaking: "not_assessed";
  listening: "not_assessed";
  kanjiLiteracy: "not_assessed";
  mastery: false;
  outcome: "preview_practice_complete";
  script: N5Script;
}
export interface N5Attempt {
  id: string;
  courseId: string;
  lessonId: string;
  contentVersion: string;
  script: N5Script;
  revision: number;
  status: "active" | "complete";
  answers: N5Answer[];
  result: N5Result | null;
}
export interface N5ReviewEvent {
  id: string;
  attemptId: string;
  objectiveId: string;
  judgment: "review-pass" | "review-fail";
}
export interface N5Progress {
  enrolment: N5Enrolment | null;
  observations: { episodeId: string; kind: "watch_complete" | "practice_complete" }[];
  attempts: Pick<N5Attempt, "id" | "status" | "script" | "result">[];
  mastery: false;
}
export interface N5Reviews {
  events: N5ReviewEvent[];
  consumerStatus: "not_integrated";
}
export interface N5Export {
  apiVersion: 1;
  enrolments: (N5Enrolment & { createdAt: number })[];
  observations: (N5Progress["observations"][number] & { createdAt: number })[];
  attempts: N5Attempt[];
  reviews: N5ReviewEvent[];
}
export interface N5Error { error: { code: string; message: string; details?: { questionId: string } } }

/** Bounded, answer-free snapshot for the extension's private course pilot. */
export interface N5ExtensionState {
  apiVersion: 1;
  ownerId: string;
  context: {
    courseId: string; trackId: string; unitId: string; episodeId: string;
    lessonId: string; contentVersion: string; script: N5Script;
  } | null;
  lesson: Pick<N5Lesson, "id" | "contentVersion" | "script" | "canDo" | "vocabulary" | "grammar"> | null;
  watched: boolean;
  activeAttempts: { id: string; script: N5Script }[];
  completedAttempts: number;
  mastery: false;
}
