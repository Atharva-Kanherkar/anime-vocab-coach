import type { N5Course, N5Lesson, N5Script, N5Skill, N5Text } from "../../../shared/n5/contracts";
import { UNITS, type UnitSource } from "./curriculum";
import { clipId, render, renderInline, speechText } from "./text";

export const COURSE_ID = "n5-foundations";
export const CONTENT_VERSION = "course-1";
export const TRACK_ID = "your-lie-in-april-2014";
export const TRACK_SLUG = "your-lie-in-april";
export const TRACKS = [
  { id: TRACK_ID, title: "Your Lie in April", adaptation: "2014 TV", season: "1", status: "unreviewed_preview" },
  { id: "spy-x-family-2022", title: "SPY x FAMILY", adaptation: "2022 TV", season: "1", status: "planned" },
  { id: "bocchi-the-rock-2022", title: "BOCCHI THE ROCK!", adaptation: "2022 TV", season: "1", status: "planned" },
  { id: "laid-back-camp-2018", title: "Laid-Back Camp", adaptation: "2018 TV", season: "1", status: "planned" },
  { id: "haikyu-2014", title: "Haikyu!!", adaptation: "2014 TV", season: "1", status: "planned" },
  { id: "fruits-basket-2019", title: "Fruits Basket", adaptation: "2019 TV", season: "1", status: "planned" },
] as const;
const SERIES_URL = "https://www.crunchyroll.com/series/G63V7KN9Y/your-lie-in-april";

