/** Shared wire types. No runtime/provider dependencies or private answer keys. */
export type N5Script = "romaji" | "kana";
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
export interface N5Error { error: { code: string; message: string } }
