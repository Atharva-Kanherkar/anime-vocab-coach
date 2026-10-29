import type { N5Answer, N5Script } from "../../shared/n5/contracts";
import { UNITS } from "../src/n5/curriculum";
import { CONTENT_VERSION, COURSE_ID, TRACK_ID, episodeIdFor, lessonById, lessonIdFor } from "../src/n5/course";
import { render } from "../src/n5/text";

export { CONTENT_VERSION, COURSE_ID, TRACK_ID };
export const LESSON_ID = lessonIdFor(1);
export const EPISODE_ID = episodeIdFor(1);

/** The authored choice text, which by convention is the first source choice. */
export function correctText(unit: number, questionId: string, script: N5Script): string {
  const source = UNITS[unit - 1].questions.find((q) => q.id === questionId)!;
  return source.en ? source.choices[0] : render(source.choices[0])[script];
}

/**
 * Answer oracle independent of the grader's private keys: it finds the shuffled
 * public choice whose rendered text matches the authored correct text.
 */
export function correctAnswers(script: N5Script = "romaji", unit = 1): N5Answer[] {
  const lesson = lessonById(lessonIdFor(unit))!;
  return lesson.questions.map((q) => q.kind === "choice"
    ? { questionId: q.id, value: q.choices.find((c) => c.text[script] === correctText(unit, q.id, script))!.id }
    : { questionId: q.id, value: render(UNITS[unit - 1].writing.find((w) => w.id === q.id)!.references[0])[script] });
}
