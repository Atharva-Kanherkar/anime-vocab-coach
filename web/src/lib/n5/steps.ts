import type { N5Course, N5LessonProgress } from "../../../../shared/n5/contracts";

/** The five steps of every unit, in order. Study and final units have no episode to watch. */
export type StepId = "learn" | "drill" | "watch" | "practice" | "speak";
export const STEP_INFO: Record<StepId, { label: string; minutes: number; blurb: string }> = {
  learn: { label: "Learn", minutes: 8, blurb: "Flashcards with audio, grammar and a model dialogue" },
  drill: { label: "Drill", minutes: 4, blurb: "Quick recognition rounds with instant feedback" },
  watch: { label: "Watch", minutes: 24, blurb: "The episode on your own subscription, then a recap" },
  practice: { label: "Practice", minutes: 10, blurb: "Graded quiz plus short typed answers" },
  speak: { label: "Speak", minutes: 5, blurb: "A short conversation with Haru, your AI partner" },
};
export type UnitKind = N5Course["units"][number]["kind"];
export function stepsFor(kind: UnitKind): StepId[] {
  return kind === "episode" ? ["learn", "drill", "watch", "practice", "speak"] : ["learn", "drill", "practice", "speak"];
}

export const SECTIONS = [
  { title: "First meetings", range: [1, 6] },
  { title: "Daily life", range: [7, 12] },
  { title: "Plans and requests", range: [13, 18] },
  { title: "Real conversations", range: [19, 24] },
] as const;
export function sectionIndex(unit: number): number {
  const index = SECTIONS.findIndex((s) => unit >= s.range[0] && unit <= s.range[1]);
  return index === -1 ? SECTIONS.length - 1 : index;
}

/** Learn and drill completion lives in this browser; the server owns watch, practice and speaking. */
export function localStepsKey(ownerId: string, lessonId: string): string {
  return `avc:n5:steps:v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(lessonId)}`;
}
export function parseLocalSteps(raw: string | null): StepId[] {
  if (!raw || raw.length > 200) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter((s): s is StepId => s === "learn" || s === "drill"))] : [];
  } catch {
    return [];
  }
}
export function readLocalSteps(ownerId: string, lessonId: string): StepId[] {
  try {
    return parseLocalSteps(localStorage.getItem(localStepsKey(ownerId, lessonId)));
  } catch {
    return [];
  }
}
export function markLocalStep(ownerId: string, lessonId: string, step: "learn" | "drill"): void {
  try {
    const steps = readLocalSteps(ownerId, lessonId);
    if (!steps.includes(step)) localStorage.setItem(localStepsKey(ownerId, lessonId), JSON.stringify([...steps, step]));
  } catch {
    /* progress display only */
  }
}

/** Which steps are done, from server progress plus this browser's learn/drill marks. */
export function completedSteps(kind: UnitKind, progress: N5LessonProgress | undefined, local: StepId[]): Set<StepId> {
  const done = new Set<StepId>();
  const practised = progress?.status === "passed" || progress?.status === "practised";
  if (local.includes("drill")) done.add("drill");
  // Reaching a later step means the earlier study happened, even on another device.
  if (local.includes("learn") || done.has("drill") || practised) done.add("learn");
  if (kind === "episode" && progress?.watched) done.add("watch");
  if (practised) done.add("practice");
  if (progress && progress.speaking !== "not_started") done.add("speak");
  return done;
}

export function unitPercent(kind: UnitKind, done: Set<StepId>): number {
  const steps = stepsFor(kind);
  return Math.round((steps.filter((s) => done.has(s)).length / steps.length) * 100);
}
