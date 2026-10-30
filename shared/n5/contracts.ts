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
  units: readonly {
    id: string; number: number; title: string; status: "planned" | "unreviewed_preview";
    lessonId: string; kind: "episode" | "study" | "final"; episode: { number: number; title: string } | null;
  }[];
  limitation: string; availableLessons: string[];
}
export interface N5Text { romaji: string; kana: string }
export interface N5Choice { id: string; text: string }
export type N5Skill = "vocabulary" | "grammar" | "reading" | "listening";
export interface N5Question {
  id: string;
  kind: "choice" | "production";
  skill: N5Skill | "writing";
  objectiveId: string;
  /** English instruction. */
  prompt: string;
  /** Japanese shown with the prompt, in the lesson script. */
  text?: string;
  /** Audio clip id; the transcript is revealed only after completion. */
  audio?: string;
  choiceLanguage?: "ja" | "en";
  choices?: N5Choice[];
}
export interface N5Spoken { text: string; english: string; audio: string }
/** An official, legal place to watch. Regions are ISO country codes from a dated check. */
export interface N5WatchLink {
  provider: string;
  url: string;
  /** episode: opens this lesson's episode directly; series: opens the series page. */
  scope: "episode" | "series";
  regions: string[];
  access: "subscription" | "free_with_ads" | "purchase";
  note: string | null;
  checkedAt: string;
}
export interface N5Lesson {
  apiVersion: 1;
  id: string;
  courseId: string;
  contentVersion: string;
  trackId: string;
  unit: number;
  kind: "episode" | "study" | "final";
  title: string;
  episodeId: string | null;
  episode: { number: number; title: string } | null;
  script: N5Script;
  status: "unreviewed_preview";
  hook: string;
  summary: string | null;
  summarySource: string | null;
  canDo: string;
  vocabulary: { id: string; reading: string; meaning: string; audio: string }[];
  grammar: { id: string; title: string; explanation: string; example: string; examples: N5Spoken[] }[];
  dialogue: (N5Spoken & { speaker: "A" | "B" })[];
  watchLinks: N5WatchLink[];
  questions: N5Question[];
  speaking: { goal: string; opener: N5Spoken; prompts: string[] };
  previousLessonId: string | null;
  nextLessonId: string | null;
}
export interface N5Answer { questionId: string; value: string }
export interface N5Result {
  correct: number;
  total: number;
  objectivePercent: number;
  /** Objective score at or above the provisional 80% lesson gate. Not mastery. */
  passed: boolean;
  skills: Record<N5Skill, { correct: number; total: number }>;
  production: "needs_review";
  speaking: "not_assessed";
  kanjiLiteracy: "not_assessed";
  mastery: false;
  outcome: "preview_practice_complete";
  script: N5Script;
}
export interface N5ReviewItem {
  questionId: string;
  /** null for typed responses; see feedback. */
  correct: boolean | null;
  answer: string | null;
  correctChoiceId?: string;
  explanation?: string;
  transcript?: string;
  references?: string[];
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
  /** Present only once the attempt is complete. */
  review?: N5ReviewItem[];
}
export interface N5ReviewEvent {
  id: string;
  attemptId: string;
  objectiveId: string;
  judgment: "review-pass" | "review-fail";
}
export type N5SpeakingStatus = "not_started" | "practice_only" | "needs_practice" | "demonstrated";
export interface N5LessonProgress {
  lessonId: string;
  status: "not_started" | "in_progress" | "practised" | "passed";
  bestPercent: number | null;
  watched: boolean;
  speaking: N5SpeakingStatus;
  /** Lesson word ids Listening Mode heard in the episode audio. */
  heard: string[];
}
export interface N5Progress {
  enrolment: N5Enrolment | null;
  observations: { episodeId: string; kind: "watch_complete" | "practice_complete" }[];
  attempts: (Pick<N5Attempt, "id" | "status" | "script" | "result"> & { lessonId: string })[];
  lessons: N5LessonProgress[];
  nextLessonId: string | null;
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
  conversations: N5Conversation[];
  feedback: N5Feedback[];
  heard: { lessonId: string; wordId: string; firstHeardAt: number; lastHeardAt: number }[];
}
export interface N5Error { error: { code: string; message: string; details?: { questionId: string } } }

/** Bounded, answer-free snapshot of the lesson Listening Mode follows. */
export interface N5ExtensionState {
  apiVersion: 1;
  ownerId: string;
  context: {
    courseId: string; trackId: string; unitId: string; episodeId: string;
    lessonId: string; contentVersion: string; script: N5Script;
  } | null;
  lesson: {
    id: string; contentVersion: string; script: N5Script; canDo: string;
    /** Display context for the focus panel; older extension builds ignore it. */
    unit?: number; title?: string; episode?: { number: number; title: string } | null;
    /** `kana` is the word in plain kana whatever the script, for matching
     * what Listening Mode hears; older extension builds ignore it. */
    vocabulary: { id: string; reading: string; meaning: string; kana?: string }[];
    grammar: { id: string; explanation: string; example: string }[];
    /** Word ids already heard while listening. */
    heard?: string[];
  } | null;
  watched: boolean;
  activeAttempts: { id: string; script: N5Script }[];
  completedAttempts: number;
  mastery: false;
}

export interface N5FeedbackItem {
  questionId: string;
  /** unchecked: automatic feedback was unavailable; compare with the references. */
  verdict: "correct" | "close" | "retry" | "unchecked";
  /** A corrected sentence in the attempt script, or null. */
  correction: string | null;
  /** English explanation. */
  note: string;
  references: string[];
}
export interface N5Feedback {
  attemptId: string;
  script: N5Script;
  /** match: every answer matched a model answer. fallback is never stored, so a retry can upgrade it. */
  source: "match" | "ai" | "fallback";
  items: N5FeedbackItem[];
}

export interface N5Turn {
  seq: number;
  role: "tutor" | "learner";
  /** Japanese in the conversation script; null when a transcript failed script validation. */
  text: string | null;
  english: string | null;
  input?: "voice" | "text";
  /** Tutor turns only: a short English tip and an optional correction of the learner's last turn. */
  tip?: string | null;
  correction?: string | null;
  audio: boolean;
}
export interface N5SpeakingResult {
  status: Exclude<N5SpeakingStatus, "not_started">;
  taskCompletion: number;
  targetUse: number;
  interaction: number;
  evidence: string[];
  correction: string | null;
  summary: string;
  spokenTurns: number;
}
export interface N5Conversation {
  id: string;
  lessonId: string;
  script: N5Script;
  status: "active" | "complete";
  maxLearnerTurns: number;
  turns: N5Turn[];
  result: N5SpeakingResult | null;
}