/** Rendered Japanese with its audio clip. */
interface Spoken { text: N5Text; audio: string }
/** English teaching text whose embedded Japanese follows the learner's script. */
export type Inline = N5Text;
export interface PrivateChoice {
  id: string; kind: "choice"; skill: N5Skill; objectiveId: string; prompt: Inline;
  text?: N5Text; audio?: string; transcript?: N5Text; choiceLanguage: "ja" | "en";
  choices: { id: string; text: N5Text }[]; correctOption: string; explanation: Inline;
}
export interface PrivateProduction { id: string; kind: "production"; skill: "writing"; objectiveId: string; prompt: Inline; references: N5Text[] }
export type PrivateQuestion = PrivateChoice | PrivateProduction;
export interface PrivateLesson {
  id: string; unit: number; kind: UnitSource["kind"]; title: string; canDo: Inline;
  episodeId: string | null; episode: (Omit<NonNullable<UnitSource["episode"]>, "hook"> & { hook: Inline }) | null;
  vocabulary: { id: string; text: N5Text; meaning: string; audio: string }[];
  grammar: { id: string; title: Inline; explanation: Inline; examples: (Spoken & { english: string })[] }[];
  dialogue: (Spoken & { speaker: "A" | "B"; english: string })[];
  questions: PrivateQuestion[];
  speaking: { goal: Inline; opener: Spoken & { english: string }; prompts: Inline[]; casual: boolean };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const lessonIdFor = (unit: number) => `${TRACK_SLUG}-u${pad(unit)}`;
export const episodeIdFor = (episode: number) => `${TRACK_ID}-s1-e${pad(episode)}`;

/** clip id → kana spoken by text-to-speech. Only registered clips can ever be synthesised. */
export const CLIPS = new Map<string, string>();
function spoken(source: string, seed = source): Spoken {
  const id = clipId(seed);
  const speech = speechText(source);
  const existing = CLIPS.get(id);
  if (existing !== undefined && existing !== speech) throw new Error(`Clip collision for ${source}`);
  CLIPS.set(id, speech);
  return { text: render(source), audio: id };
}
const slug = (romaji: string) => romaji.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Seeded Fisher-Yates so choice order is stable for a content version but not "always a". */
function shuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let state = parseInt(clipId(seed).slice(0, 8), 16) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function build(unit: UnitSource): PrivateLesson {
  const id = lessonIdFor(unit.unit);
  const u = `u${pad(unit.unit)}`;
  const questions: PrivateQuestion[] = unit.questions.map((q) => {
    const order = shuffle(q.choices.map((choice, index) => ({ choice, index })), `${id}:${q.id}`);
    const choices = order.map((entry, index) => ({
      id: "abcd"[index],
      text: q.en ? { romaji: entry.choice, kana: entry.choice } : render(entry.choice),
      correct: entry.index === 0,
    }));
    // Listening clips are salted per question, so their ids never match a vocabulary clip.
    const audio = q.audio ? spoken(q.audio, `listen:${id}:${q.id}:${q.audio}`) : undefined;
    return {
      id: q.id, kind: "choice", skill: q.skill, objectiveId: q.objective ?? `${u}-${q.skill}`, prompt: renderInline(q.prompt),
      ...(q.ja ? { text: render(q.ja) } : {}),
      ...(audio ? { audio: audio.audio, transcript: audio.text } : {}),
      choiceLanguage: q.en ? "en" : "ja",
      choices: choices.map(({ id: choiceId, text }) => ({ id: choiceId, text })),
      correctOption: choices.find((c) => c.correct)!.id,
      explanation: renderInline(q.explain),
    } satisfies PrivateChoice;
  });
  for (const w of unit.writing) {
    questions.push({ id: w.id, kind: "production", skill: "writing", objectiveId: w.objective ?? `${u}-writing`, prompt: renderInline(w.prompt), references: w.references.map(render) });
  }
  return {
    id, unit: unit.unit, kind: unit.kind, title: unit.title, canDo: renderInline(unit.canDo),
    episodeId: unit.episode ? episodeIdFor(unit.episode.number) : null,
    episode: unit.episode ? { ...unit.episode, hook: renderInline(unit.episode.hook) } : null,
    vocabulary: unit.vocabulary.map(([src, meaning]) => { const s = spoken(src); return { id: slug(s.text.romaji), text: s.text, meaning, audio: s.audio }; }),
    grammar: unit.grammar.map((g, index) => ({ id: `${u}-g${index + 1}`, title: renderInline(g.title), explanation: renderInline(g.explanation),
      examples: g.examples.map(([src, english]) => ({ ...spoken(src), english })) })),
    dialogue: unit.dialogue.map(([speaker, src, english]) => ({ ...spoken(src), speaker, english })),
    questions,
    speaking: { goal: renderInline(unit.speaking.goal), opener: { ...spoken(unit.speaking.opener[0]), english: unit.speaking.opener[1] }, prompts: unit.speaking.prompts.map(renderInline), casual: unit.speaking.casual ?? false },
  };
}

export const LESSONS: readonly PrivateLesson[] = UNITS.map(build);
export const LESSON_IDS = LESSONS.map((lesson) => lesson.id) as [string, ...string[]];
export const EPISODE_IDS = LESSONS.flatMap((lesson) => (lesson.episodeId ? [lesson.episodeId] : [])) as [string, ...string[]];
const BY_ID = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
export const MAX_QUESTIONS = Math.max(...LESSONS.map((lesson) => lesson.questions.length));

export function lessonById(id: string): PrivateLesson | undefined { return BY_ID.get(id); }

export function courseOutline(): N5Course {
  return {
    apiVersion: 1, courseId: COURSE_ID, contentVersion: CONTENT_VERSION,
    units: LESSONS.map((lesson) => ({
      id: `unit-${lesson.unit}`, number: lesson.unit, title: lesson.title, status: "unreviewed_preview", lessonId: lesson.id, kind: lesson.kind,
      episode: lesson.episode ? { number: lesson.episode.number, title: lesson.episode.title } : null,
    })),
    limitation: "Unreviewed practice course. Results are practice evidence, not a JLPT score or pass prediction.",
    availableLessons: [...LESSON_IDS],
  };
}

export function publicLesson(lesson: PrivateLesson, script: N5Script): N5Lesson {
  const index = LESSONS.indexOf(lesson);
  return {
    apiVersion: 1, id: lesson.id, courseId: COURSE_ID, contentVersion: CONTENT_VERSION, trackId: TRACK_ID,
    unit: lesson.unit, kind: lesson.kind, title: lesson.title, episodeId: lesson.episodeId,
    episode: lesson.episode ? { number: lesson.episode.number, title: lesson.episode.title } : null,
    script, status: "unreviewed_preview",
    hook: lesson.episode?.hook[script] ?? (lesson.kind === "final" ? "No episode for this unit: it's your season final." : "No episode for this unit: it's a study and checkpoint unit."),
    summary: lesson.episode?.summary ?? null,
    summarySource: lesson.episode ? `https://www.yourlieinapril.com/story/${pad(lesson.episode.number)}.html` : null,
    canDo: lesson.canDo[script],
    vocabulary: lesson.vocabulary.map((v) => ({ id: v.id, reading: v.text[script], meaning: v.meaning, audio: v.audio })),
    grammar: lesson.grammar.map((g) => ({ id: g.id, title: g.title[script], explanation: g.explanation[script], example: g.examples[0].text[script],
      examples: g.examples.map((e) => ({ text: e.text[script], english: e.english, audio: e.audio })) })),
    dialogue: lesson.dialogue.map((d) => ({ speaker: d.speaker, text: d.text[script], english: d.english, audio: d.audio })),
    watchLinks: lesson.episode ? [{ provider: "Crunchyroll", url: SERIES_URL, region: "unknown", availability: "unknown", checkedAt: null }] : [],
    questions: lesson.questions.map((q) => q.kind === "choice"
      ? { id: q.id, kind: "choice", skill: q.skill, objectiveId: q.objectiveId, prompt: q.prompt[script],
        ...(q.text ? { text: q.text[script] } : {}), ...(q.audio ? { audio: q.audio } : {}),
        choiceLanguage: q.choiceLanguage, choices: q.choices.map((c) => ({ id: c.id, text: c.text[script] })) }
      : { id: q.id, kind: "production", skill: "writing", objectiveId: q.objectiveId, prompt: q.prompt[script] }),
    speaking: { goal: lesson.speaking.goal[script], opener: { text: lesson.speaking.opener.text[script], english: lesson.speaking.opener.english, audio: lesson.speaking.opener.audio }, prompts: lesson.speaking.prompts.map((p) => p[script]) },
    previousLessonId: LESSONS[index - 1]?.id ?? null,
    nextLessonId: LESSONS[index + 1]?.id ?? null,
  };
}
